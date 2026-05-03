"use client";

import React from "react";
import { useCommandStore } from "@/stores/commandStore";

/**
 * LastCommandPanel — read-only display of the most recently sent robot command.
 *
 * Reads directly from commandStore (no props needed).
 *
 * Behaviour:
 * - When lastCommand is null: shows "No commands sent yet" placeholder.
 * - When lastCommand is non-null: renders it as indented JSON in a <pre> block.
 * - Shows a "Command sent" badge (green) when commandStatus === 'acknowledged'.
 * - Shows a "Command failed" badge (red) when commandStatus === 'failed'.
 * - No badge shown when commandStatus === 'idle'.
 *
 * Related requirements:
 * - Requirement 6: Robot Control UI
 * - Acceptance Criteria 6.3: Display serialised RobotCommand as indented JSON
 * - Acceptance Criteria 6.4: Show "Command sent" / "Command failed" status indicator
 */
export function LastCommandPanel() {
  const lastCommand = useCommandStore((s) => s.lastCommand);
  const commandStatus = useCommandStore((s) => s.commandStatus);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      {/* Panel header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Last Command Sent
        </h3>

        {/* Status badge — only shown when acknowledged or failed */}
        {commandStatus === "acknowledged" && (
          <span
            role="status"
            aria-live="polite"
            className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-200"
          >
            Command sent
          </span>
        )}
        {commandStatus === "failed" && (
          <span
            role="status"
            aria-live="polite"
            className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200"
          >
            Command failed
          </span>
        )}
      </div>

      {/* Command JSON or placeholder */}
      {lastCommand === null ? (
        <p className="text-sm italic text-slate-400">No commands sent yet</p>
      ) : (
        <pre
          aria-label="Last command JSON"
          className="overflow-x-auto whitespace-pre rounded-md border border-slate-100 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-700"
        >
          {JSON.stringify(lastCommand, null, 2)}
        </pre>
      )}
    </div>
  );
}
