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
import queue
import socket
import struct
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import cv2
import numpy as np
import pyaudio
import pyrealsense2 as rs
import json_server as server
import datetime

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 8080

# Video
DEFAULT_DEVICE_INDEX = 0
DEFAULT_PROFILE_INDEX = 186  # -1 = highest resolution
JPEG_QUALITY = 80

# Audio (ReSpeaker mic array)
RESPEAKER_RATE = 16000
RESPEAKER_CHANNELS = 6      # 6-channel firmware required
RESPEAKER_WIDTH = 2         # int16
AUDIO_CHUNK = 512           # ~32 ms per chunk at 16 kHz — smaller = lower latency
# Flush enough chunks to clear the OS + PyAudio ring buffer on connect.
# PyAudio's default ring buffer is ~1 s; the OS ALSA buffer adds another ~0.5 s.
# Draining 64 chunks × 32 ms = ~2 s guarantees we start from live audio.
AUDIO_DRAIN_CHUNKS = 64

# Doctor → robot audio playback
# Raw signed-16-bit mono PCM at 16 kHz, matching what the browser sends.
SPEAKER_RATE = 16000
SPEAKER_WIDTH = 2           # int16
SPEAKER_CHANNELS = 1        # mono
SPEAKER_CHUNK = 512         # frames per PyAudio output write
# Max queued chunks before we start dropping to avoid runaway latency.
SPEAKER_QUEUE_MAX = 64

# ---------------------------------------------------------------------------
# Shared state — latest JPEG frame
# ---------------------------------------------------------------------------
latest_jpeg: bytes = b""
jpeg_lock = threading.Lock()
jpeg_event = threading.Event()

# ---------------------------------------------------------------------------
# Shared state — doctor→robot speaker queue
# ---------------------------------------------------------------------------
# Raw signed-16-bit mono PCM chunks at SPEAKER_RATE are pushed here by the
# POST /audio-input handler and consumed by the speaker playback thread.
speaker_queue: queue.Queue[bytes] = queue.Queue(maxsize=SPEAKER_QUEUE_MAX)

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
        img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
        ret, jpeg = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
        if not ret:
            continue

        with jpeg_lock:
            latest_jpeg = jpeg.tobytes()
        jpeg_event.set()

# ---------------------------------------------------------------------------
# Background thread: play doctor audio through the robot speaker
# ---------------------------------------------------------------------------

def speaker_playback_loop(stop_event: threading.Event) -> None:
    """
    Drain speaker_queue and write raw PCM to the default output device.

    Runs as a daemon thread. Opens a single persistent PyAudio output stream
    so there is no per-chunk open/close overhead. If the output device is
    unavailable the thread logs a warning and exits gracefully — the robot
    will simply have no speaker output rather than crashing.
    """
    with ignore_stderr():
        pa = pyaudio.PyAudio()

    try:
        stream = pa.open(
            rate=SPEAKER_RATE,
            format=pa.get_format_from_width(SPEAKER_WIDTH),
            channels=SPEAKER_CHANNELS,
            output=True,
            frames_per_buffer=SPEAKER_CHUNK,
        )
    except OSError as exc:
        print(f"[speaker] Failed to open output stream: {exc}")
        pa.terminate()
        return

    print("[speaker] Output stream ready.")

    try:
        while not stop_event.is_set():
            try:
                chunk = speaker_queue.get(timeout=0.1)
            except queue.Empty:
                continue
            try:
                stream.write(chunk)
            except OSError as exc:
                print(f"[speaker] Write error: {exc}")
    finally:
        stream.stop_stream()
        stream.close()
        pa.terminate()
        print("[speaker] Output stream closed.")

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
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html { width: 100%; height: 100%; background: #000; overflow: hidden; }
    img { width: 100%; height: 100%; object-fit: contain; display: block; }
  </style>
</head>
<body>
  <img src="/video" alt="Live feed" />
  <audio autoplay src="/audio"></audio>
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

    def do_POST(self):
        path = self.path.split("?")[0]
        if path == "/audio-input":
            self._receive_audio_input()
        else:
            self.send_error(404)

    def _receive_audio_input(self):
        """
        POST /audio-input

        Accepts a chunk of raw signed-16-bit mono PCM at SPEAKER_RATE (16 kHz)
        from the doctor's browser (proxied through Next.js) and enqueues it for
        playback on the robot speaker.

        The browser sends one HTTP POST per MediaRecorder chunk (~100 ms of
        audio). Content-Length is required so we know how many bytes to read.

        If the speaker queue is full (doctor is sending faster than the speaker
        can play) the oldest chunk is dropped to keep latency low.
        """
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            self.send_response(400)
            self.end_headers()
            return

        data = self.rfile.read(length)

        # Drop oldest chunk rather than blocking if the queue is full
        if speaker_queue.full():
            try:
                speaker_queue.get_nowait()
            except queue.Empty:
                pass

        try:
            speaker_queue.put_nowait(data)
        except queue.Full:
            pass  # extremely unlikely after the drain above

        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.end_headers()

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
                # Keep the ring buffer as small as possible so stale audio
                # cannot accumulate between the time the stream is opened and
                # the time the drain loop runs.
                input_buffer_size=AUDIO_CHUNK * 4,
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

            # Drain any audio that accumulated in the OS/PyAudio buffer before
            # this client connected — sending stale buffered data is the main
            # cause of the perceived audio delay.
            for _ in range(AUDIO_DRAIN_CHUNKS):
                stream.read(AUDIO_CHUNK, exception_on_overflow=False)

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

    # Find ReSpeaker — retry up to 10 times with a 1s delay between attempts
    respeaker_index = -1
    for attempt in range(1, 11):
        respeaker_index = get_respeaker_device_id()
        if respeaker_index >= 0:
            print(f"[audio] ReSpeaker found at device index {respeaker_index}")
            break
        print(f"[audio] ReSpeaker not found (attempt {attempt}/10), retrying in 1s...")
        time.sleep(1)
    else:
        print("[audio] ReSpeaker not found after 10 attempts — audio will be unavailable.")

    # Start camera capture thread
    stop_event = threading.Event()
    capture_thread = threading.Thread(
        target=camera_capture_loop,
        args=(pipeline, stop_event),
        daemon=True,
        name="camera-capture",
    )
    capture_thread.start()

    # Start speaker playback thread (doctor → robot audio)
    speaker_thread = threading.Thread(
        target=speaker_playback_loop,
        args=(stop_event,),
        daemon=True,
        name="speaker-playback",
    )
    speaker_thread.start()

    # Build HTTP server with respeaker_index baked into the handler
    def handler_factory(*args, **kwargs):
        return StreamHandler(*args, respeaker_index=respeaker_index, **kwargs)

    httpd = ThreadingHTTPServer((args.host, args.port), handler_factory)

    local_ip = socket.gethostbyname(socket.gethostname())
    print(f"Stream server running at http://{local_ip}:{args.port}")
    print("Press Ctrl+C to stop.")

    server.state["status"] = "CALL_READY"
    server.state["last_update"] = datetime.datetime.now().isoformat()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
    finally:
        stop_event.set()
        pipeline.stop()


if __name__ == "__main__":
    main()
