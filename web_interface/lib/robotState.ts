/**
 * robotState.ts
 *
 * Shared helper for fetching live robot state from the robot endpoint and
 * building a fully-populated PatientRecord for pat-0001.
 *
 * The live endpoint is the source of truth for:
 *   status, last_updated, help_event, robot, session
 *
 * The fixture is used only for stable identity fields:
 *   patient_id, name, address
 */

const ROBOT_STATE_URL = "http://10.40.98.25:8081/state";

/** Minimal shape we expect from the robot state endpoint. */
interface RobotStateResponse {
  status?: string;
  last_updated?: string;
  help_event?: { triggered_at: string | null };
  robot?: {
    connection?: string;
    battery?: number;
    last_command?: string;
    last_command_at?: string;
  };
  session?: {
    session_id: string | null;
    active: boolean;
    started_at: string | null;
    ended_at: string | null;
  };
}

/** Normalize empty strings from the robot endpoint to null. */
function nullify(value: string | null | undefined): string | null {
  if (value === "" || value === undefined) return null;
  return value;
}

/**
 * Fetch live state for pat-0001 and merge it with the fixture base record.
 *
 * Returns the merged record with `live_state_connected: true` on success,
 * or the fixture record with `live_state_connected: false` on failure.
 */
export async function fetchLivePatient(
  base: Record<string, unknown>
): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(ROBOT_STATE_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      console.warn(
        `[FALLBACK] robot state unavailable for pat-0001 — HTTP ${res.status}`
      );
      return { ...base, live_state_connected: false };
    }

    const state: RobotStateResponse = await res.json();
    console.log("[LIVE] using robot state for pat-0001");

    const baseRecord = base as {
      patient_id: string;
      name: string;
      address: { line1: string; line2: string };
      status: string;
      last_updated: string;
      help_event: { triggered_at: string | null };
      robot: {
        connection: string;
        battery: number;
        last_command: string;
        last_command_at: string;
      };
      session: {
        session_id: string | null;
        active: boolean;
        started_at: string | null;
        ended_at: string | null;
      };
    };

    return {
      // Identity — always from fixture
      patient_id: baseRecord.patient_id,
      name: baseRecord.name,
      address: baseRecord.address,

      // Live state fields — live endpoint is source of truth
      status: state.status ?? baseRecord.status,
      last_updated: new Date().toISOString(),

      help_event: {
        triggered_at: nullify(
          state.help_event?.triggered_at ??
          baseRecord.help_event.triggered_at
        ),
      },

      robot: {
        connection: state.robot?.connection ?? baseRecord.robot.connection,
        battery: state.robot?.battery ?? baseRecord.robot.battery,
        last_command: nullify(state.robot?.last_command) ?? baseRecord.robot.last_command,
        last_command_at: nullify(state.robot?.last_command_at) ?? baseRecord.robot.last_command_at,
      },

      session: state.session
        ? {
            session_id: nullify(state.session.session_id),
            active: state.session.active,
            started_at: nullify(state.session.started_at),
            ended_at: nullify(state.session.ended_at),
          }
        : baseRecord.session,

      live_state_connected: true,
    };
  } catch (err) {
    console.warn("[FALLBACK] robot state unavailable for pat-0001:", err);
    return { ...base, live_state_connected: false };
  }
}
