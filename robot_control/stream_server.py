"""
robot_control/stream_server.py

Captures RGB video from an Intel RealSense camera and audio from a ReSpeaker
mic array, then serves both directly over HTTP so any browser on the network
can view the live stream.

Endpoints:
  GET /        -> viewer HTML page
  GET /video   -> MJPEG stream
  GET /audio   -> streaming WAV (mono, 16kHz)

Usage:
  python stream_server.py [--host 0.0.0.0] [--port 8080]
                          [--device-index 0] [--profile-index -1]
"""

import argparse
import contextlib
import os
import socket
import struct
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import cv2
import numpy as np
import pyaudio
import pyrealsense2 as rs

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 8080

# Video
DEFAULT_DEVICE_INDEX = 0
DEFAULT_PROFILE_INDEX = -1  # -1 = highest resolution
JPEG_QUALITY = 80

# Audio (ReSpeaker mic array)
RESPEAKER_RATE = 16000
RESPEAKER_CHANNELS = 6      # 6-channel firmware required
RESPEAKER_WIDTH = 2         # int16
AUDIO_CHUNK = 1024

# ---------------------------------------------------------------------------
# Shared state — latest JPEG frame
# ---------------------------------------------------------------------------
latest_jpeg: bytes = b""
jpeg_lock = threading.Lock()
jpeg_event = threading.Event()

# ---------------------------------------------------------------------------
# Suppress ALSA stderr noise
# ---------------------------------------------------------------------------

@contextlib.contextmanager
def ignore_stderr():
    devnull = os.open(os.devnull, os.O_WRONLY)
    old_stderr = os.dup(2)
    os.dup2(devnull, 2)
    try:
        yield
    finally:
        os.dup2(old_stderr, 2)
        os.close(devnull)
        os.close(old_stderr)

# ---------------------------------------------------------------------------
# RealSense camera initialization
# ---------------------------------------------------------------------------

def initialize_camera(
    device_index: int = 0,
    profile_index: int = -1,
) -> tuple[rs.pipeline, int, int, int] | None:
    """
    Enumerate RealSense color profiles, start the pipeline, and return
    (pipeline, width, height, fps), or None on failure.
    """
    ctx = rs.context()
    devices = list(ctx.query_devices())

    if not devices:
        print("[camera] No RealSense devices detected.")
        return None

    if device_index >= len(devices):
        print(f"[camera] Device index {device_index} out of range ({len(devices)} found).")
        return None

    device = devices[device_index]
    serial = device.get_info(rs.camera_info.serial_number)

    profiles: set[tuple[int, int, int, rs.format]] = set()
    for sensor in device.sensors:
        for profile in sensor.get_stream_profiles():
            if profile.stream_type() != rs.stream.color:
                continue
            try:
                vp = profile.as_video_stream_profile()
                profiles.add((vp.width(), vp.height(), vp.fps(), profile.format()))
            except RuntimeError:
                continue

    sorted_profiles = sorted(profiles, key=lambda x: (x[0] * x[1], x[2], str(x[3])))

    if not sorted_profiles:
        print("[camera] No color profiles found.")
        return None

    if profile_index < 0:
        profile_index = len(sorted_profiles) - 1

    if profile_index >= len(sorted_profiles):
        print(f"[camera] Profile index {profile_index} out of range ({len(sorted_profiles)} found).")
        return None

    w, h, fps, fmt = sorted_profiles[profile_index]

    pipeline = rs.pipeline()
    config = rs.config()
    config.enable_device(serial)
    config.enable_stream(rs.stream.color, w, h, fmt, fps)

    try:
        pipeline.start(config)
    except RuntimeError as exc:
        print(f"[camera] Failed to start pipeline: {exc}")
        return None

    print(f"[camera] Initialized: {w}x{h}@{fps} (device {device_index}, profile {profile_index})")
    return pipeline, w, h, fps

# ---------------------------------------------------------------------------
# ReSpeaker initialization
# ---------------------------------------------------------------------------

def get_respeaker_device_id() -> int:
    """Return the PyAudio device index for the ReSpeaker, or -1 if not found."""
    with ignore_stderr():
        p = pyaudio.PyAudio()
    info = p.get_host_api_info_by_index(0)
    device_id = -1
    for i in range(info.get("deviceCount", 0)):
        dev = p.get_device_info_by_host_api_device_index(0, i)
        if dev.get("maxInputChannels", 0) > 0 and "ReSpeaker" in dev.get("name", ""):
            device_id = i
            break
    p.terminate()
    return device_id

# ---------------------------------------------------------------------------
# Background thread: capture frames and push to shared state
# ---------------------------------------------------------------------------

