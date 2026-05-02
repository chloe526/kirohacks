"use client";

import React, { useEffect, useState } from "react";

interface SessionTimerProps {
  startedAt: string | null;
}

/**
 * SessionTimer
 *
 * Displays a live timer counting up from the session start time.
 *
 * Behaviour:
 * - Accepts `startedAt: string | null` (ISO 8601 timestamp)
 * - Uses `setInterval` (1 s tick) to count up from `startedAt`
 * - Renders `HH:MM:SS` format
 * - Cleans up interval on unmount
 * - Shows "00:00:00" when `startedAt` is null
 */
export function SessionTimer({ startedAt }: SessionTimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }

    // Calculate initial elapsed time
    const startTime = new Date(startedAt).getTime();
    const updateElapsed = () => {
      const now = Date.now();
      const diff = Math.floor((now - startTime) / 1000); // seconds
      setElapsed(Math.max(0, diff));
    };

    // Update immediately
    updateElapsed();

    // Then update every second
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  // Format elapsed seconds as HH:MM:SS
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  const formatted = [
    hours.toString().padStart(2, "0"),
    minutes.toString().padStart(2, "0"),
    seconds.toString().padStart(2, "0"),
  ].join(":");

  return (
    <div
      className="flex items-center gap-2 text-sm text-slate-300"
      aria-live="off"
      aria-label={`Session duration: ${formatted}`}
    >
      <span className="text-lg" aria-hidden="true">
        ⏱
      </span>
      <span className="font-mono font-medium">{formatted}</span>
    </div>
  );
}
