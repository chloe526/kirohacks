"""
robot_control/stream_server.py

Captures RGB video from an Intel RealSense camera and audio from a ReSpeaker
mic array, then serves both directly over HTTP so any browser on the network
can view the live stream.

Endpoints:
  GET /        -> viewer HTML page
  GET /video   -> MJPEG stream
  GET /audio   -> streaming WAV (mono, 16kHz)
  GET /audio-input -> WebSocket endpoint for doctor→robot audio (RFC 6455)

Usage:
  python stream_server.py [--host 0.0.0.0] [--port 8080]
                          [--device-index 0] [--profile-index -1]
"""

import argparse
import base64
import collections
import contextlib
import hashlib
import io
import os
import socket
import struct
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import av
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
AUDIO_DRAIN_CHUNKS = 4      # discard this many chunks on connect to flush stale buffer

# ---------------------------------------------------------------------------
# Shared state — latest JPEG frame
# ---------------------------------------------------------------------------
latest_jpeg: bytes = b""
jpeg_lock = threading.Lock()
jpeg_event = threading.Event()

# ---------------------------------------------------------------------------
# Audio input WebSocket state (task 1.4)
# ---------------------------------------------------------------------------
_audio_input_active: bool = False
_audio_input_lock: threading.Lock = threading.Lock()
_audio_input_handler: "AudioInputHandler | None" = None  # set in main()

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
) -> "tuple[rs.pipeline, int, int, int] | None":
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

    profiles: set = set()
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

def camera_capture_loop(pipeline, stop_event: threading.Event) -> None:
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
# AudioInputHandler — decode + jitter buffer + playback (task 2)
# ---------------------------------------------------------------------------

