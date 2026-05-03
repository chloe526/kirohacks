import { http, HttpResponse, delay } from "msw";
import type { PatientRecord } from "@/types";
import fixturePatients from "@/mocks/fixtures/patients.json";

const patients = fixturePatients as PatientRecord[];

/** Returns a random delay between 300 ms and 600 ms to simulate network latency. */
function randomDelay(): number {
  return Math.floor(Math.random() * 300) + 300;
}

function log(method: string, path: string, status: number): void {
  console.log(`[MOCK API] ${method} ${path} → ${status}`);
}

export const patientHandlers = [
  // GET /api/v1/patients — return all fixture patients
  http.get("/api/v1/patients", async () => {
    await delay(randomDelay());
    log("GET", "/api/v1/patients", 200);
    return HttpResponse.json(patients);
  }),

  // GET /api/v1/patients/:patient_id — return a single fixture patient
  http.get("/api/v1/patients/:patient_id", async ({ params }) => {
    await delay(randomDelay());
    const { patient_id } = params as { patient_id: string };
    const record = patients.find((p) => p.patient_id === patient_id);

    if (!record) {
      log("GET", `/api/v1/patients/${patient_id}`, 404);
      return HttpResponse.json(
        { error: `Patient ${patient_id} not found` },
        { status: 404 }
      );
    }

    log("GET", `/api/v1/patients/${patient_id}`, 200);
    return HttpResponse.json(record);
  }),

  // POST /api/v1/patients/:patient_id/join — transition to IN_SESSION
  http.post("/api/v1/patients/:patient_id/join", async ({ params }) => {
    await delay(randomDelay());
    const { patient_id } = params as { patient_id: string };
    const record = patients.find((p) => p.patient_id === patient_id);

    if (!record) {
      log("POST", `/api/v1/patients/${patient_id}/join`, 404);
      return HttpResponse.json(
        { error: `Patient ${patient_id} not found` },
        { status: 404 }
      );
    }

    const updated: PatientRecord = {
      ...record,
      status: "IN_SESSION",
      last_updated: new Date().toISOString(),
      session: {
        ...record.session,
        session_id: record.session.session_id ?? `sess-${Date.now()}`,
        active: true,
        started_at: new Date().toISOString(),
        ended_at: null,
      },
    };

    log("POST", `/api/v1/patients/${patient_id}/join`, 200);
    return HttpResponse.json(updated);
  }),
];
