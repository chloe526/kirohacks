import type { PatientRecord } from "@/types";
import { formatRelativeTime } from "@/lib/formatters";

interface PatientCardProps {
  patient: PatientRecord;
  onJoinSession: (patientId: string) => void;
  isJoining?: boolean;
}

/**
 * PatientCard — matches the Figma "Polished Healthcare Dashboard" design.
 *
 * Visual treatment by status:
 * - ESCALATED:      red border + bell icon badge + "Join Critical Session" red button
 * - HELP_TRIGGERED: amber border + bell icon badge + "Join Urgent Session" amber button
 * - IN_SESSION:     neutral border + green "Active" badge + pink "Join Session" button
 * - IDLE:           neutral border + grey "Idle" badge + pink "Join Session" button
 */
export function PatientCard({
  patient,
  onJoinSession,
  isJoining = false,
}: PatientCardProps) {
  const { status, robot } = patient;

  // Both HELP_TRIGGERED and CALL_READY need orange attention treatment,
  // but only CALL_READY allows the clinician to join.
  const shouldFlashOrange =
    status === "HELP_TRIGGERED" || status === "CALL_READY";
  const canJoinSession = status === "CALL_READY";

  // ── Card border style ──────────────────────────────────────────────────────
  const cardBorder =
    status === "ESCALATED"
      ? "border-2 border-red-400"
      : shouldFlashOrange
        ? "border-2 border-amber-400 animate-pulse"
        : "border border-slate-200";

  // ── Corner notification bell (Escalated / Help Triggered / Call Ready) ────
  const showCornerBell = status === "ESCALATED" || shouldFlashOrange;
  const cornerBellColor =
    status === "ESCALATED"
      ? "text-red-500 bg-red-50"
      : "text-amber-500 bg-amber-50";

  // ── Status badge ──────────────────────────────────────────────────────────
  const StatusBadge = () => {
    if (status === "ESCALATED") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-600">
          <BellIcon className="h-3 w-3" />
          Escalated
        </span>
      );
    }
    if (status === "HELP_TRIGGERED") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-600">
          <BellIcon className="h-3 w-3" />
          Help Triggered
        </span>
      );
    }
    if (status === "CALL_READY") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-600">
          <VideoIcon className="h-3 w-3" />
          Call Ready
        </span>
      );
    }
    if (status === "IN_SESSION") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-600">
          <VideoIcon className="h-3 w-3" />
          Active
        </span>
      );
    }
    // IDLE
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
        <ActivityIcon className="h-3 w-3" />
        Idle
      </span>
    );
  };

  // ── Priority row (Escalated / Help Triggered only) ────────────────────────
  const PriorityRow = () => {
    if (status === "ESCALATED") {
      return (
        <div className="mb-3 flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-1.5">
          <span className="text-xs font-semibold text-red-600">
            Priority: Critical
          </span>
          <span className="text-xs font-medium text-red-500">
            EMS dispatched
          </span>
        </div>
      );
    }
    if (status === "HELP_TRIGGERED") {
      return (
        <div className="mb-3 flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5">
          <span className="text-xs font-semibold text-amber-600">
            Priority: Medium
          </span>
          <span className="text-xs font-medium text-amber-500">
            Awaiting clinician
          </span>
        </div>
      );
    }
    if (status === "CALL_READY") {
      return (
        <div className="mb-3 flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5">
          <span className="text-xs font-semibold text-amber-600">
            Priority: High
          </span>
          <span className="text-xs font-medium text-amber-500">
            Ready to connect
          </span>
        </div>
      );
    }
    return null;
  };

  // ── Battery colour ────────────────────────────────────────────────────────
  const batteryColor =
    robot.battery <= 20
      ? "text-red-500"
      : robot.battery <= 50
        ? "text-amber-500"
        : "text-green-600";

  // ── Help triggered time label ─────────────────────────────────────────────
  const timeLabel =
    status === "ESCALATED" || status === "HELP_TRIGGERED"
      ? patient.help_event.triggered_at
        ? `Help triggered ${formatRelativeTime(patient.help_event.triggered_at)}`
        : null
      : `Last updated: ${formatRelativeTime(patient.last_updated)}`;

  // ── Join button ───────────────────────────────────────────────────────────
  // CALL_READY:     orange, enabled — clinician can join
  // HELP_TRIGGERED: greyed out, disabled — patient triggered help but session
  //                 isn't ready yet; clinician must wait for CALL_READY
  // ESCALATED:      red, enabled — join critical session
  // others:         default pink, enabled
  const joinButtonClasses =
    status === "ESCALATED"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : status === "CALL_READY"
        ? "bg-amber-500 hover:bg-amber-600 text-white"
        : status === "HELP_TRIGGERED"
          ? "bg-slate-200 text-slate-400 cursor-not-allowed"
          : "bg-pink-500 hover:bg-pink-600 text-white";

  const joinButtonDisabled =
    isJoining || status === "HELP_TRIGGERED";

  const joinButtonLabel =
    status === "ESCALATED"
      ? "Join Critical Session"
      : status === "CALL_READY"
        ? "Join Session"
        : status === "HELP_TRIGGERED"
          ? "Waiting for Patient…"
          : "Join Session";

  return (
    <div className={`relative rounded-xl bg-white p-5 shadow-sm ${cardBorder}`}>
      {/* Corner bell for urgent statuses */}
      {showCornerBell && (
        <div
          className={`absolute -top-2.5 -right-2.5 flex h-6 w-6 items-center justify-center rounded-full ${cornerBellColor} shadow-sm`}
          aria-hidden="true"
        >
          <BellIcon className="h-3.5 w-3.5" />
        </div>
      )}

      {/* Patient name */}
      <h3 className="mb-2 text-lg font-bold text-slate-900">{patient.name}</h3>

      {/* Status badge */}
      <div className="mb-3">
        <StatusBadge />
      </div>

      {/* Priority row */}
      <PriorityRow />

      {/* Room + Robot info */}
      <div className="mb-1 flex items-center gap-1.5 text-sm text-slate-600">
        <LocationIcon className="h-4 w-4 text-slate-400 shrink-0" />
        <span>{patient.address.line1}</span>
      </div>
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-slate-500">
          <WifiIcon className="h-4 w-4 text-slate-400 shrink-0" />
          {robot.connection === "online" ? "Robot Connected" : "Robot Offline"}
        </span>
        <span
          className={`flex items-center gap-1 text-xs font-semibold ${batteryColor}`}
        >
          <BatteryIcon className="h-4 w-4" />
          {robot.battery}%
        </span>
      </div>

      {/* Time label */}
      {timeLabel && (
        <p className="mb-4 flex items-center gap-1.5 text-xs text-slate-400">
          <ClockIcon className="h-3.5 w-3.5 shrink-0" />
          {timeLabel}
        </p>
      )}

      {/* Join button */}
      <button
        onClick={() => canJoinSession && onJoinSession(patient.patient_id)}
        disabled={joinButtonDisabled}
        className={`w-full rounded-lg py-2.5 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-400 disabled:opacity-60 disabled:cursor-not-allowed ${joinButtonClasses}`}
        aria-label={`${joinButtonLabel} for ${patient.name}`}
      >
        {isJoining ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Joining…
          </span>
        ) : (
          joinButtonLabel
        )}
      </button>
    </div>
  );
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M22 12h-4l-3 9L9 3l-3 9H2"
      />
    </svg>
  );
}

function LocationIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function WifiIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
      />
    </svg>
  );
}

function BatteryIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 7H7a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2V9a2 2 0 00-2-2h-2M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M9 7h6"
      />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
