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
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
      {/* Panel header */}
      <h3 className="text-sm font-semibold text-slate-700">
        Command Log
      </h3>

      {commands.length === 0 ? (
        <p className="text-sm text-slate-400 italic">No commands sent yet</p>
      ) : (
        <ul
          aria-label="Command log"
          className="max-h-56 space-y-1.5 overflow-y-auto pr-1"
        >
          {commands.map((cmd, index) => (
            <li
              key={`${cmd.issued_at}-${index}`}
              className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
            >
              <span className="text-sm font-medium capitalize text-slate-700">
                {cmd.action}
              </span>
              <span className="font-mono text-xs text-slate-400">
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
