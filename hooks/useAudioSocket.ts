"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  AUDIO_RECONNECT_ATTEMPTS,
  AUDIO_RECONNECT_DELAY_MS,
} from "@/lib/constants";

type ConnectionState = "connecting" | "connected" | "disconnected";

interface UseAudioSocketResult {
  connectionState: ConnectionState;
  isMuted: boolean;
  toggleMute: () => void;
  reconnectCount: number;
}

/**
 * Creates and returns a new AudioContext, or null if the Web Audio API is
 * unavailable (e.g. in a test/SSR environment).
 */
function createAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextClass =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  return new AudioContextClass();
}

/**
 * useAudioSocket
 *
 * Manages a WebSocket connection to the audio stream for a session, and pipes
 * incoming binary frames to a Web Audio API AudioContext for playback.
 *
 * - When `active` is true and `sessionId` is non-null, opens a WebSocket at
 *   `wss://{host}/api/v1/sessions/{sessionId}/audio`.
 * - Exposes `connectionState`, `isMuted`, `toggleMute()`, and `reconnectCount`.
 * - On close/error: retries up to `AUDIO_RECONNECT_ATTEMPTS` times with
 *   `AUDIO_RECONNECT_DELAY_MS` delay between attempts.
 * - After exhausting retries, sets `connectionState` to `'disconnected'` permanently
 *   until the session restarts (active → false → true).
 * - Cleans up WebSocket, AudioContext, and pending timers on unmount or when
 *   `active` becomes false.
 * - Mock mode: when `NEXT_PUBLIC_USE_MOCK_API=true`, skips the WebSocket and
 *   AudioContext entirely; `toggleMute` still toggles the boolean.
 *
 * Related requirements: Req 5.2 (audio playback), Req 5.8 (audio WebSocket reconnect)
 */
