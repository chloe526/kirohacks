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
 * - IDLE: grey (neutral)
 * - HELP_TRIGGERED: amber with flashing animation (urgent)
 * - IN_SESSION: green (active)
 * - ESCALATED: red with flashing animation (emergency)
 */
export function SessionStatusBadge({ status }: SessionStatusBadgeProps) {
  const statusConfig = {
    IDLE: {
      label: "Idle",
      className: "bg-slate-600 text-slate-100",
      animate: false,
    },
    HELP_TRIGGERED: {
      label: "Help Triggered",
      className: "bg-amber-500 text-amber-950",
      animate: true,
    },
    IN_SESSION: {
      label: "In Session",
      className: "bg-green-500 text-green-950",
      animate: false,
    },
    ESCALATED: {
      label: "Escalated",
      className: "bg-red-500 text-red-950",
      animate: true,
    },
  };

  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
        config.className
      } ${config.animate ? "animate-pulse" : ""}`}
      aria-label={`Session status: ${config.label}`}
    >
      {config.label}
    </span>
  );
}