class AudioInputHandler:
    """Receives Opus/WebM audio frames from the WebSocket and plays them back.

    Decodes each frame with pyav, resamples to 16 kHz mono int16, enqueues
    the resulting PCM into a jitter buffer, and drains the buffer to a PyAudio
    output stream on a background thread.

    Requirements: 3.1–3.6, 6.3–6.4
    """

    JITTER_MIN = 2           # frames before starting playback of a new utterance
    JITTER_MAX = 8           # frames before dropping oldest
    SILENCE_TIMEOUT = 0.5    # seconds — gap treated as silence
    OUTPUT_RATE = 16_000
    OUTPUT_WIDTH = 2         # int16
    OUTPUT_CHANNELS = 1

    def __init__(self, pa_instance: "pyaudio.PyAudio | None" = None) -> None:
        self._pa = pa_instance
        self._pa_stream = None
        self._jitter_buffer: collections.deque = collections.deque()
        self._buffer_lock = threading.Lock()
        self._frame_event = threading.Event()
        self._stop_event = threading.Event()
        self._playback_started = False  # True once we've begun draining

        # Attempt to open the PyAudio output stream (task 2.5)
        if self._pa is not None:
            try:
                self._pa_stream = self._pa.open(
                    rate=self.OUTPUT_RATE,
                    format=self._pa.get_format_from_width(self.OUTPUT_WIDTH),
                    channels=self.OUTPUT_CHANNELS,
                    output=True,
                )
            except OSError as exc:
                print(f"[audio-input] PyAudio output device unavailable: {exc} — playback disabled")
                self._pa_stream = None

        # Start background playback thread
        self._playback_thread = threading.Thread(
            target=self._playback_loop,
            daemon=True,
            name="audio-input-playback",
        )
        self._playback_thread.start()

    def on_frame(self, data: bytes) -> None:
        """Called from the WebSocket thread with each binary Opus/WebM frame.

        Decodes the frame with pyav, resamples to 16 kHz mono int16, and
        enqueues the resulting PCM bytes into the jitter buffer.

        Malformed frames are discarded with a warning (task 2.6 / Property 6).
        """
        try:
            pcm_chunks = self._decode_opus_webm(data)
        except Exception as exc:
            print(f"[audio-input] Malformed frame discarded: {exc}")
            return  # discard and continue — Property 6

        with self._buffer_lock:
            for chunk in pcm_chunks:
                self._jitter_buffer.append(chunk)
                # Cap at JITTER_MAX — drop oldest if over limit
                while len(self._jitter_buffer) > self.JITTER_MAX:
                    self._jitter_buffer.popleft()

        self._frame_event.set()

    def _decode_opus_webm(self, data: bytes) -> list:
        """Decode Opus/WebM bytes to a list of 16 kHz mono int16 PCM byte strings.

        Uses pyav (FFmpeg bindings) for container parsing and Opus decoding,
        then resamples with av.AudioResampler to 16 kHz mono int16.

        Validates: Requirements 6.3, 6.4 / Property 7
        """
        pcm_chunks = []
        buf = io.BytesIO(data)
        resampler = av.AudioResampler(
            format="s16",
            layout="mono",
            rate=self.OUTPUT_RATE,
        )
        with av.open(buf, format="webm") as container:
            for frame in container.decode(audio=0):
                resampled_frames = resampler.resample(frame)
                for rf in resampled_frames:
                    pcm_chunks.append(bytes(rf.planes[0]))
            # Flush resampler
            for rf in resampler.resample(None):
                pcm_chunks.append(bytes(rf.planes[0]))
        return pcm_chunks

    def _playback_loop(self) -> None:
        """Background thread: drain jitter buffer to PyAudio output stream."""
        while not self._stop_event.is_set():
            # Wait for frames to arrive (with silence timeout)
            self._frame_event.wait(timeout=self.SILENCE_TIMEOUT)
            self._frame_event.clear()

            if self._stop_event.is_set():
                break

            # Drain available frames
            while True:
                with self._buffer_lock:
                    buf_len = len(self._jitter_buffer)
                    # Wait for JITTER_MIN frames before starting a new utterance
                    if not self._playback_started and buf_len < self.JITTER_MIN:
                        break
                    if buf_len == 0:
                        self._playback_started = False
                        break
                    self._playback_started = True
                    chunk = self._jitter_buffer.popleft()

                if self._pa_stream is not None:
                    try:
                        self._pa_stream.write(chunk)
                    except OSError as exc:
                        print(f"[audio-input] PyAudio write error: {exc}")
                        # Attempt to reopen stream once
                        try:
                            self._pa_stream.close()
                            if self._pa is not None:
                                self._pa_stream = self._pa.open(
                                    rate=self.OUTPUT_RATE,
                                    format=self._pa.get_format_from_width(self.OUTPUT_WIDTH),
                                    channels=self.OUTPUT_CHANNELS,
                                    output=True,
                                )
                        except OSError as reopen_exc:
                            print(f"[audio-input] Failed to reopen PyAudio stream: {reopen_exc} — disabling playback")
                            self._pa_stream = None

    def on_disconnect(self) -> None:
        """Called when the WebSocket client disconnects.

        Drains remaining frames within 500 ms, then stops the playback thread.
        Validates: Requirement 5.3
        """
        deadline = time.monotonic() + 0.5
        while time.monotonic() < deadline:
            with self._buffer_lock:
                if not self._jitter_buffer:
                    break
                chunk = self._jitter_buffer.popleft()
            if self._pa_stream is not None:
                try:
                    self._pa_stream.write(chunk)
                except OSError:
                    break

        self._stop_event.set()
        self._frame_event.set()  # unblock the playback thread
        self._playback_thread.join(timeout=1.0)

        if self._pa_stream is not None:
            try:
                self._pa_stream.stop_stream()
                self._pa_stream.close()
            except OSError:
                pass
            self._pa_stream = None

        # Reset state so a new connection can reuse this handler
        self._stop_event.clear()
        self._playback_started = False
        self._playback_thread = threading.Thread(
            target=self._playback_loop,
            daemon=True,
            name="audio-input-playback",
        )
        self._playback_thread.start()


# ---------------------------------------------------------------------------
# WebSocket helpers (RFC 6455) — tasks 1.1 and 1.3
# ---------------------------------------------------------------------------

_WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"


def _ws_handshake(handler: BaseHTTPRequestHandler) -> None:
    """Perform the RFC 6455 WebSocket opening handshake.

    Reads ``Sec-WebSocket-Key`` from the request headers, computes the accept
    hash, and writes the 101 Switching Protocols response.
    """
    key = handler.headers.get("Sec-WebSocket-Key", "").strip()
    accept = base64.b64encode(
        hashlib.sha1((key + _WS_MAGIC).encode()).digest()
    ).decode()

    handler.send_response(101, "Switching Protocols")
    handler.send_header("Upgrade", "websocket")
    handler.send_header("Connection", "Upgrade")
    handler.send_header("Sec-WebSocket-Accept", accept)
    handler.end_headers()


