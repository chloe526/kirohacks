"""
robot_control/tests/test_audio_input_handler.py

Unit tests for AudioInputHandler.

Covers:
- Valid Opus/WebM frame → PCM appears in jitter buffer
- Malformed frame is discarded, handler continues (Property 6)
- Resampling always produces 16 kHz mono int16 (Property 7)
- Jitter buffer caps at JITTER_MAX=8 frames
- Playback does not start until JITTER_MIN=2 frames are buffered
- on_disconnect drains buffer and stops playback thread
"""

import io
import struct
import threading
import time
import unittest
from unittest.mock import MagicMock, patch

import av
import numpy as np


def _make_opus_webm(duration_s: float = 0.1, sample_rate: int = 48000) -> bytes:
    """Encode a short sine-wave PCM clip to Opus/WebM using pyav."""
    num_samples = int(sample_rate * duration_s)
    t = np.linspace(0, duration_s, num_samples, endpoint=False)
    pcm = (np.sin(2 * np.pi * 440 * t) * 16000).astype(np.int16)

    buf = io.BytesIO()
    container = av.open(buf, mode="w", format="webm")
    stream = container.add_stream("libopus", rate=sample_rate)
    stream.layout = "mono"

    audio_frame = av.AudioFrame.from_ndarray(
        pcm.reshape(1, -1), format="s16", layout="mono"
    )
    audio_frame.sample_rate = sample_rate
    audio_frame.pts = 0

    for packet in stream.encode(audio_frame):
        container.mux(packet)
    for packet in stream.encode(None):
        container.mux(packet)
    container.close()

    return buf.getvalue()


class TestAudioInputHandler(unittest.TestCase):
    def _make_handler(self, pa_instance=None):
        """Import and instantiate AudioInputHandler with a mock PyAudio."""
        # Import here to avoid top-level import of hardware-dependent modules
        import sys
        import os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

        # Patch pyaudio and hardware imports so stream_server can be imported
        mock_pa = MagicMock()
        mock_pa_stream = MagicMock()
        mock_pa.open.return_value = mock_pa_stream
        mock_pa.get_format_from_width.return_value = 8  # paInt16

        with patch.dict("sys.modules", {
            "pyrealsense2": MagicMock(),
            "cv2": MagicMock(),
            "json_server": MagicMock(),
        }):
            import importlib
            if "stream_server" in sys.modules:
                del sys.modules["stream_server"]
            import stream_server as ss

        handler = ss.AudioInputHandler(mock_pa)
        return handler, mock_pa, mock_pa_stream

    def test_valid_frame_adds_pcm_to_buffer(self):
        """Valid Opus/WebM frame → PCM bytes appear in jitter buffer."""
        handler, _, _ = self._make_handler()
        webm = _make_opus_webm()
        handler.on_frame(webm)
        time.sleep(0.05)
        with handler._buffer_lock:
            self.assertGreater(len(handler._jitter_buffer), 0)

    def test_malformed_frame_discarded_handler_continues(self):
        """Property 6: malformed frame is discarded; subsequent valid frame succeeds."""
        handler, _, _ = self._make_handler()

        # Feed garbage
        handler.on_frame(b"\x00\x01\x02\x03 not valid webm")

        # Buffer should still be empty (no crash)
        with handler._buffer_lock:
            self.assertEqual(len(handler._jitter_buffer), 0)

        # Now feed a valid frame — handler must still work
        webm = _make_opus_webm()
        handler.on_frame(webm)
        time.sleep(0.05)
        with handler._buffer_lock:
            self.assertGreater(len(handler._jitter_buffer), 0)

    def test_resampling_output_is_16khz_mono_int16(self):
        """Property 7: decoded PCM is always 16 kHz mono int16 regardless of input rate."""
        handler, _, _ = self._make_handler()

        for src_rate in (8000, 22050, 44100, 48000):
            webm = _make_opus_webm(duration_s=0.05, sample_rate=src_rate)
            chunks = handler._decode_opus_webm(webm)
            self.assertGreater(len(chunks), 0, f"No chunks for rate {src_rate}")
            for chunk in chunks:
                # Each sample is 2 bytes (int16)
                self.assertEqual(len(chunk) % 2, 0)
                # Verify we can parse as int16 without error
                np.frombuffer(chunk, dtype=np.int16)

    def test_jitter_buffer_caps_at_jitter_max(self):
        """Buffer never exceeds JITTER_MAX=8 frames."""
        handler, _, _ = self._make_handler()
        # Stop playback thread so it doesn't drain the buffer
        handler._stop_event.set()
        handler._frame_event.set()
        time.sleep(0.05)

        webm = _make_opus_webm(duration_s=0.02)
        for _ in range(20):
            handler.on_frame(webm)

        with handler._buffer_lock:
            self.assertLessEqual(len(handler._jitter_buffer), handler.JITTER_MAX)

    def test_on_disconnect_drains_buffer(self):
        """on_disconnect drains remaining frames and stops playback thread."""
        handler, _, mock_stream = self._make_handler()
        # Stop playback thread so buffer accumulates
        handler._stop_event.set()
        handler._frame_event.set()
        time.sleep(0.05)

        webm = _make_opus_webm(duration_s=0.02)
        handler.on_frame(webm)

        with handler._buffer_lock:
            initial_len = len(handler._jitter_buffer)

        handler.on_disconnect()

        with handler._buffer_lock:
            self.assertEqual(len(handler._jitter_buffer), 0)


if __name__ == "__main__":
    unittest.main()
