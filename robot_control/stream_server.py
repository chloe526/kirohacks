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
DEFAULT_DEVICE_INDEX = 0
DEFAULT_PROFILE_INDEX = 186  # -1 = highest resolution
JPEG_QUALITY = 80           # 0-100; lower = smaller payload

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
# RealSense camera initialization
# ---------------------------------------------------------------------------

def initialize_camera(
    device_index: int = 0,
    profile_index: int = -1,
) -> tuple[rs.pipeline, int, int, int] | None:
    """
    Detect a RealSense device, enumerate its color profiles, and start the
    pipeline.  Returns (pipeline, width, height, fps) on success, or None.

    profile_index: index into the resolution-sorted profile list.
                   -1 (default) picks the highest resolution.
    """
    ctx = rs.context()
    devices = list(ctx.query_devices())

    if not devices:
        print("[video] No RealSense devices detected.")
        return None

    if device_index >= len(devices):
        print(
            f"[video] Device index {device_index} out of range. "
            f"Found {len(devices)} device(s)."
        )
        return None

    device = devices[device_index]
    serial = device.get_info(rs.camera_info.serial_number)

    # Enumerate available color profiles
    profiles: set[tuple[int, int, int, rs.format]] = set()
    for sensor in device.sensors:
        for profile in sensor.get_stream_profiles():
            if profile.stream_type() != rs.stream.color:
                continue
            try:
                fmt = profile.format()
                vprofile = profile.as_video_stream_profile()
                profiles.add((vprofile.width(), vprofile.height(), vprofile.fps(), fmt))
            except RuntimeError:
                continue

    sorted_profiles = sorted(
        profiles, key=lambda x: (x[0] * x[1], x[2], str(x[3]))
    )

    if not sorted_profiles:
        print("[video] No color stream profiles found for the selected device.")
        return None

    # Resolve profile index (-1 = last = highest resolution)
    if profile_index < 0:
        profile_index = len(sorted_profiles) - 1

    if profile_index >= len(sorted_profiles):
        print(
            f"[video] Profile index {profile_index} out of range. "
            f"Found {len(sorted_profiles)} profile(s)."
        )
        return None

    target_width, target_height, target_fps, target_fmt = sorted_profiles[profile_index]

    pipeline = rs.pipeline()
    config = rs.config()
    config.enable_device(serial)
    config.enable_stream(
        rs.stream.color,
        target_width,
        target_height,
        target_fmt,
        target_fps,
    )

    try:
        pipeline.start(config)
    except RuntimeError as exc:
        print(
            f"[video] Failed to start stream at {target_width}x{target_height}"
            f"@{target_fps}, format={target_fmt}: {exc}"
        )
        return None

    print(
        f"[video] Camera initialized: {target_width}x{target_height}"
        f"@{target_fps} (device {device_index}, profile {profile_index})"
    )
    return pipeline, target_width, target_height, target_fps


# ---------------------------------------------------------------------------
# Video streaming thread
# ---------------------------------------------------------------------------

def video_server(
    host: str,
    port: int,
    stop_event: threading.Event,
    device_index: int = 0,
    profile_index: int = -1,
) -> None:
    """
    Accepts a single client connection and continuously sends JPEG-encoded
    color frames from the RealSense camera.
    """
    result = initialize_camera(device_index, profile_index)
    if result is None:
        print("[video] Camera init failed — video streaming disabled.")
        return

    pipeline, width, height, fps = result

    server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server_sock.bind((host, port))
    server_sock.listen(1)
    server_sock.settimeout(1.0)

    print(f"[video] Listening on {host}:{port}")

    try:
        while not stop_event.is_set():
            # ---- accept a client ----
            try:
                conn, addr = server_sock.accept()
            except socket.timeout:
                # Drain frames so the pipeline doesn't stall
                try:
                    pipeline.wait_for_frames(timeout_ms=50)
                except RuntimeError:
                    pass
                continue

            conn.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            conn.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, 1024 * 1024)
            print(f"[video] Client connected from {addr}")

            # ---- stream to this client until it disconnects ----
            try:
                while not stop_event.is_set():
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

                    send_frame(conn, jpeg.tobytes())
            except (BrokenPipeError, ConnectionResetError, OSError):
                print("[video] Client disconnected.")
            finally:
                conn.close()

    finally:
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

    # Find a usable input device
    input_device_index = None
    for i in range(pa.get_device_count()):
        info = pa.get_device_info_by_index(i)
        if info.get("maxInputChannels", 0) > 0:
            input_device_index = i
            print(f"[audio] Using input device {i}: {info['name']}")
            break

    if input_device_index is None:
        print("[audio] No input device found — audio streaming disabled.")
        pa.terminate()
        return

    try:
        stream = pa.open(
            format=AUDIO_FORMAT,
            channels=AUDIO_CHANNELS,
            rate=AUDIO_RATE,
            input=True,
            input_device_index=input_device_index,
            frames_per_buffer=AUDIO_CHUNK,
        )
    except OSError as exc:
        print(f"[audio] Failed to open audio stream: {exc} — audio streaming disabled.")
        pa.terminate()
        return

    server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server_sock.bind((host, port))
    server_sock.listen(1)
    server_sock.settimeout(1.0)

    print(f"[audio] Listening on {host}:{port}")

    try:
        while not stop_event.is_set():
            # ---- accept a client ----
            try:
                conn, addr = server_sock.accept()
            except socket.timeout:
                # Drain mic buffer so it doesn't grow stale
                try:
                    stream.read(AUDIO_CHUNK, exception_on_overflow=False)
                except OSError:
                    pass
                continue

            conn.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            print(f"[audio] Client connected from {addr}")

            # ---- stream to this client until it disconnects ----
            try:
                while not stop_event.is_set():
                    chunk = stream.read(AUDIO_CHUNK, exception_on_overflow=False)
                    send_frame(conn, chunk)
            except (BrokenPipeError, ConnectionResetError, OSError):
                print("[audio] Client disconnected.")
            finally:
                conn.close()

    finally:
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
    parser.add_argument("--device-index", type=int, default=DEFAULT_DEVICE_INDEX,
                        help="RealSense device index (default: 0)")
    parser.add_argument("--profile-index", type=int, default=DEFAULT_PROFILE_INDEX,
                        help="Color stream profile index, sorted by resolution. "
                             "-1 = highest (default: -1)")
    args = parser.parse_args()

    stop_event = threading.Event()

    video_thread = threading.Thread(
        target=video_server,
        args=(args.host, args.video_port, stop_event, args.device_index, args.profile_index),
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
