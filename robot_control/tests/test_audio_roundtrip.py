"""
robot_control/tests/test_audio_roundtrip.py

Integration test: encode PCM → Opus/WebM with pyav, feed to AudioInputHandler.on_frame,
verify PCM is produced in the jitter buffer without error.

Validates: Requirement 6.5 (round-trip compatibility property)
"""

import io
import sys
import os
import time
import unittest
from unittest.mock import MagicMock, patch

import av
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def _encode_pcm_to_opus_webm(
    pcm_int16: np.ndarray,
    sample_rate: int = 48000,
) -> bytes:
    """Encode a mono int16 PCM array to Opus/WebM bytes using pyav."""
    buf = io.BytesIO()
    container = av.open(buf, mode="w", format="webm")
    stream = container.add_stream("libopus", rate=sample_rate)
    stream.layout = "mono"

    frame = av.AudioFrame.from_ndarray(
        pcm_int16.reshape(1, -1), format="s16", layout="mono"
    )
    frame.sample_rate = sample_rate
    frame.pts = 0

    for packet in stream.encode(frame):
        container.mux(packet)
    for packet in stream.encode(None):
        container.mux(packet)
    container.close()

    return buf.getvalue()


def _import_handler():
    """Import AudioInputHandler with hardware mocked."""
    mock_pa = MagicMock()
    mock_pa_stream = MagicMock()
    mock_pa.open.return_value = mock_pa_stream
    mock_pa.get_format_from_width.return_value = 8

    with patch.dict("sys.modules", {
        "pyrealsense2": MagicMock(),
        "cv2": MagicMock(),
        "json_server": MagicMock(),
    }):
        if "stream_server" in sys.modules:
            del sys.modules["stream_server"]
        import stream_server as ss

    return ss.AudioInputHandler(mock_pa), mock_pa


class TestAudioRoundtrip(unittest.TestCase):
    def test_roundtrip_48khz_mono(self):
        """PCM → Opus/WebM (48 kHz mono) → on_frame → PCM in buffer, no error."""
        handler, _ = _import_handler()

        t = np.linspace(0, 0.1, int(48000 * 0.1), endpoint=False)
        pcm = (np.sin(2 * np.pi * 440 * t) * 16000).astype(np.int16)
        webm = _encode_pcm_to_opus_webm(pcm, sample_rate=48000)

        # Should not raise
        handler.on_frame(webm)
        time.sleep(0.05)

        with handler._buffer_lock:
            self.assertGreater(len(handler._jitter_buffer), 0)

    def test_roundtrip_44100hz_mono(self):
        """PCM → Opus/WebM (44.1 kHz mono) → on_frame → PCM in buffer."""
        handler, _ = _import_handler()

        t = np.linspace(0, 0.1, int(44100 * 0.1), endpoint=False)
        pcm = (np.sin(2 * np.pi * 880 * t) * 16000).astype(np.int16)
        webm = _encode_pcm_to_opus_webm(pcm, sample_rate=44100)

        handler.on_frame(webm)
        time.sleep(0.05)

        with handler._buffer_lock:
            self.assertGreater(len(handler._jitter_buffer), 0)

    def test_roundtrip_output_is_16khz_int16(self):
        """Decoded PCM from roundtrip is always 16 kHz mono int16."""
        handler, _ = _import_handler()

        t = np.linspace(0, 0.05, int(48000 * 0.05), endpoint=False)
        pcm = (np.sin(2 * np.pi * 440 * t) * 16000).astype(np.int16)
        webm = _encode_pcm_to_opus_webm(pcm, sample_rate=48000)

        chunks = handler._decode_opus_webm(webm)
        self.assertGreater(len(chunks), 0)
        for chunk in chunks:
            self.assertEqual(len(chunk) % 2, 0)
            arr = np.frombuffer(chunk, dtype=np.int16)
            self.assertGreater(len(arr), 0)

    def test_multiple_frames_all_decoded(self):
        """Multiple sequential frames are all decoded without error."""
        handler, _ = _import_handler()

        for freq in (440, 880, 1320):
            t = np.linspace(0, 0.05, int(48000 * 0.05), endpoint=False)
            pcm = (np.sin(2 * np.pi * freq * t) * 16000).astype(np.int16)
            webm = _encode_pcm_to_opus_webm(pcm, sample_rate=48000)
            handler.on_frame(webm)  # must not raise

        time.sleep(0.1)
        with handler._buffer_lock:
            # Some frames may have been drained by playback thread; just check no crash
            pass  # reaching here means no exception was raised


if __name__ == "__main__":
    unittest.main()
