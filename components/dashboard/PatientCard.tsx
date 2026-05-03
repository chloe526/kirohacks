import type { PatientRecord } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { formatLocalTime } from "@/lib/formatters";

interface PatientCardProps {
  patient: PatientRecord;
  onJoinSession: (patientId: string) => void;
  isJoining?: boolean;
}

/**
 * PatientCard component displays a patient's current status on the dashboard.
 *
 * Features:
 * - Shows patient name, status badge, and last updated timestamp
 * - "Join Session" button enabled only when status is HELP_TRIGGERED
 * - Amber left border accent when HELP_TRIGGERED to communicate urgency
 * - Inline error display if join fails
 *
 * Visual treatment by status:
 * - HELP_TRIGGERED: amber left border + very light amber background tint
 * - Other statuses: neutral white card
 */
export function PatientCard({
  patient,
  onJoinSession,
  isJoining = false,
}: PatientCardProps) {
  const isHelpTriggered = patient.status === "HELP_TRIGGERED";
  const canJoin = isHelpTriggered && !isJoining;

  // Subtle urgency treatment — left border accent, no full-card pulse
  const cardClasses = isHelpTriggered
    ? "border-l-4 border-l-amber-400 border-t border-r border-b border-slate-200 bg-amber-50/40 animate-subtle-pulse"
    : "border border-slate-200 bg-white";

  const handleJoinClick = () => {
    if (canJoin) {
      onJoinSession(patient.patient_id);
    }
  };

  return (
    <div
      className={`rounded-lg p-5 shadow-sm transition-shadow hover:shadow-md ${cardClasses}`}
    >
      {/* Header: Name and Badge */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900 leading-snug">
          {patient.name}
        </h3>
        <Badge status={patient.status} />
      </div>

      {/* Last Updated Timestamp */}
      <p className="mb-4 text-xs text-slate-400">
        Last updated: {formatLocalTime(patient.last_updated)}
      </p>

      {/* Join Session Button */}
      <button
        onClick={handleJoinClick}
        disabled={!canJoin}
        className={`
          w-full rounded-md px-4 py-2 text-sm font-medium transition-colors
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          ${
            canJoin
              ? "bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          }
        `}
        aria-label={`Join session with ${patient.name}`}
      >
        {isJoining ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Joining…
          </span>
        ) : (
          "Join Session"
        )}
      </button>
    </div>
  );
}