def _ws_read_frame(rfile) -> "tuple[int, bytes]":
    """Read one WebSocket frame from *rfile*.

    Returns ``(opcode, payload_bytes)``.
    Raises ``ConnectionError`` on EOF or any socket error.
    """
    try:
        header = rfile.read(2)
        if len(header) < 2:
            raise ConnectionError("EOF reading frame header")

        # Byte 0: FIN(1) + RSV(3) + opcode(4)
        opcode = header[0] & 0x0F

        # Byte 1: MASK(1) + payload_len(7)
        masked = bool(header[1] & 0x80)
        payload_len = header[1] & 0x7F

        if payload_len == 126:
            ext = rfile.read(2)
            if len(ext) < 2:
                raise ConnectionError("EOF reading 16-bit length")
            payload_len = struct.unpack("!H", ext)[0]
        elif payload_len == 127:
            ext = rfile.read(8)
            if len(ext) < 8:
                raise ConnectionError("EOF reading 64-bit length")
            payload_len = struct.unpack("!Q", ext)[0]

        mask_key = b""
        if masked:
            mask_key = rfile.read(4)
            if len(mask_key) < 4:
                raise ConnectionError("EOF reading mask key")

        payload = rfile.read(payload_len)
        if len(payload) < payload_len:
            raise ConnectionError("EOF reading payload")

        if masked:
            payload = bytes(b ^ mask_key[i % 4] for i, b in enumerate(payload))

        return opcode, payload

    except OSError as exc:
        raise ConnectionError(f"Socket error reading frame: {exc}") from exc


def _ws_send_frame(wfile, opcode: int, payload: bytes) -> None:
    """Write one WebSocket frame to *wfile* (server→client, NOT masked per RFC 6455)."""
    length = len(payload)
    # Byte 0: FIN=1, RSV=0, opcode
    frame = bytes([0x80 | opcode])

    if length <= 125:
        frame += bytes([length])
    elif length <= 0xFFFF:
        frame += bytes([126]) + struct.pack("!H", length)
    else:
        frame += bytes([127]) + struct.pack("!Q", length)

    frame += payload
    try:
        wfile.write(frame)
        wfile.flush()
    except OSError:
        pass  # caller's loop will detect the broken connection


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
        elif path == "/audio-input":
            self._serve_audio_input()
        else:
            self.send_error(404)

    def _serve_audio_input(self):
        """Handle a WebSocket upgrade request on /audio-input.

        Performs the RFC 6455 handshake, enforces single-client access via
        ``_audio_input_lock``, then enters the frame-reading loop.  On any
        disconnect or error the lock is released and the handler is notified.

        Validates: Requirements 1.1–1.5
        """
        global _audio_input_active

        # Complete the WebSocket handshake first so the client gets a proper
        # response regardless of whether we accept or reject the session.
        _ws_handshake(self)

        # Single-client enforcement: if the lock is already held, reject with
        # close code 1008 (Policy Violation) and return immediately.
        if not _audio_input_lock.acquire(blocking=False):
            _ws_send_frame(self.wfile, 0x8, struct.pack("!H", 1008))
            return

        _audio_input_active = True
        try:
            # Frame-reading loop (task 1.3)
            while True:
                try:
                    opcode, payload = _ws_read_frame(self.rfile)
                except ConnectionError:
                    # EOF or socket error — clean disconnect
                    break

                if opcode == 0x2:
                    # Binary frame — pass to audio handler
                    if _audio_input_handler is not None:
                        try:
                            _audio_input_handler.on_frame(payload)
                        except Exception as exc:
                            print(f"[audio-input] Handler error: {exc}")
                elif opcode == 0x8:
                    # Close frame — acknowledge and exit
                    _ws_send_frame(self.wfile, 0x8, b"")
                    break
                elif opcode == 0x9:
                    # Ping — respond with pong (opcode 0xA), same payload
                    _ws_send_frame(self.wfile, 0xA, payload)
                # All other opcodes are silently ignored

        except Exception as exc:
            print(f"[audio-input] Unhandled error in frame loop: {exc}")
            try:
                _ws_send_frame(self.wfile, 0x8, struct.pack("!H", 1011))
            except OSError:
                pass
        finally:
            _audio_input_active = False
            _audio_input_lock.release()
            if _audio_input_handler is not None:
                try:
                    _audio_input_handler.on_disconnect()
                except Exception as exc:
                    print(f"[audio-input] on_disconnect error: {exc}")

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

    # Initialise AudioInputHandler BEFORE starting the camera capture thread
    # so the handler is ready before any connections can arrive (task 1.5).
    global _audio_input_handler
    with ignore_stderr():
        _pa_instance = pyaudio.PyAudio()
    _audio_input_handler = AudioInputHandler(_pa_instance)
    print("[audio-input] AudioInputHandler ready.")

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
