/**
 * lib/constants.ts
 *
 * Application-wide constants. Import from here rather than scattering
 * magic numbers across components.
 */

// ── Polling intervals (milliseconds) ─────────────────────────────────────────

/** How often the Dashboard re-fetches the patient list (Req 1.7) */
export const POLL_INTERVAL_MS = 10_000;

/** How often the Session Page re-fetches the PatientRecord for robot status (Req 4.5) */
export const ROBOT_POLL_INTERVAL_MS = 15_000;

/** How often the Patient Status Screen re-fetches the PatientRecord (Req 11.7) */
export const PATIENT_STATUS_POLL_MS = 5_000;

// ── Audio WebSocket (Req 5.8) ─────────────────────────────────────────────────

/** Maximum number of reconnect attempts before giving up */
export const AUDIO_RECONNECT_ATTEMPTS = 3;

/** Delay between reconnect attempts in milliseconds */
export const AUDIO_RECONNECT_DELAY_MS = 2_000;

// ── Command log (Req 6.6) ─────────────────────────────────────────────────────

/** Maximum number of commands retained in the scrollable command log */
export const COMMAND_LOG_MAX = 20;

// ── Dispatch dialog (Req 8.3) ─────────────────────────────────────────────────

/** Minimum character count required in the "Reason for dispatch" field */
export const DISPATCH_REASON_MIN_CHARS = 10;

// ── Report form character limits (Req 7.2) ────────────────────────────────────

export const CHIEF_COMPLAINT_MAX_CHARS = 500;
export const ASSESSMENT_MAX_CHARS = 1_000;
export const PLAN_MAX_CHARS = 1_000;

// ── Battery threshold (Req 4.3) ───────────────────────────────────────────────

/** Battery percentage at or below which the "Low Battery" warning is shown */
export const BATTERY_LOW_THRESHOLD = 20;
