import React from "react";
import type { PatientStatus } from "@/types";

interface SessionStatusBadgeProps {
  status: PatientStatus;
}

/**
 * SessionStatusBadge
 *
 * Displays a color-coded status badge for the current session state.
 *
 * Status colors:
 * - IDLE: slate (neutral)
 * - HELP_TRIGGERED: amber with subtle pulse (urgent)
 * - IN_SESSION: green (active)
 * - ESCALATED: red with subtle pulse (emergency)
 */
export function SessionStatusBadge({ status }: SessionStatusBadgeProps) {
  const statusConfig: Record<
    PatientStatus,
    { label: string; className: string; animate: boolean }
  > = {
    IDLE: {
      label: "Idle",
      className: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
      animate: false,
    },
    HELP_TRIGGERED: {
      label: "Help Triggered",
      className: "bg-amber-50 text-amber-700 ring-1 ring-amber-300",
      animate: true,
    },
    CALL_READY: {
      label: "Call Ready",
      className: "bg-blue-50 text-blue-700 ring-1 ring-blue-300",
      animate: false,
    },
    IN_SESSION: {
      label: "In Session",
      className: "bg-green-50 text-green-700 ring-1 ring-green-300",
      animate: false,
    },
    ESCALATED: {
      label: "Escalated",
      className: "bg-red-50 text-red-700 ring-1 ring-red-300",
      animate: true,
    },
  };

  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        config.className
      } ${config.animate ? "animate-subtle-pulse" : ""}`}
      aria-label={`Session status: ${config.label}`}
    >
      {config.label}
    </span>
  );
}
