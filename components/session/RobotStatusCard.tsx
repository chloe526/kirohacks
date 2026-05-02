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
 * - Amber offline banner when robot is offline
 *
 * Design notes:
 * - Uses consistent card styling with other session components
 * - Battery bar turns red and shows "Low Battery" when ≤ 20%
 * - Offline banner is prominent and amber-colored
 * - All robot control buttons should be disabled when offline
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
      {/* Offline Banner */}
      {!isOnline && (
        <div
          className="bg-amber-500/10 border border-amber-500 rounded-lg p-3"
          role="alert"
        >
          <p className="text-sm text-amber-400 font-medium text-center">
            Robot offline — commands will not be delivered
          </p>
        </div>
      )}

      {/* Robot Status Card */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="space-y-4">
          {/* Connection Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">
              Connection
            </span>
            <div className="flex items-center gap-2">
              <Circle
                className={`w-3 h-3 fill-current ${
                  isOnline ? "text-green-500" : "text-red-500"
                }`}
                aria-hidden="true"
              />
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Battery
                  className={`w-4 h-4 ${
                    isLowBattery ? "text-red-400" : "text-slate-300"
                  }`}
                  aria-hidden="true"
                />
                <span className="text-sm font-medium text-slate-300">
                  Battery
                </span>
              </div>
              <span
                className={`text-sm font-medium ${
                  isLowBattery ? "text-red-400" : "text-slate-300"
                }`}
              >
                {robot.battery}%
              </span>
            </div>

            {/* Battery Progress Bar */}
            <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  isLowBattery ? "bg-red-500" : "bg-green-500"
                }`}
                style={{ width: `${Math.min(100, Math.max(0, robot.battery))}%` }}
                role="progressbar"
                aria-valuenow={robot.battery}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Battery level: ${robot.battery}%`}
              />
            </div>

            {/* Low Battery Warning */}
            {isLowBattery && (
              <p className="text-xs text-red-400 font-medium">Low Battery</p>
            )}
          </div>

          {/* Last Command */}
          <div className="space-y-1 pt-2 border-t border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-300">
                Last Command
              </span>
              <span className="text-sm text-slate-400 capitalize">
                {robot.last_command || "None"}
              </span>
            </div>
            {robot.last_command_at && (
              <p className="text-xs text-slate-500">
                {formatLastCommand(robot.last_command_at)}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