def camera_capture_loop(pipeline: rs.pipeline, stop_event: threading.Event) -> None:
    """Continuously grab frames, encode as JPEG, and update latest_jpeg."""
    global latest_jpeg
    while not stop_event.is_set():
        try:
            frames = pipeline.wait_for_frames(timeout_ms=5000)
        except RuntimeError as exc:
            print(f"[camera] Frame timeout: {exc}")
            continue

        color_frame = frames.get_color_frame()
        if not color_frame:
            continue

        img = np.asanyarray(color_frame.get_data())

        # Normalize to BGR8 regardless of the stream's native format
        fmt = color_frame.profile.as_video_stream_profile().format()
        if fmt == rs.format.rgb8:
            img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
        elif fmt == rs.format.rgba8:
            img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
        elif fmt == rs.format.bgra8:
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
        elif fmt == rs.format.yuyv:
            img = cv2.cvtColor(img, cv2.COLOR_YUV2BGR_YUYV)
        # bgr8 needs no conversion; other formats fall through as-is

        # Ensure 8-bit depth
        if img.dtype != np.uint8:
            img = (img / img.max() * 255).astype(np.uint8)

        ret, jpeg = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
        if not ret:
            continue

        with jpeg_lock:
            latest_jpeg = jpeg.tobytes()
        jpeg_event.set()

# ---------------------------------------------------------------------------
# WAV header for streaming
# ---------------------------------------------------------------------------

def wav_header(data_size: int = 0x7FFFFFFF) -> bytes:
    byte_rate = RESPEAKER_RATE * 1 * RESPEAKER_WIDTH
    block_align = 1 * RESPEAKER_WIDTH
    return struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + data_size, b"WAVE",
        b"fmt ", 16, 1,          # PCM
        1,                       # mono (after channel extraction)
        RESPEAKER_RATE,
        byte_rate,
        block_align,
        RESPEAKER_WIDTH * 8,
        b"data", data_size,
    )

# ---------------------------------------------------------------------------
# HTTP handler
# ---------------------------------------------------------------------------

