"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type MicState = "idle" | "requesting" | "active" | "error";

interface UseDocAudioResult {
  /** Whether the doctor's mic is currently capturing and streaming. */
  micState: MicState;
  /** Human-readable error message, set when micState === 'error'. */
  micError: string | null;
  /** Start capturing and streaming the doctor's microphone. */
  startMic: () => Promise<void>;
  /** Stop capturing and streaming. */
  stopMic: () => void;
}

/**
 * Target sample rate for the audio sent to the robot.
 * Must match SPEAKER_RATE in stream_server.py (16 kHz).
 */
const TARGET_SAMPLE_RATE = 16_000;

/**
 * How often MediaRecorder fires a `dataavailable` event (milliseconds).
 * Smaller = lower latency; 100 ms is a good balance between latency and
 * the per-request overhead of individual POSTs.
 */
const TIMESLICE_MS = 100;

/**
 * useDocAudio
 *
 * Captures the doctor's microphone via the Web Audio API, resamples to
 * 16 kHz mono signed-16-bit PCM, and streams chunks to the robot by
 * POSTing each timeslice to /api/v1/audio-input.
 *
 * The robot's stream_server.py receives the raw PCM and plays it through
 * its speaker via PyAudio.
 *
 * Resampling is done with an OfflineAudioContext so the robot always
 * receives 16 kHz regardless of the browser's native sample rate.
 *
 * Usage:
 *   const { micState, micError, startMic, stopMic } = useDocAudio(sessionActive);
 *
 * When `sessionActive` becomes false the mic is stopped automatically.
 */
export function useDocAudio(sessionActive: boolean): UseDocAudioResult {
  const [micState, setMicState] = useState<MicState>("idle");
  const [micError, setMicError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const activeRef = useRef(sessionActive);

  // Keep activeRef in sync without triggering re-renders
  useEffect(() => {
    activeRef.current = sessionActive;
  }, [sessionActive]);

  const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";

  /**
   * Resample a Float32 mono buffer from `sourceSampleRate` to `TARGET_SAMPLE_RATE`
   * using an OfflineAudioContext, then convert to signed-16-bit PCM bytes.
   */
  const resampleToPCM = useCallback(
    async (float32: Float32Array, sourceSampleRate: number): Promise<ArrayBuffer> => {
      const sourceDuration = float32.length / sourceSampleRate;
      const targetLength = Math.ceil(sourceDuration * TARGET_SAMPLE_RATE);

      const offlineCtx = new OfflineAudioContext(1, targetLength, TARGET_SAMPLE_RATE);

      // Create an AudioBuffer at the source rate and fill it
      const srcBuffer = offlineCtx.createBuffer(1, float32.length, sourceSampleRate);
      srcBuffer.copyToChannel(float32, 0);

      const source = offlineCtx.createBufferSource();
      source.buffer = srcBuffer;
      source.connect(offlineCtx.destination);
      source.start(0);

      const rendered = await offlineCtx.startRendering();
      const resampled = rendered.getChannelData(0);

      // Convert Float32 [-1, 1] → Int16 [-32768, 32767]
      const pcm = new Int16Array(resampled.length);
      for (let i = 0; i < resampled.length; i++) {
        const clamped = Math.max(-1, Math.min(1, resampled[i]));
        pcm[i] = clamped < 0 ? clamped * 32768 : clamped * 32767;
      }
      return pcm.buffer;
    },
    []
  );

  /**
   * Send a PCM ArrayBuffer to the robot proxy. Fire-and-forget — errors are
   * swallowed so a single failed chunk doesn't interrupt the stream.
   */
  const sendChunk = useCallback(async (pcm: ArrayBuffer): Promise<void> => {
    try {
      await fetch("/api/v1/audio-input", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: pcm,
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // Silently ignore — individual chunk failures are acceptable
    }
  }, []);

  /**
   * Process a Blob from MediaRecorder: decode → resample → send as PCM.
   */
  const processBlob = useCallback(
    async (blob: Blob): Promise<void> => {
      if (blob.size === 0) return;
      try {
        const arrayBuffer = await blob.arrayBuffer();

        // Decode the compressed audio (WebM/Opus or whatever the browser chose)
        const audioCtx = new AudioContext();
        let decoded: AudioBuffer;
        try {
          decoded = await audioCtx.decodeAudioData(arrayBuffer);
        } finally {
          audioCtx.close();
        }

        // Mix down to mono (average all channels)
        const numChannels = decoded.numberOfChannels;
        const length = decoded.length;
        const mono = new Float32Array(length);
        for (let ch = 0; ch < numChannels; ch++) {
          const channelData = decoded.getChannelData(ch);
          for (let i = 0; i < length; i++) {
            mono[i] += channelData[i] / numChannels;
          }
        }

        const pcm = await resampleToPCM(mono, decoded.sampleRate);
        await sendChunk(pcm);
      } catch {
        // Silently ignore decode/resample errors for individual chunks
      }
    },
    [resampleToPCM, sendChunk]
  );

  const stopMic = useCallback(() => {
    if (recorderRef.current) {
      if (recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      recorderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setMicState("idle");
    setMicError(null);
  }, []);

  const startMic = useCallback(async () => {
    if (isMockMode) {
      setMicState("active");
      return;
    }

    if (typeof window === "undefined") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError("Microphone access is not supported in this browser.");
      setMicState("error");
      return;
    }

    setMicState("requesting");
    setMicError(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: TARGET_SAMPLE_RATE,
          channelCount: 1,
        },
      });
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone permission denied."
          : "Could not access microphone.";
      setMicError(msg);
      setMicState("error");
      return;
    }

    streamRef.current = stream;

    // Pick the best supported MIME type
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg"].find(
      (t) => MediaRecorder.isTypeSupported(t)
    ) ?? "";

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0 && activeRef.current) {
        processBlob(e.data);
      }
    };

    recorder.onerror = () => {
      setMicError("Microphone recording error.");
      setMicState("error");
      stopMic();
    };

    recorder.onstop = () => {
      // Only transition to idle if we weren't already in error state
      setMicState((prev) => (prev === "error" ? prev : "idle"));
    };

    recorder.start(TIMESLICE_MS);
    setMicState("active");
  }, [isMockMode, processBlob, stopMic]);

  // Stop mic automatically when the session ends
  useEffect(() => {
    if (!sessionActive) {
      stopMic();
    }
  }, [sessionActive, stopMic]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMic();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { micState, micError, startMic, stopMic };
}
