// ─────────────────────────────────────────────────────────────────────────────
// PatientRecord — single source of truth for all UI state
// ─────────────────────────────────────────────────────────────────────────────

export type PatientStatus =
  | "IDLE"
  | "HELP_TRIGGERED"
  | "IN_SESSION"
  | "ESCALATED";

export interface PatientRecord {
  patient_id: string;
  name: string;
  address: {
    line1: string;
    line2: string;
  };
  status: PatientStatus;
  /** ISO 8601 timestamp of the last state change */
  last_updated: string;
  help_event: {
    /** ISO 8601 | null — set when status becomes HELP_TRIGGERED */
    triggered_at: string | null;
  };
  robot: {
    connection: "online" | "offline";
    /** 0–100 */
    battery: number;
    /** Human-readable label of the last command sent, e.g. "left" */
    last_command: string;
    /** ISO 8601 timestamp of the last command */
    last_command_at: string;
  };
  session: {
    session_id: string | null;
    active: boolean;
    /** ISO 8601 | null — set when clinician joins */
    started_at: string | null;
    /** ISO 8601 | null — set when session ends */
    ended_at: string | null;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Outbound payloads — produced by the UI, not consumed from it
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Five directional actions the doctor can send to the robot.
 * The website constructs and POSTs this JSON only — it does not execute
 * movement, wake-word detection, microphone capture, or ROS logic.
 */
export type RobotAction = "left" | "right" | "up" | "down" | "stop";

export interface RobotCommand {
  session_id: string;
  action: RobotAction;
  /** ISO 8601 UTC timestamp of when the button was clicked */
  issued_at: string;
}

export type Disposition = "resolved" | "follow_up" | "escalated";

export interface ReportPayload {
  session_id: string;
  clinician_id: string;
  chief_complaint: string;
  assessment: string;
  plan: string;
  disposition: Disposition;
  duration_seconds: number;
  /** ISO 8601 UTC timestamp */
  submitted_at: string;
}

export interface DispatchRequest {
  session_id: string;
  patient_id: string;
  reason: string;
  /** Concatenation of address.line1 + " " + address.line2 */
  address: string;
  /** ISO 8601 UTC timestamp */
  requested_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Zustand store shapes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Unified patient store — replaces the previous separate sessionStore,
 * patientStore, and robotStore.
 */
export interface PatientStore {
  // Dashboard: keyed map of all patients
  patients: Record<string, PatientRecord>;
  isLoadingList: boolean;
  listError: string | null;
  setPatients: (records: PatientRecord[]) => void;

  // Session page: single active patient
  activePatient: PatientRecord | null;
  isLoadingActive: boolean;
  activeError: string | null;
  setActivePatient: (record: PatientRecord) => void;
  /** Shallow-merge a partial update into activePatient (for optimistic updates) */
  patchActivePatient: (patch: Partial<PatientRecord>) => void;

  // Modal / dialog visibility
  isReportModalOpen: boolean;
  isDispatchDialogOpen: boolean;
  openReportModal: () => void;
  closeReportModal: () => void;
  openDispatchDialog: () => void;
  closeDispatchDialog: () => void;
}

export interface CommandStore {
  lastCommand: RobotCommand | null;
  commandStatus: "idle" | "acknowledged" | "failed";
  /** Capped at COMMAND_LOG_MAX (20), newest first */
  log: RobotCommand[];
  addCommand: (cmd: RobotCommand, success: boolean) => void;
  setCommandStatus: (s: "idle" | "acknowledged" | "failed") => void;
}
