import { http, HttpResponse, delay } from "msw";
import type { PatientRecord } from "@/types";
import fixturePatients from "@/mocks/fixtures/patients.json";

const patients = fixturePatients as PatientRecord[];

function randomDelay(): number {
  return Math.floor(Math.random() * 300) + 300;
}

function log(method: string, path: string, status: number): void {
  console.log(`[MOCK API] ${method} ${path} → ${status}`);
}

// Track dispatched session IDs to simulate 409 on duplicate
const dispatchedSessions = new Set<string>();

export const dispatchHandlers = [
  // POST /api/v1/dispatch — escalate to emergency services
  http.post("/api/v1/dispatch", async ({ request }) => {
    await delay(randomDelay());

    const body = (await request.json()) as {
      session_id: string;
      patient_id: string;
      reason: string;
      address: string;
      requested_at: string;
    };

    // Simulate 409 on duplicate dispatch for the same session
    if (dispatchedSessions.has(body.session_id)) {
      log("POST", "/api/v1/dispatch", 409);
      return HttpResponse.json(
        {
          error: "Emergency services were already dispatched for this session",
          dispatch_id: `disp-${body.session_id}`,
        },
        { status: 409 }
      );
    }

    dispatchedSessions.add(body.session_id);

    const record = patients.find((p) => p.patient_id === body.patient_id);
    const updated: PatientRecord | null = record
      ? {
          ...record,
          status: "ESCALATED",
          last_updated: new Date().toISOString(),
        }
      : null;

    log("POST", "/api/v1/dispatch", 200);
    return HttpResponse.json({
      dispatch_id: `disp-${Date.now()}`,
      session_id: body.session_id,
      status: "dispatched",
      timestamp_utc: new Date().toISOString(),
      patient: updated,
    });
  }),
];
