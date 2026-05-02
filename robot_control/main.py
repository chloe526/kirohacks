"""
robot_control/main.py

Captures RGB video from an Intel RealSense camera and microphone audio,
then streams both over TCP sockets to a remote client.

Ports:
  VIDEO_PORT  - compressed JPEG frames (color)
  AUDIO_PORT  - raw PCM audio chunks

Usage:
  python main.py [--host 0.0.0.0] [--video-port 9000] [--audio-port 9001]
"""

import argparse
import socket
import struct
import threading
import time

import cv2
import numpy as np
import pyaudio
import pyrealsense2 as rs

# ---------------------------------------------------------------------------
# Default configuration
# ---------------------------------------------------------------------------
DEFAULT_HOST = "0.0.0.0"
DEFAULT_VIDEO_PORT = 9000
DEFAULT_AUDIO_PORT = 9001

# Video
COLOR_WIDTH = 1920
COLOR_HEIGHT = 1080
FPS = 30
JPEG_QUALITY = 80          # 0-100; lower = smaller payload

# Audio
AUDIO_RATE = 44100
AUDIO_CHANNELS = 1
AUDIO_FORMAT = pyaudio.paInt16
AUDIO_CHUNK = 1024          # frames per buffer


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def send_frame(conn: socket.socket, data: bytes) -> None:
    """Prefix each message with a 4-byte big-endian length header."""
    header = struct.pack(">I", len(data))
    conn.sendall(header + data)


# ---------------------------------------------------------------------------
# Video streaming thread
# ---------------------------------------------------------------------------

def video_server(host: str, port: int, stop_event: threading.Event) -> None:
    """
    Accepts a single client connection and continuously sends JPEG-encoded
    color frames from the RealSense camera.
    """
    # Configure RealSense pipeline (color only)
    pipeline = rs.pipeline()
    config = rs.config()
    config.enable_stream(rs.stream.color, COLOR_WIDTH, COLOR_HEIGHT, rs.format.bgr8, FPS)
    pipeline.start(config)

    server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server_sock.bind((host, port))
    server_sock.listen(1)
    server_sock.settimeout(1.0)

    print(f"[video] Listening on {host}:{port}")

    conn = None
    try:
        while not stop_event.is_set():
            # Wait for a client
            if conn is None:
                try:
                    conn, addr = server_sock.accept()
                    conn.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
                    print(f"[video] Client connected from {addr}")
                except socket.timeout:
                    continue

            # Grab frames
            try:
                frames = pipeline.wait_for_frames(timeout_ms=5000)
            except RuntimeError as exc:
                print(f"[video] Frame timeout: {exc}")
                continue

            color_frame = frames.get_color_frame()
            if not color_frame:
                continue

            color_image = np.asanyarray(color_frame.get_data())

            ret, jpeg = cv2.imencode(
                ".jpg", color_image, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY]
            )
            if not ret:
                continue

            try:
                send_frame(conn, jpeg.tobytes())
            except (BrokenPipeError, ConnectionResetError, OSError):
                print("[video] Client disconnected.")
                conn.close()
                conn = None

    finally:
        if conn:
            conn.close()
        server_sock.close()
        pipeline.stop()
        print("[video] Server shut down.")


# ---------------------------------------------------------------------------
# Audio streaming thread
# ---------------------------------------------------------------------------

def audio_server(host: str, port: int, stop_event: threading.Event) -> None:
    """
    Accepts a single client connection and continuously sends raw PCM audio
    chunks captured from the default microphone.
    """
    pa = pyaudio.PyAudio()
    stream = pa.open(
        format=AUDIO_FORMAT,
        channels=AUDIO_CHANNELS,
        rate=AUDIO_RATE,
        input=True,
        frames_per_buffer=AUDIO_CHUNK,
    )

    server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server_sock.bind((host, port))
    server_sock.listen(1)
    server_sock.settimeout(1.0)

    print(f"[audio] Listening on {host}:{port}")

    conn = None
    try:
        while not stop_event.is_set():
            if conn is None:
                try:
                    conn, addr = server_sock.accept()
                    conn.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
                    print(f"[audio] Client connected from {addr}")
                except socket.timeout:
                    continue

            try:
                chunk = stream.read(AUDIO_CHUNK, exception_on_overflow=False)
                send_frame(conn, chunk)
            except (BrokenPipeError, ConnectionResetError, OSError):
                print("[audio] Client disconnected.")
                conn.close()
                conn = None
            except OSError as exc:
                print(f"[audio] Read error: {exc}")
                time.sleep(0.01)

    finally:
        if conn:
            conn.close()
        server_sock.close()
        stream.stop_stream()
        stream.close()
        pa.terminate()
        print("[audio] Server shut down.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="RealSense + audio socket streamer")
    parser.add_argument("--host", default=DEFAULT_HOST, help="Bind address")
    parser.add_argument("--video-port", type=int, default=DEFAULT_VIDEO_PORT)
    parser.add_argument("--audio-port", type=int, default=DEFAULT_AUDIO_PORT)
    args = parser.parse_args()

    stop_event = threading.Event()

    video_thread = threading.Thread(
        target=video_server,
        args=(args.host, args.video_port, stop_event),
        daemon=True,
        name="video-server",
    )
    audio_thread = threading.Thread(
        target=audio_server,
        args=(args.host, args.audio_port, stop_event),
        daemon=True,
        name="audio-server",
    )

    video_thread.start()
    audio_thread.start()

    print("Streaming server running. Press Ctrl+C to stop.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down...")
        stop_event.set()

    video_thread.join(timeout=5)
    audio_thread.join(timeout=5)
    print("Done.")


if __name__ == "__main__":
    main()
