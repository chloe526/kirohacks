import type { PatientStatus } from "@/types";

interface BadgeProps {
  status: PatientStatus;
}

/**
 * Badge component that renders a colour-coded pill based on patient status.
 * 
 * Visual treatment:
 * - IDLE: grey (neutral state)
 * - HELP_TRIGGERED: amber with pulse animation (urgent)
 * - IN_SESSION: green (active session)
 * - ESCALATED: red (emergency)
 */
export function Badge({ status }: BadgeProps) {
  const baseClasses = "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium";
  
  const statusClasses: Record<PatientStatus, string> = {
    IDLE: "bg-slate-700 text-slate-300",
    HELP_TRIGGERED: "bg-amber-500/20 text-amber-400 border border-amber-500 animate-pulse",
    IN_SESSION: "bg-green-500/20 text-green-400 border border-green-500",
    ESCALATED: "bg-red-500/20 text-red-400 border border-red-500",
  };

  const statusLabels: Record<PatientStatus, string> = {
    IDLE: "Idle",
    HELP_TRIGGERED: "Help Triggered",
    IN_SESSION: "In Session",
    ESCALATED: "Escalated",
  };

  return (
    <span className={`${baseClasses} ${statusClasses[status]}`}>
      {statusLabels[status]}
    </span>
  );
}
