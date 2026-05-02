"use client";

import React, { useEffect, useState } from "react";
import type { PatientStatus } from "@/types";
import { formatRelativeTime } from "@/lib/formatters";

interface AlertStatusCardProps {
  status: PatientStatus;
  helpTriggeredAt: string | null;
}

/**
 * AlertStatusCard
 *
 * Displays session alert state with visual escalation based on patient status.
 *
 * Visual states:
 * - IDLE: neutral card, no urgency indicators
 * - HELP_TRIGGERED: amber border, flashing animation, live counter
 * - IN_SESSION: green border, "Session in progress" label
 * - ESCALATED: red border, red glow, pulsing animation, emergency message
 */
export function AlertStatusCard({
  status,
  helpTriggeredAt,
}: AlertStatusCardProps) {
  // Live counter for HELP_TRIGGERED — updates every second
  const [relativeTime, setRelativeTime] = useState<string>("");

  useEffect(() => {
    if (status === "HELP_TRIGGERED" && helpTriggeredAt) {
      // Initial update
      setRelativeTime(formatRelativeTime(helpTriggeredAt));

      // Update every second
      const interval = setInterval(() => {
        setRelativeTime(formatRelativeTime(helpTriggeredAt));
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setRelativeTime("");
    }
  }, [status, helpTriggeredAt]);

  // Determine card styling based on status
  const getCardStyles = () => {
    switch (status) {
      case "HELP_TRIGGERED":
        return "border-amber-500 bg-amber-500/5 animate-pulse";
      case "IN_SESSION":
        return "border-green-500 bg-green-500/5";
      case "ESCALATED":
        return "border-red-500 bg-red-500/5 animate-pulse shadow-[0_0_24px_rgba(239,68,68,0.4)]";
      case "IDLE":
      default:
        return "border-slate-700 bg-slate-800/50";
    }
  };

  // Determine content based on status
  const renderContent = () => {
    switch (status) {
      case "HELP_TRIGGERED":
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-amber-500 animate-pulse" />
              <h3 className="text-lg font-semibold text-amber-400">
                Help Request Pending
              </h3>
            </div>
            {helpTriggeredAt && relativeTime && (
              <p className="text-sm text-slate-300">
                Help triggered {relativeTime}
              </p>
            )}
          </div>
        );

      case "IN_SESSION":
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <h3 className="text-lg font-semibold text-green-400">
                Session in Progress
              </h3>
            </div>
            <p className="text-sm text-slate-300">
              Clinician is actively monitoring this patient
            </p>
          </div>
        );

      case "ESCALATED":
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
              <h3 className="text-lg font-semibold text-red-400">
                ESCALATED
              </h3>
            </div>
            <p className="text-sm text-red-300 font-medium">
              Emergency services have been dispatched
            </p>
          </div>
        );

      case "IDLE":
      default:
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-slate-500" />
              <h3 className="text-lg font-semibold text-slate-300">
                No Active Alert
              </h3>
            </div>
            <p className="text-sm text-slate-400">
              Patient status is normal
            </p>
          </div>
        );
    }
  };

  return (
    <div
      className={`rounded-lg border-2 p-4 transition-all duration-300 ${getCardStyles()}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {renderContent()}
    </div>
  );
}
