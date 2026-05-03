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

    const startTime = new Date(startedAt).getTime();
    const updateElapsed = () => {
      const now = Date.now();
      const diff = Math.floor((now - startTime) / 1000);
      setElapsed(Math.max(0, diff));
    };

    updateElapsed();

    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

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
      className="flex items-center gap-1.5 text-sm text-slate-500"
      aria-live="off"
      aria-label={`Session duration: ${formatted}`}
    >
      <svg
        className="h-3.5 w-3.5 text-slate-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" strokeWidth="2" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2" />
      </svg>
      <span className="font-mono text-sm font-medium text-slate-700">
        {formatted}
      </span>
    </div>
  );
}
