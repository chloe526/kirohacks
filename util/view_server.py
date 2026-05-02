"""
util/server.py

Bridge server that connects to the robot's TCP video/audio streams and
re-serves them over HTTP so any browser on the network can view them.

  Video  -> MJPEG stream  at  GET /video
  Audio  -> WAV stream    at  GET /audio
  UI     -> HTML page     at  GET /

Usage:
  python server.py --robot-host <ROBOT_IP> [--robot-video-port 9000]
                   [--robot-audio-port 9001] [--http-port 8080]

Then open  http://<this-machine-ip>:8080  in a browser on any device.
"""

import argparse
import socket
import struct
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# ---------------------------------------------------------------------------
# Config defaults
# ---------------------------------------------------------------------------
DEFAULT_ROBOT_HOST = "127.0.0.1"
DEFAULT_VIDEO_PORT = 9000
DEFAULT_AUDIO_PORT = 9001
DEFAULT_HTTP_PORT = 8080

RECONNECT_DELAY = 2.0   # seconds between reconnect attempts

# Audio params must match robot_control/stream_server.py (mono output after extraction)
AUDIO_RATE = 16000
AUDIO_CHANNELS = 1
AUDIO_SAMPLE_WIDTH = 2  # int16 = 2 bytes

# ---------------------------------------------------------------------------
# Shared state
# ---------------------------------------------------------------------------
latest_jpeg: bytes = b""
jpeg_lock = threading.Lock()
jpeg_event = threading.Event()

audio_chunks: list[bytes] = []
audio_lock = threading.Lock()
audio_event = threading.Event()


# ---------------------------------------------------------------------------
# TCP helpers
# ---------------------------------------------------------------------------

def recv_exact(sock: socket.socket, n: int) -> bytes:
    """Read exactly n bytes from sock, raising EOFError on disconnect."""
    buf = bytearray()
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            raise EOFError("Socket closed")
        buf.extend(chunk)
    return bytes(buf)


def recv_frame(sock: socket.socket) -> bytes:
    """Read one length-prefixed frame."""
    header = recv_exact(sock, 4)
    length = struct.unpack(">I", header)[0]
    return recv_exact(sock, length)


# ---------------------------------------------------------------------------
# Background threads that pull data from the robot
# ---------------------------------------------------------------------------

def video_reader(host: str, port: int, stop: threading.Event) -> None:
    global latest_jpeg
    while not stop.is_set():
        sock = None
        try:
            sock = socket.create_connection((host, port), timeout=5)
            sock.settimeout(10.0)  # recv timeout
            print(f"[video-reader] Connected to {host}:{port}")
            while not stop.is_set():
                frame = recv_frame(sock)
                with jpeg_lock:
                    latest_jpeg = frame
                jpeg_event.set()
        except (OSError, EOFError) as exc:
            print(f"[video-reader] {exc} — reconnecting in {RECONNECT_DELAY}s")
        finally:
            if sock:
                try:
                    sock.close()
                except OSError:
                    pass
        time.sleep(RECONNECT_DELAY)


def audio_reader(host: str, port: int, stop: threading.Event) -> None:
    while not stop.is_set():
        sock = None
        try:
            sock = socket.create_connection((host, port), timeout=5)
            sock.settimeout(10.0)  # recv timeout
            print(f"[audio-reader] Connected to {host}:{port}")
            while not stop.is_set():
                chunk = recv_frame(sock)
                with audio_lock:
                    audio_chunks.append(chunk)
                    # Keep buffer bounded (~2 s of audio)
                    max_chunks = int(AUDIO_RATE / 1024 * 2)
                    if len(audio_chunks) > max_chunks:
                        audio_chunks.pop(0)
                audio_event.set()
        except (OSError, EOFError) as exc:
            print(f"[audio-reader] {exc} — reconnecting in {RECONNECT_DELAY}s")
        finally:
            if sock:
                try:
                    sock.close()
                except OSError:
                    pass
        time.sleep(RECONNECT_DELAY)


# ---------------------------------------------------------------------------
# WAV header helper (for streaming audio)
# ---------------------------------------------------------------------------

def wav_header(data_size: int = 0x7FFFFFFF) -> bytes:
    """
    Build a minimal WAV header for streaming.
    data_size defaults to max so the browser treats it as a live stream.
    """
    byte_rate = AUDIO_RATE * AUDIO_CHANNELS * AUDIO_SAMPLE_WIDTH
    block_align = AUDIO_CHANNELS * AUDIO_SAMPLE_WIDTH
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        36 + data_size,
        b"WAVE",
        b"fmt ",
        16,             # PCM chunk size
        1,              # PCM format
        AUDIO_CHANNELS,
        AUDIO_RATE,
        byte_rate,
        block_align,
        AUDIO_SAMPLE_WIDTH * 8,
        b"data",
        data_size,
    )
    return header


# ---------------------------------------------------------------------------
# HTTP request handler
# ---------------------------------------------------------------------------

HTML_FILE = Path(__file__).parent / "index.html"


class StreamHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # suppress default access log noise
        pass

    def do_GET(self):
        # Strip query string for routing
        path = self.path.split("?")[0]
        if path == "/":
            self._serve_html()
        elif path == "/video":
            self._serve_mjpeg()
        elif path == "/audio":
            self._serve_audio()
        else:
            self.send_error(404)

    # -- HTML page -----------------------------------------------------------

    def _serve_html(self):
        html = HTML_FILE.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(html)))
        self.end_headers()
        self.wfile.write(html)

    # -- MJPEG stream --------------------------------------------------------

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
                boundary = (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(len(frame)).encode() + b"\r\n\r\n"
                )
                self.wfile.write(boundary + frame + b"\r\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass  # client disconnected

    # -- Audio stream --------------------------------------------------------

    def _serve_audio(self):
        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Transfer-Encoding", "chunked")
        self.end_headers()
        try:
            self.wfile.write(wav_header())
            self.wfile.flush()
            while True:
                audio_event.wait(timeout=2.0)
                audio_event.clear()
                with audio_lock:
                    chunks = list(audio_chunks)
                    audio_chunks.clear()
                for chunk in chunks:
                    self.wfile.write(chunk)
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Robot stream viewer bridge")
    parser.add_argument("--robot-host", default=DEFAULT_ROBOT_HOST)
    parser.add_argument("--robot-video-port", type=int, default=DEFAULT_VIDEO_PORT)
    parser.add_argument("--robot-audio-port", type=int, default=DEFAULT_AUDIO_PORT)
    parser.add_argument("--http-port", type=int, default=DEFAULT_HTTP_PORT)
    args = parser.parse_args()

    stop = threading.Event()

    threading.Thread(
        target=video_reader,
        args=(args.robot_host, args.robot_video_port, stop),
        daemon=True,
    ).start()

    threading.Thread(
        target=audio_reader,
        args=(args.robot_host, args.robot_audio_port, stop),
        daemon=True,
    ).start()

    httpd = ThreadingHTTPServer(("0.0.0.0", args.http_port), StreamHandler)
    print(f"Viewer running at http://0.0.0.0:{args.http_port}")
    print(f"Connecting to robot at {args.robot_host} (video:{args.robot_video_port} audio:{args.robot_audio_port})")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        stop.set()


if __name__ == "__main__":
    main()
