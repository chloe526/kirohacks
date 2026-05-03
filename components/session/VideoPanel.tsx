"use client";

import React from "react";
import { Camera, Mic, MicOff, Loader2 } from "lucide-react";
import { useAudioSocket } from "@/hooks/useAudioSocket";

interface VideoPanelProps {
  patientName: string;
  robotConnection: "online" | "offline";
  sessionId: string | null;
  sessionActive: boolean;
}

/**
 * VideoPanel component with audio integration (Milestone 5)
 *
 * Displays a 16:9 dark placeholder area for the future live video feed.
 * Shows patient name overlay, robot connection status, and audio status.
 * Integrates with useAudioSocket hook for live audio streaming.
 *
 * Note: test suite asserts specific Tailwind classes — keep them stable.
 *
 * Related requirements:
 * - Requirement 5: Video and Audio Panel
 * - Milestone 5, Task 5.3: Audio integration
 */
export function VideoPanel({
  patientName,
  robotConnection,
  sessionId,
  sessionActive,
}: VideoPanelProps) {
  const isOnline = robotConnection === "online";

  const { connectionState, isMuted, toggleMute, reconnectCount } =
    useAudioSocket(sessionId, sessionActive);

  const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";

  const renderAudioStatus = () => {
    if (isMockMode) {
      return (
        <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500">
          <Mic className="w-3 h-3" aria-hidden="true" />
          <span>Audio (mocked)</span>
        </div>
      );
    }

    switch (connectionState) {
      case "connected":
        return (
          <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium bg-green-500/20 text-green-400 border border-green-500">
            <Mic className="w-3 h-3" aria-hidden="true" />
            <span>Audio connected</span>
          </div>
        );
      case "connecting": {
        const isReconnecting = reconnectCount > 0;
        return (
          <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500">
            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
            <span>
              {isReconnecting
                ? `Reconnecting audio… (attempt ${reconnectCount}/3)`
                : "Connecting audio…"}
            </span>
          </div>
        );
      }
      case "disconnected":
      default:
        return (
          <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium bg-red-500/20 text-red-400 border border-red-500">
            <MicOff className="w-3 h-3" aria-hidden="true" />
            <span>Audio disconnected</span>
          </div>
        );
    }
  };

  const renderMuteToggle = () => {
    const isDisabled = connectionState !== "connected";

    return (
      <button
        onClick={toggleMute}
        disabled={isDisabled}
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-slate-900 ${
          isDisabled
            ? "bg-slate-700 text-slate-500 cursor-not-allowed"
            : isMuted
              ? "bg-red-500/20 text-red-400 border border-red-500 hover:bg-red-500/30"
              : "bg-slate-700 text-slate-300 hover:bg-slate-600"
        }`}
        aria-label={isMuted ? "Unmute audio" : "Mute audio"}
      >
        {isMuted ? (
          <MicOff className="w-4 h-4" aria-hidden="true" />
        ) : (
          <Mic className="w-4 h-4" aria-hidden="true" />
        )}
        <span>{isMuted ? "Unmute" : "Mute"}</span>
      </button>
    );
  };

  return (
    <div className="relative w-full bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
      {/* 16:9 aspect ratio container with minimum height */}
      <div
        className="relative w-full"
        style={{ aspectRatio: "16 / 9", minHeight: "360px" }}
      >
        {/* Connection status badge — top-right
            Note: test suite asserts bg-green-500/20 text-green-400 and bg-red-500/20 text-red-400 */}
        <div className="absolute top-4 right-4 z-10">
          <div
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
              isOnline
                ? "bg-green-500/20 text-green-400 border border-green-500"
                : "bg-red-500/20 text-red-400 border border-red-500"
            }`}
          >
            <div
              className={`h-2 w-2 rounded-full ${
                isOnline ? "bg-green-500" : "bg-red-500"
              }`}
              aria-hidden="true"
            />
            <span>{isOnline ? "Live" : "Disconnected"}</span>
          </div>
        </div>

        {/* Audio status indicator — top-right, below connection status */}
        <div className="absolute top-16 right-4 z-10">
          {renderAudioStatus()}
        </div>

        {/* Center content: live iframe if configured, otherwise placeholder */}
        {process.env.NEXT_PUBLIC_ROBOT_STREAM_URL ? (
          <iframe
            src={process.env.NEXT_PUBLIC_ROBOT_STREAM_URL}
            title={`Live robot video feed for ${patientName}`}
            className="absolute inset-0 h-full w-full border-0 bg-slate-950"
            allow="camera; microphone; autoplay; fullscreen"
            allowFullScreen
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <Camera
              className="w-16 h-16 text-slate-600"
              aria-hidden="true"
              strokeWidth={1.5}
            />
            <p className="text-slate-400 text-sm font-medium">
              Live video feed — not yet connected
            </p>
          </div>
        )}

        {/* Patient name overlay — bottom-left */}
        <div className="absolute bottom-4 left-4 z-10">
          <div className="bg-slate-900/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-700">
            <p className="text-slate-100 text-sm font-medium">{patientName}</p>
          </div>
        </div>

        {/* Mute/unmute toggle — bottom-right */}
        <div className="absolute bottom-4 right-4 z-10">
          {renderMuteToggle()}
        </div>
      </div>
    </div>
  );
}
