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
 * - Flashing amber border when HELP_TRIGGERED to communicate urgency
 * - Inline error display if join fails
 * 
 * Visual treatment by status:
 * - HELP_TRIGGERED: flashing amber border (animate-pulse border-amber-500)
 * - Other statuses: neutral border
 */
export function PatientCard({
  patient,
  onJoinSession,
  isJoining = false,
}: PatientCardProps) {
  const isHelpTriggered = patient.status === "HELP_TRIGGERED";
  const canJoin = isHelpTriggered && !isJoining;

  // Dynamic border classes based on status
  const borderClasses = isHelpTriggered
    ? "border-amber-500 animate-pulse"
    : "border-slate-700";

  const handleJoinClick = () => {
    if (canJoin) {
      onJoinSession(patient.patient_id);
    }
  };

  return (
    <div
      className={`bg-slate-800 rounded-lg border-2 ${borderClasses} p-6 transition-all hover:shadow-lg`}
    >
      {/* Header: Name and Badge */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-slate-100 mb-2">
            {patient.name}
          </h3>
          <Badge status={patient.status} />
        </div>
      </div>

      {/* Last Updated Timestamp */}
      <div className="text-sm text-slate-400 mb-4">
        Last updated: {formatLocalTime(patient.last_updated)}
      </div>

      {/* Join Session Button */}
      <button
        onClick={handleJoinClick}
        disabled={!canJoin}
        className={`
          w-full px-4 py-2 rounded-md font-medium text-sm transition-all
          ${
            canJoin
              ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              : "bg-slate-700 text-slate-500 cursor-not-allowed"
          }
        `}
        aria-label={`Join session with ${patient.name}`}
      >
        {isJoining ? "Joining..." : "Join Session"}
      </button>
    </div>
  );
}
