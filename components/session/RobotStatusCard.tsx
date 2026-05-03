"use client";

import React from "react";
import type { PatientRecord } from "@/types";
import { formatLastCommand } from "@/lib/formatters";
import { Battery, Circle } from "lucide-react";

interface RobotStatusCardProps {
  robot: PatientRecord["robot"];
}

/**
 * RobotStatusCard component displays robot connectivity and battery state.
 *
 * Features:
 * - Online/offline indicator (green/red dot)
 * - Battery progress bar (red when ≤ 20%)
 * - Last command label
 * - Last command timestamp (formatted as relative time)
 * - Amber offline notice when robot is offline
 *
 * Note: test suite asserts specific Tailwind classes — keep them stable.
 *
 * Related requirements:
 * - Requirement 4: Robot Status Display
 * - Acceptance Criteria 4.2: Display online/offline, battery, last command
 * - Acceptance Criteria 4.3: Red battery indicator when ≤ 20%
 * - Acceptance Criteria 4.4: Amber banner when offline
 */
export function RobotStatusCard({ robot }: RobotStatusCardProps) {
  const isOnline = robot.connection === "online";
  const isLowBattery = robot.battery <= 20;

  return (
    <div className="space-y-3">
      {/* Offline notice */}
      {!isOnline && (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5"
          role="alert"
        >
          <p className="text-center text-xs font-medium text-amber-700">
            Robot offline — commands will not be delivered
          </p>
        </div>
      )}

      {/* Robot Status Card — bg-slate-800 kept for test assertion */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Robot Status
        </h3>

        <div className="space-y-3">
          {/* Connection Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Connection</span>
            <div className="flex items-center gap-1.5">
              <Circle
                className={`h-2.5 w-2.5 fill-current ${
                  isOnline ? "text-green-500" : "text-red-500"
                }`}
                aria-hidden="true"
              />
              {/* text-green-400 / text-red-400 kept for test assertions */}
              <span
                className={`text-sm font-medium ${
                  isOnline ? "text-green-400" : "text-red-400"
                }`}
              >
                {isOnline ? "Online" : "Offline"}
              </span>
            </div>
          </div>

          {/* Battery Level */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Battery
                  className={`h-4 w-4 ${
                    isLowBattery ? "text-red-400" : "text-slate-400"
                  }`}
                  aria-hidden="true"
                />
                <span className="text-sm text-slate-300">Battery</span>
              </div>
              {/* text-red-400 kept for test assertion */}
              <span
                className={`text-sm font-medium ${
                  isLowBattery ? "text-red-400" : "text-slate-300"
                }`}
              >
                {robot.battery}%
              </span>
            </div>

            {/* Battery Progress Bar */}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
              <div
                className={`h-full transition-all duration-300 ${
                  isLowBattery ? "bg-red-500" : "bg-green-500"
                }`}
                style={{
                  width: `${Math.min(100, Math.max(0, robot.battery))}%`,
                }}
                role="progressbar"
                aria-valuenow={robot.battery}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Battery level: ${robot.battery}%`}
              />
            </div>

            {isLowBattery && (
              <p className="text-xs font-medium text-red-400">Low Battery</p>
            )}
          </div>

          {/* Last Command */}
          <div className="border-t border-slate-700 pt-3 space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Last Command</span>
              <span className="text-sm font-medium text-slate-200 capitalize">
                {robot.last_command || "None"}
              </span>
            </div>
            {robot.last_command_at && (
              <p className="text-right text-xs text-slate-500">
                {formatLastCommand(robot.last_command_at)}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
