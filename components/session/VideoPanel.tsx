"use client";

import React from "react";
import { Camera } from "lucide-react";

interface VideoPanelProps {
  patientName: string;
  robotConnection: "online" | "offline";
}

/**
 * VideoPanel component (placeholder only — Milestone 3)
 *
 * Displays a 16:9 dark placeholder area for the future live video feed.
 * Shows patient name overlay and robot connection status.
 *
 * Layout:
 * ┌─────────────────────────────────────────────────────┐
 * │                                          [🟢 Live]  │
 * │                    📷                               │
 * │         Live video feed — not yet connected         │
 * │                                                     │
 * │  John Doe                                           │
 * └─────────────────────────────────────────────────────┘
 *
 * Features (Milestone 3):
 * - 16:9 aspect ratio with minimum height of 360px
 * - Dark background (slate-900)
 * - Centered camera icon and placeholder text
 * - Patient name overlay at bottom-left
 * - Connection status badge at top-right (online = green, offline = red)
 *
 * Future (Milestone 5):
 * - WebSocket audio connection
 * - Mute/unmute toggle
 * - Audio status indicator
 * - Reconnection logic
 *
 * Related requirements:
 * - Requirement 5: Video and Audio Panel
 * - Milestone 3, Task 3.4: Placeholder implementation
 */
export function VideoPanel({
  patientName,
  robotConnection,
}: VideoPanelProps) {
  const isOnline = robotConnection === "online";

  return (
    <div className="relative w-full bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
      {/* 16:9 aspect ratio container with minimum height */}
      <div
        className="relative w-full"
        style={{
          aspectRatio: "16 / 9",
          minHeight: "360px",
        }}
      >
        {/* Connection status badge — top-right */}
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

        {/* Center content: camera icon and placeholder text */}
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

        {/* Patient name overlay — bottom-left */}
        <div className="absolute bottom-4 left-4 z-10">
          <div className="bg-slate-900/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-700">
            <p className="text-slate-100 text-sm font-medium">{patientName}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
