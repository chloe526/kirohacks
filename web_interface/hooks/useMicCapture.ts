"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  AUDIO_RECONNECT_ATTEMPTS,
  AUDIO_RECONNECT_DELAY_MS,
} from "@/lib/constants";
import { ROBOT_STREAM_HOST, ROBOT_STREAM_PORT } from "@/lib/constants";

export type MicConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "permission-denied";

export interface UseMicCaptureResult {
  connectionState: MicConnectionState;
  isMuted: boolean;
  toggleMute: () => void;
  reconnectCount: number;
}

/**
 * useMicCapture
 *
 * Manages the doctor→robot audio channel:
 * - Requests microphone permission via getUserMedia
 * - Opens a WebSocket to ws://{robotHost}:{ROBOT_STREAM_PORT}/audio-input
 * - Encodes audio with MediaRecorder (audio/webm;codecs=opus, timeslice 200ms)
 * - Sends binary frames when unmuted and WS is open
 * - Retries on unexpected WS close (up to AUDIO_RECONNECT_ATTEMPTS)
 * - Cleans up all resources on deactivation or unmount
 * - Mock mode: skips WS/MediaRecorder, reports 'connected' + isMuted=true
 *
 * Validates: Requirements 2.1–2.10, 5.1–5.5, 6.1–6.2
 */
export function useMicCapture(
  robotHost: string | null,
  active: boolean
): UseMicCaptureResult {
  const [connectionState, setConnectionState] =
    useState<MicConnectionState>("idle");
  const [isMuted, setIsMuted] = useState(true); // starts muted per Req 2.6
  const [reconnectCount, setReconnectCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectCountRef = useRef(0);
  const exhaustedRef = useRef(false);
  const activeRef = useRef(active);
  const isMutedRef = useRef(true);

  const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      } catch {
        // ignore
      }
      mediaRecorderRef.current = null;
    }
    if (wsRef.current) {
      const ws = wsRef.current;
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      wsRef.current = null;
    }
    stopTracks();
  }, [stopTracks]);

  const scheduleRetry = useCallback(
    (openWs: () => void) => {
      if (!activeRef.current) return;
      const next = reconnectCountRef.current + 1;
      if (next > AUDIO_RECONNECT_ATTEMPTS) {
        exhaustedRef.current = true;
        stopTracks();
        setConnectionState("disconnected");
        return;
      }
      reconnectCountRef.current = next;
      setReconnectCount(next);
      setConnectionState("connecting");
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        if (activeRef.current && !exhaustedRef.current) openWs();
      }, AUDIO_RECONNECT_DELAY_MS);
    },
    [stopTracks]
  );

  const openWebSocket = useCallback(
    (stream: MediaStream) => {
      if (!activeRef.current || !robotHost) return;

      const url = `ws://${robotHost}:${ROBOT_STREAM_PORT}/audio-input`;
      setConnectionState("connecting");

      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        if (!activeRef.current) {
          ws.close();
          return;
        }
        setConnectionState("connected");
        reconnectCountRef.current = 0;
        setReconnectCount(0);
        exhaustedRef.current = false;

        // Initialise MediaRecorder
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : (() => {
              console.warn(
                "[useMicCapture] audio/webm;codecs=opus not supported, falling back to audio/webm"
              );
              return "audio/webm";
            })();

        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e: BlobEvent) => {
          if (
            !isMutedRef.current &&
            wsRef.current?.readyState === WebSocket.OPEN &&
            e.data.size > 0
          ) {
            wsRef.current.send(e.data);
          }
        };

        recorder.start(200); // timeslice 200ms per Req 2.3
      };

      ws.onclose = () => {
        if (!activeRef.current) {
          setConnectionState("disconnected");
          stopTracks();
          return;
        }
        // Stop recorder but keep stream alive for reconnect
        if (mediaRecorderRef.current) {
          try {
            if (mediaRecorderRef.current.state !== "inactive") {
              mediaRecorderRef.current.stop();
            }
          } catch {
            // ignore
          }
          mediaRecorderRef.current = null;
        }
        scheduleRetry(() => openWebSocket(stream));
      };

      ws.onerror = () => {
        // onclose follows onerror — retry logic lives there
      };
    },
    [robotHost, scheduleRetry, stopTracks]
  );

  const connect = useCallback(async () => {
    if (!activeRef.current || !robotHost) return;

    setConnectionState("connecting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: unknown) {
      const name = err instanceof Error ? (err as { name?: string }).name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setConnectionState("permission-denied");
      } else {
        console.error("[useMicCapture] getUserMedia error:", err);
        setConnectionState("disconnected");
      }
      return;
    }

    streamRef.current = stream;
    openWebSocket(stream);
  }, [robotHost, openWebSocket]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  useEffect(() => {
    // Mock mode: skip all browser APIs
    if (isMockMode) {
      if (active && robotHost) {
        setConnectionState("connected");
        setIsMuted(true);
        setReconnectCount(0);
      } else {
        setConnectionState("idle");
      }
      return;
    }

    if (!active || !robotHost) {
      cleanup();
      exhaustedRef.current = false;
      reconnectCountRef.current = 0;
      setReconnectCount(0);
      setConnectionState("idle");
      setIsMuted(true);
      return;
    }

    exhaustedRef.current = false;
    reconnectCountRef.current = 0;
    setReconnectCount(0);

    connect();

    return () => {
      cleanup();
    };
  }, [active, robotHost, isMockMode, connect, cleanup]);

  return { connectionState, isMuted, toggleMute, reconnectCount };
}
