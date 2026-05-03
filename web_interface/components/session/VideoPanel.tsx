"use client";

import React from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { useAudioSocket } from "@/hooks/useAudioSocket";
import { useMicCapture } from "@/hooks/useMicCapture";
import { ROBOT_STREAM_HOST } from "@/lib/constants";
import type { MicConnectionState } from "@/hooks/useMicCapture";

interface VideoPanelProps {
  patientName: string;
  robotConnection: "online" | "offline";
  sessionId: string | null;
  sessionActive: boolean;
}

/**
 * VideoPanel — incoming audio (robot→doctor) + outgoing audio (doctor→robot).
 *
 * Incoming audio: useAudioSocket (existing)
 * Outgoing audio: useMicCapture (new, doctor-to-robot-audio spec)
 *
 * Validates: Requirements 4.1–4.7
 */
export function VideoPanel({
  patientName,
  robotConnection,
  sessionId,
  sessionActive,
}: VideoPanelProps) {
  const isOnline = robotConnection === "online";
  const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";

  // Incoming audio (robot → doctor)
  const {
    connectionState: incomingState,
    isMuted: incomingMuted,
    toggleMute: toggleIncoming,
    reconnectCount: incomingReconnect,
  } = useAudioSocket(sessionId, sessionActive);

  // Outgoing audio (doctor → robot)
  const {
    connectionState: outgoingState,
    isMuted: outgoingMuted,
    toggleMute: toggleOutgoing,
    reconnectCount: outgoingReconnect,
  } = useMicCapture(ROBOT_STREAM_HOST, sessionActive);

  const ROBOT_STREAM_URL = `http://${ROBOT_STREAM_HOST}:8080/`;

  // ── Incoming audio status ──────────────────────────────────────────────────
  const renderIncomingStatus = () => {
    if (isMockMode) {
      return (
        <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500">
          <Mic className="w-3 h-3" aria-hidden="true" />
          <span>Audio (mocked)</span>
        </div>
      );
    }
    switch (incomingState) {
      case "connected":
        return (
          <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium bg-green-500/20 text-green-400 border border-green-500">
            <Mic className="w-3 h-3" aria-hidden="true" />
            <span>Audio connected</span>
          </div>
        );
      case "connecting":
        return (
          <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500">
            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
            <span>
              {incomingReconnect > 0
                ? `Reconnecting audio… (attempt ${incomingReconnect}/3)`
                : "Connecting audio…"}
            </span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium bg-red-500/20 text-red-400 border border-red-500">
            <MicOff className="w-3 h-3" aria-hidden="true" />
            <span>Audio disconnected</span>
          </div>
        );
    }
  };

  // ── Incoming mute toggle ───────────────────────────────────────────────────
  const renderIncomingMuteToggle = () => {
    const disabled = incomingState !== "connected";
    return (
      <button
        onClick={toggleIncoming}
        disabled={disabled}
        aria-label={incomingMuted ? "Unmute audio" : "Mute audio"}
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-slate-900 ${
          disabled
            ? "bg-slate-700 text-slate-500 cursor-not-allowed"
            : incomingMuted
              ? "bg-red-500/20 text-red-400 border border-red-500 hover:bg-red-500/30"
              : "bg-slate-700 text-slate-300 hover:bg-slate-600"
        }`}
      >
        {incomingMuted ? (
          <MicOff className="w-4 h-4" aria-hidden="true" />
        ) : (
          <Mic className="w-4 h-4" aria-hidden="true" />
        )}
        <span>{incomingMuted ? "Unmute" : "Mute"}</span>
      </button>
    );
  };

  // ── Outgoing mic status indicator ─────────────────────────────────────────
  const renderOutgoingStatus = (state: MicConnectionState, reconnect: number) => {
    switch (state) {
      case "connected":
        return (
          <div
            data-testid="outgoing-mic-status"
            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium bg-green-500/20 text-green-400 border border-green-500"
          >
            <Mic className="w-3 h-3" aria-hidden="true" />
            <span>Mic connected</span>
          </div>
        );
      case "connecting":
        return (
          <div
            data-testid="outgoing-mic-status"
            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500"
          >
            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
            <span>
              {reconnect > 0
                ? `Reconnecting mic… (attempt ${reconnect}/3)`
                : "Connecting mic…"}
            </span>
          </div>
        );
      case "permission-denied":
        return (
          <div
            data-testid="outgoing-mic-status"
            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium bg-red-500/20 text-red-400 border border-red-500"
          >
            <MicOff className="w-3 h-3" aria-hidden="true" />
            <span>Mic permission denied</span>
          </div>
        );
      case "disconnected":
        return (
          <div
            data-testid="outgoing-mic-status"
            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium bg-red-500/20 text-red-400 border border-red-500"
          >
            <MicOff className="w-3 h-3" aria-hidden="true" />
            <span>Mic disconnected</span>
          </div>
        );
      default: // idle
        return (
          <div
            data-testid="outgoing-mic-status"
            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium bg-slate-700/50 text-slate-400 border border-slate-600"
          >
            <MicOff className="w-3 h-3" aria-hidden="true" />
            <span>Mic idle</span>
          </div>
        );
    }
  };

  // ── Outgoing mute toggle ───────────────────────────────────────────────────
  const renderOutgoingMuteToggle = () => {
    const disabled = outgoingState !== "connected";
    return (
      <button
        onClick={toggleOutgoing}
        disabled={disabled}
        aria-label={outgoingMuted ? "Speak" : "Mute Mic"}
        data-testid="outgoing-mute-toggle"
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-slate-900 ${
          disabled
            ? "bg-slate-700 text-slate-500 cursor-not-allowed"
            : outgoingMuted
              ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
              : "bg-red-500/20 text-red-400 border border-red-500 hover:bg-red-500/30"
        }`}
      >
        {outgoingMuted ? (
          <MicOff className="w-4 h-4" aria-hidden="true" />
        ) : (
          <Mic className="w-4 h-4" aria-hidden="true" />
        )}
        <span>{outgoingMuted ? "Speak" : "Mute Mic"}</span>
      </button>
    );
  };

  return (
    <div className="relative w-full bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
      <div
        className="relative w-full"
        style={{ aspectRatio: "16 / 9", minHeight: "360px" }}
      >
        {/* Robot connection badge — top-right */}
        <div className="absolute top-4 right-4 z-10">
          <div
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
              isOnline
                ? "bg-green-500/20 text-green-400 border border-green-500"
                : "bg-red-500/20 text-red-400 border border-red-500"
            }`}
          >
            <div
              className={`h-2 w-2 rounded-full ${isOnline ? "bg-green-500" : "bg-red-500"}`}
              aria-hidden="true"
            />
            <span>{isOnline ? "Live" : "Disconnected"}</span>
          </div>
        </div>

        {/* Incoming audio status — top-right, row 2 */}
        <div className="absolute top-16 right-4 z-10">
          {renderIncomingStatus()}
        </div>

        {/* Outgoing mic status — top-right, row 3 */}
        <div className="absolute top-28 right-4 z-10">
          {renderOutgoingStatus(outgoingState, outgoingReconnect)}
        </div>

        {/* Live video iframe */}
        <iframe
          src={ROBOT_STREAM_URL}
          title={`Live robot video feed for ${patientName}`}
          className="absolute inset-0 h-full w-full border-0 bg-slate-950"
          allow="camera; microphone; autoplay; fullscreen"
          allowFullScreen
        />

        {/* Patient name overlay — bottom-left */}
        <div className="absolute bottom-4 left-4 z-10">
          <div className="bg-slate-900/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-700">
            <p className="text-slate-100 text-sm font-medium">{patientName}</p>
          </div>
        </div>

        {/* Controls — bottom-right: incoming mute + outgoing mute */}
        <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2 items-end">
          {renderIncomingMuteToggle()}
          {renderOutgoingMuteToggle()}
        </div>
      </div>
    </div>
  );
}
