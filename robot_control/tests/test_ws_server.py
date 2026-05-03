"""
robot_control/tests/test_ws_server.py

Unit tests for the WebSocket server infrastructure in stream_server.py.

Covers:
- Single-client enforcement: second connection rejected with close code 1008
- Reconnect after disconnect is accepted (Property 9)
- Unrecoverable error in frame loop does not terminate server process
"""

import io
import struct
import sys
import os
import threading
import time
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def _import_stream_server():
    """Import stream_server with hardware dependencies mocked out."""
    with patch.dict("sys.modules", {
        "pyrealsense2": MagicMock(),
        "cv2": MagicMock(),
        "json_server": MagicMock(),
        "pyaudio": MagicMock(),
        "av": MagicMock(),
        "numpy": MagicMock(),
    }):
        if "stream_server" in sys.modules:
            del sys.modules["stream_server"]
        import stream_server as ss
    return ss


def _make_ws_frame(opcode: int, payload: bytes, masked: bool = True) -> bytes:
    """Build a minimal RFC 6455 frame (client→server, masked)."""
    length = len(payload)
    mask_bit = 0x80 if masked else 0x00
    frame = bytes([0x80 | opcode])  # FIN + opcode

    if length <= 125:
        frame += bytes([mask_bit | length])
    elif length <= 0xFFFF:
        frame += bytes([mask_bit | 126]) + struct.pack("!H", length)
    else:
        frame += bytes([mask_bit | 127]) + struct.pack("!Q", length)

    if masked:
        mask_key = b"\x00\x00\x00\x00"  # trivial mask for testing
        frame += mask_key
        frame += bytes(b ^ mask_key[i % 4] for i, b in enumerate(payload))
    else:
        frame += payload

    return frame


class TestWsHandshake(unittest.TestCase):
    def test_handshake_sends_101(self):
        """_ws_handshake sends 101 Switching Protocols with correct headers."""
        ss = _import_stream_server()

        mock_handler = MagicMock()
        mock_handler.headers = {"Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ=="}

        ss._ws_handshake(mock_handler)

        mock_handler.send_response.assert_called_once_with(101, "Switching Protocols")
        calls = {c[0][0]: c[0][1] for c in mock_handler.send_header.call_args_list}
        self.assertEqual(calls.get("Upgrade"), "websocket")
        self.assertEqual(calls.get("Connection"), "Upgrade")
        # RFC 6455 expected accept for the sample key
        self.assertEqual(calls.get("Sec-WebSocket-Accept"), "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=")


class TestSingleClientEnforcement(unittest.TestCase):
    def test_second_connection_rejected_with_1008(self):
        """Second WS client gets close frame with code 1008 (Property 9 prerequisite)."""
        ss = _import_stream_server()

        # Acquire the lock to simulate an active client
        ss._audio_input_lock.acquire()
        try:
            sent_frames = []

            mock_handler = MagicMock()
            mock_handler.headers = {"Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ=="}
            mock_handler.wfile = MagicMock()
            mock_handler.wfile.write = lambda data: sent_frames.append(data)
            mock_handler.wfile.flush = MagicMock()
            mock_handler.rfile = io.BytesIO(b"")

            ss._serve_audio_input(mock_handler)

            # Should have sent a close frame with code 1008
            self.assertTrue(len(sent_frames) > 0)
            # Find the close frame (opcode 0x8)
            found_1008 = False
            for frame in sent_frames:
                if len(frame) >= 4 and (frame[0] & 0x0F) == 0x8:
                    code = struct.unpack("!H", frame[2:4])[0]
                    if code == 1008:
                        found_1008 = True
                        break
            self.assertTrue(found_1008, "Expected close frame with code 1008")
        finally:
            ss._audio_input_lock.release()

    def test_reconnect_after_disconnect_accepted(self):
        """Property 9: after a client disconnects, the next connection is accepted."""
        ss = _import_stream_server()

        # Ensure lock is free
        if ss._audio_input_lock.locked():
            ss._audio_input_lock.release()

        # Simulate a client that sends a close frame immediately
        close_frame = _make_ws_frame(0x8, struct.pack("!H", 1000))
        rfile = io.BytesIO(close_frame)

        mock_handler = MagicMock()
        mock_handler.headers = {"Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ=="}
        mock_handler.wfile = MagicMock()
        mock_handler.wfile.write = MagicMock()
        mock_handler.wfile.flush = MagicMock()
        mock_handler.rfile = rfile

        ss._audio_input_handler = MagicMock()
        ss._serve_audio_input(mock_handler)

        # Lock must be released after disconnect
        self.assertFalse(ss._audio_input_lock.locked())

        # Second connection should be accepted (lock not held)
        acquired = ss._audio_input_lock.acquire(blocking=False)
        self.assertTrue(acquired, "Lock should be free after disconnect")
        if acquired:
            ss._audio_input_lock.release()


class TestFrameLoopResilience(unittest.TestCase):
    def test_server_survives_frame_loop_exception(self):
        """Unhandled exception in frame loop does not propagate (server stays alive)."""
        ss = _import_stream_server()

        if ss._audio_input_lock.locked():
            ss._audio_input_lock.release()

        # rfile that raises on read to simulate an unrecoverable error
        class BrokenRFile:
            def read(self, n):
                raise OSError("simulated socket error")

        mock_handler = MagicMock()
        mock_handler.headers = {"Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ=="}
        mock_handler.wfile = MagicMock()
        mock_handler.wfile.write = MagicMock()
        mock_handler.wfile.flush = MagicMock()
        mock_handler.rfile = BrokenRFile()

        ss._audio_input_handler = MagicMock()

        # Should not raise
        try:
            ss._serve_audio_input(mock_handler)
        except Exception as exc:
            self.fail(f"_serve_audio_input raised unexpectedly: {exc}")

        # Lock must be released
        self.assertFalse(ss._audio_input_lock.locked())


# Patch _serve_audio_input as a standalone function for testing
def _patch_serve(ss, handler):
    """Call _serve_audio_input as a standalone function using the handler."""
    # Temporarily bind the method
    import types
    bound = types.MethodType(ss.StreamHandler._serve_audio_input, handler)
    bound()


if __name__ == "__main__":
    unittest.main()
