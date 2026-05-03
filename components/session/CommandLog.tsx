"use client";

import React from "react";
import type { RobotCommand } from "@/types";
import { useCommandStore } from "@/stores/commandStore";
import { formatLocalTime } from "@/lib/formatters";

interface CommandLogProps {
  commands: RobotCommand[];
}

/**
 * CommandLog — scrollable list of the last 20 robot commands sent in a session.
 *
 * Reads `commandStore.log` from the Zustand command store. The store already
 * maintains the log in newest-first order and caps it at COMMAND_LOG_MAX (20).
 *
 * Behaviour:
 * - When no commands have been sent: shows "No commands sent yet" placeholder.
 * - When commands exist: renders each entry as a row with the action label and
 *   a local-time timestamp via `formatLocalTime`.
 * - The list is scrollable when entries overflow the fixed-height container.
 * - Newest entry appears at the top (store prepends on each addCommand call).
 *
 * Related requirements:
 * - Requirement 6: Robot Control UI
 * - Acceptance Criteria 6.5: Display scrollable command log, newest entry at top
 */
export function CommandLog({ commands }: CommandLogProps) {
  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 space-y-3">
      {/* Panel header */}
      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
        Command Log
      </h3>

      {commands.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No commands sent yet</p>
      ) : (
        <ul
          aria-label="Command log"
          className="overflow-y-auto max-h-60 space-y-1 pr-1"
        >
          {commands.map((cmd, index) => (
            <li
              key={`${cmd.issued_at}-${index}`}
              className="flex items-center justify-between px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700"
            >
              <span className="text-sm font-medium text-slate-200 capitalize">
                {cmd.action}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {formatLocalTime(cmd.issued_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * CommandLogConnected — convenience wrapper that reads directly from the
 * command store so callers don't need to wire up the prop manually.
 */
export function CommandLogConnected() {
  const log = useCommandStore((s) => s.log);
  return <CommandLog commands={log} />;
}