export function useAudioSocket(
  sessionId: string | null,
  active: boolean
): UseAudioSocketResult {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [isMuted, setIsMuted] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);

  // Refs to hold mutable values that shouldn't trigger re-renders
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectCountRef = useRef(0);
  // Track whether we've exhausted retries (permanent disconnect)
  const exhaustedRef = useRef(false);
  // Track whether the hook is still mounted / active
  const activeRef = useRef(active);

  // Keep activeRef in sync
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const isMockMode =
    process.env.NEXT_PUBLIC_USE_MOCK_API === "true";

  /**
   * Cleans up the current WebSocket, AudioContext, and any pending retry timer.
   * Does NOT reset reconnect count — that is managed separately.
   */
  const cleanup = useCallback(() => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (wsRef.current !== null) {
      // Remove event handlers before closing to prevent spurious retries
      const ws = wsRef.current;
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        ws.close();
      }
      wsRef.current = null;
    }
    // Close the AudioContext if it exists and isn't already closed
    if (audioCtxRef.current !== null) {
      if (audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close();
      }
      audioCtxRef.current = null;
    }
  }, []);

  /**
   * Attempts to open a new WebSocket connection.
   * Schedules a retry on failure unless retries are exhausted or the hook
   * is no longer active.
   */
  const connect = useCallback(() => {
    if (!activeRef.current || !sessionId) return;
    if (exhaustedRef.current) return;

    const host =
      typeof window !== "undefined" ? window.location.host : "localhost";
    const url = `wss://${host}/api/v1/sessions/${sessionId}/audio`;

    setConnectionState("connecting");

    const ws = new WebSocket(url);
    // Request binary frames as ArrayBuffer (not Blob)
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      if (!activeRef.current) {
        // Became inactive while connecting — close immediately
        ws.close();
        return;
      }
      setConnectionState("connected");
      // Reset retry state on successful connection
      reconnectCountRef.current = 0;
      setReconnectCount(0);
      exhaustedRef.current = false;

      // Create the AudioContext lazily on first successful connection
      if (audioCtxRef.current === null) {
        audioCtxRef.current = createAudioContext();
      }

      // Browser autoplay policy may start the context in 'suspended' state.
      // Attempt to resume it immediately; if the browser blocks it, playback
      // will be skipped until the user interacts with the page.
      if (
        audioCtxRef.current !== null &&
        audioCtxRef.current.state === "suspended"
      ) {
        audioCtxRef.current.resume().catch(() => {
          // Silently ignore — the mute effect will handle resume on unmute
        });
      }
    };

    ws.onclose = () => {
      if (!activeRef.current) {
        // Intentional close due to deactivation — stay disconnected
        setConnectionState("disconnected");
        return;
      }
      scheduleRetry();
    };

    ws.onerror = () => {
      // onerror is always followed by onclose, so retry logic lives in onclose
    };

    ws.onmessage = async (event: MessageEvent) => {
      // Only handle binary frames
      if (!(event.data instanceof ArrayBuffer)) return;

      const audioCtx = audioCtxRef.current;
      if (audioCtx === null || audioCtx.state === "closed") return;
      // Skip playback when muted (context is suspended)
      if (audioCtx.state === "suspended") return;

      try {
        // Slice to copy the buffer — decodeAudioData detaches the original
        const decoded = await audioCtx.decodeAudioData(event.data.slice(0));
        // Re-check state after the async decode (context may have been closed/suspended)
        if (audioCtx.state !== "running") return;
        const source = audioCtx.createBufferSource();
        source.buffer = decoded;
        source.connect(audioCtx.destination);
        source.start();
      } catch {
        // Silently ignore decode errors — the stream may send partial/invalid frames
      }
    };
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Schedules a reconnect attempt after `AUDIO_RECONNECT_DELAY_MS` ms,
   * unless the maximum number of attempts has been reached.
   */
  const scheduleRetry = useCallback(() => {
    if (!activeRef.current) return;

    const nextCount = reconnectCountRef.current + 1;

    if (nextCount > AUDIO_RECONNECT_ATTEMPTS) {
      // Exhausted all retries
      exhaustedRef.current = true;
      setConnectionState("disconnected");
      return;
    }

    reconnectCountRef.current = nextCount;
    setReconnectCount(nextCount);
    setConnectionState("connecting");

    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      if (activeRef.current && !exhaustedRef.current) {
        connect();
      }
    }, AUDIO_RECONNECT_DELAY_MS);
  }, [connect]);

  /**
   * Toggles the muted state. The useEffect below watches `isMuted` and
   * calls suspend()/resume() on the AudioContext accordingly.
   */
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  // ── Mute/unmute effect: wire isMuted to AudioContext suspend/resume ──────────
  useEffect(() => {
    // In mock mode there is no AudioContext — just let the boolean toggle
    if (isMockMode) return;

    const audioCtx = audioCtxRef.current;
    if (audioCtx === null || audioCtx.state === "closed") return;

    if (isMuted) {
      audioCtx.suspend().catch(() => {
        // Silently ignore — context may already be suspended or closed
      });
    } else {
      audioCtx.resume().catch(() => {
        // Silently ignore — context may already be running or closed
      });
    }
  }, [isMuted, isMockMode]);

  // ── Main effect: open / close WebSocket based on `active` and `sessionId` ──
  useEffect(() => {
    // Mock mode: skip WebSocket and AudioContext entirely
    if (isMockMode) {
      if (active && sessionId) {
        setConnectionState("connected");
        setReconnectCount(0);
      } else {
        setConnectionState("disconnected");
      }
      return;
    }

    if (!active || !sessionId) {
      // Not active or no session — clean up and stay disconnected
      cleanup();
      exhaustedRef.current = false;
      reconnectCountRef.current = 0;
      setReconnectCount(0);
      setConnectionState("disconnected");
      return;
    }

    // Reset retry state when a fresh connection attempt begins
    exhaustedRef.current = false;
    reconnectCountRef.current = 0;
    setReconnectCount(0);

    connect();

    return () => {
      // Cleanup on unmount or when deps change
      cleanup();
    };
  }, [active, sessionId, isMockMode, connect, cleanup]);

  return {
    connectionState,
    isMuted,
    toggleMute,
    reconnectCount,
  };
}
