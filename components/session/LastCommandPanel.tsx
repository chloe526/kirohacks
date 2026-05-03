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
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 space-y-3">
      {/* Panel header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
          Last Command Sent
        </h3>

        {/* Status badge — only shown when acknowledged or failed */}
        {commandStatus === "acknowledged" && (
          <span
            role="status"
            aria-live="polite"
            className="text-xs font-medium px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20"
          >
            Command sent
          </span>
        )}
        {commandStatus === "failed" && (
          <span
            role="status"
            aria-live="polite"
            className="text-xs font-medium px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20"
          >
            Command failed
          </span>
        )}
      </div>

      {/* Command JSON or placeholder */}
      {lastCommand === null ? (
        <p className="text-sm text-slate-500 italic">No commands sent yet</p>
      ) : (
        <pre
          aria-label="Last command JSON"
          className="text-xs text-slate-300 bg-slate-900 rounded-md p-3 overflow-x-auto whitespace-pre font-mono leading-relaxed border border-slate-700"
        >
          {JSON.stringify(lastCommand, null, 2)}
        </pre>
      )}
    </div>
  );
}
