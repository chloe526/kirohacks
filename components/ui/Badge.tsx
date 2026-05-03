import type { PatientStatus } from "@/types";

interface BadgeProps {
  status: PatientStatus;
}

/**
 * Badge component that renders a colour-coded pill based on patient status.
 *
 * Visual treatment:
 * - IDLE: slate (neutral state)
 * - HELP_TRIGGERED: amber with subtle pulse (urgent)
 * - IN_SESSION: green (active session)
 * - ESCALATED: red (emergency)
 */
export function Badge({ status }: BadgeProps) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

  const statusClasses: Record<PatientStatus, string> = {
    IDLE: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
    HELP_TRIGGERED:
      "bg-amber-50 text-amber-700 ring-1 ring-amber-300 animate-subtle-pulse",
    IN_SESSION: "bg-green-50 text-green-700 ring-1 ring-green-300",
    ESCALATED: "bg-red-50 text-red-700 ring-1 ring-red-300",
  };

  const dotClasses: Record<PatientStatus, string> = {
    IDLE: "bg-slate-400",
    HELP_TRIGGERED: "bg-amber-500",
    IN_SESSION: "bg-green-500",
    ESCALATED: "bg-red-500",
  };

  const statusLabels: Record<PatientStatus, string> = {
    IDLE: "Idle",
    HELP_TRIGGERED: "Help Triggered",
    IN_SESSION: "In Session",
    ESCALATED: "Escalated",
  };

  return (
    <span className={`${base} ${statusClasses[status]}`}>
      <span
        className={`h-1.5 w-1.5 rounded-full ${dotClasses[status]}`}
        aria-hidden="true"
      />
      {statusLabels[status]}
    </span>
  );
}