HTML = b"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Robot Stream</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0d0d0d; color: #e0e0e0;
      font-family: system-ui, sans-serif;
      display: flex; flex-direction: column; align-items: center;
      min-height: 100vh; padding: 24px 16px; gap: 20px;
    }
    header { display: flex; align-items: center; gap: 10px; }
    h1 { font-size: 1.25rem; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: #fff; }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: #555; transition: background .3s; }
    .dot.live  { background: #22c55e; box-shadow: 0 0 6px #22c55e; }
    .dot.error { background: #ef4444; box-shadow: 0 0 6px #ef4444; }
    .video-wrapper {
      width: 100%; max-width: 960px; background: #1a1a1a;
      border-radius: 10px; overflow: hidden; border: 1px solid #2a2a2a;
    }
    #feed { width: 100%; display: block; }
    .placeholder {
      display: flex; align-items: center; justify-content: center;
      height: 300px; color: #555; font-size: .95rem; letter-spacing: .05em;
    }
    .controls { display: flex; gap: 12px; align-items: center; }
    button {
      background: #1f1f1f; color: #e0e0e0; border: 1px solid #333;
      border-radius: 6px; padding: 8px 18px; font-size: .875rem;
      cursor: pointer; transition: background .2s, border-color .2s;
    }
    button:hover { background: #2a2a2a; border-color: #555; }
    .muted { color: #ef4444; border-color: #ef4444; }
    #status { font-size: .8rem; color: #666; }
    audio { display: none; }
  </style>
</head>
<body>
  <header>
    <div class="dot" id="dot"></div>
    <h1>Robot Stream</h1>
  </header>
  <div class="video-wrapper">
    <div class="placeholder" id="placeholder">Waiting for stream\u2026</div>
    <img id="feed" alt="Live feed" style="display:none" />
  </div>
  <div class="controls">
    <button onclick="reconnect()">Reconnect</button>
    <button id="mute-btn" onclick="toggleMute()">Mute Audio</button>
    <span id="status">Connecting\u2026</span>
  </div>
  <audio id="audio" autoplay></audio>
  <script>
    const feed = document.getElementById('feed');
    const ph   = document.getElementById('placeholder');
    const dot  = document.getElementById('dot');
    const st   = document.getElementById('status');
    const aud  = document.getElementById('audio');
    const mb   = document.getElementById('mute-btn');
    let muted  = false;

    function startVideo() {
      feed.src = '/video?t=' + Date.now();
      feed.onload = () => {
        ph.style.display = 'none'; feed.style.display = 'block';
        dot.className = 'dot live'; st.textContent = 'Live';
      };
      feed.onerror = () => {
        feed.style.display = 'none'; ph.style.display = 'flex';
        dot.className = 'dot error'; st.textContent = 'Video error \u2014 try reconnecting';
      };
    }

    function startAudio() {
      aud.src = '/audio?t=' + Date.now();
      aud.muted = muted;
      aud.play().catch(() => {
        st.textContent = 'Click anywhere to enable audio';
        document.addEventListener('click', () => aud.play(), { once: true });
      });
    }

    function toggleMute() {
      muted = !muted; aud.muted = muted;
      mb.textContent = muted ? 'Unmute Audio' : 'Mute Audio';
      mb.classList.toggle('muted', muted);
    }

    function reconnect() {
      st.textContent = 'Reconnecting\u2026'; dot.className = 'dot';
      feed.style.display = 'none'; ph.style.display = 'flex';
      ph.textContent = 'Reconnecting\u2026';
      aud.src = ''; feed.src = '';
      setTimeout(() => { startVideo(); startAudio(); }, 300);
    }

    startVideo();
    startAudio();
  </script>
</body>
</html>"""


class StreamHandler(BaseHTTPRequestHandler):
    def __init__(self, *args, respeaker_index: int = -1, **kwargs):
        self._respeaker_index = respeaker_index
        super().__init__(*args, **kwargs)

    def log_message(self, fmt, *args):
        pass  # silence access log

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/":
            self._serve_html()
        elif path == "/video":
            self._serve_mjpeg()
        elif path == "/audio":
            self._serve_audio()
        else:
            self.send_error(404)

    def _serve_html(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(HTML)))
        self.end_headers()
        self.wfile.write(HTML)

    def _serve_mjpeg(self):
        self.send_response(200)
        self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        try:
            while True:
                jpeg_event.wait(timeout=2.0)
                jpeg_event.clear()
                with jpeg_lock:
                    frame = latest_jpeg
                if not frame:
                    continue
                header = (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(len(frame)).encode() + b"\r\n\r\n"
                )
                self.wfile.write(header + frame + b"\r\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass

    def _serve_audio(self):
        if self._respeaker_index < 0:
            self.send_error(503, "No ReSpeaker device available")
            return

        with ignore_stderr():
            pa = pyaudio.PyAudio()

        try:
            stream = pa.open(
                rate=RESPEAKER_RATE,
                format=pa.get_format_from_width(RESPEAKER_WIDTH),
                channels=RESPEAKER_CHANNELS,
                input=True,
                input_device_index=self._respeaker_index,
                frames_per_buffer=AUDIO_CHUNK,
            )
        except OSError as exc:
            print(f"[audio] Failed to open stream: {exc}")
            pa.terminate()
            self.send_error(503, "Audio device error")
            return

        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()

        try:
            self.wfile.write(wav_header())
            self.wfile.flush()
            while True:
                data = stream.read(AUDIO_CHUNK, exception_on_overflow=False)
                # Extract channel 0 from 6-channel interleaved int16
                mono = np.frombuffer(data, dtype=np.int16)[0::RESPEAKER_CHANNELS]
                self.wfile.write(mono.tobytes())
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        finally:
            stream.stop_stream()
            stream.close()
            pa.terminate()

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Robot camera + audio HTTP stream server")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--device-index", type=int, default=DEFAULT_DEVICE_INDEX,
                        help="RealSense device index (default: 0)")
    parser.add_argument("--profile-index", type=int, default=DEFAULT_PROFILE_INDEX,
                        help="Color profile index, -1 = highest resolution (default: -1)")
    args = parser.parse_args()

    # Init camera
    result = initialize_camera(args.device_index, args.profile_index)
    if result is None:
        print("Camera init failed — exiting.")
        return
    pipeline, width, height, fps = result

    # Find ReSpeaker
    respeaker_index = get_respeaker_device_id()
    if respeaker_index < 0:
        print("[audio] ReSpeaker not found — audio will be unavailable.")
    else:
        print(f"[audio] ReSpeaker found at device index {respeaker_index}")

    # Start camera capture thread
    stop_event = threading.Event()
    capture_thread = threading.Thread(
        target=camera_capture_loop,
        args=(pipeline, stop_event),
        daemon=True,
        name="camera-capture",
    )
    capture_thread.start()

    # Build HTTP server with respeaker_index baked into the handler
    def handler_factory(*args, **kwargs):
        return StreamHandler(*args, respeaker_index=respeaker_index, **kwargs)

    httpd = ThreadingHTTPServer((args.host, args.port), handler_factory)

    local_ip = socket.gethostbyname(socket.gethostname())
    print(f"Stream server running at http://{local_ip}:{args.port}")
    print("Press Ctrl+C to stop.")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
    finally:
        stop_event.set()
        pipeline.stop()


if __name__ == "__main__":
    main()
