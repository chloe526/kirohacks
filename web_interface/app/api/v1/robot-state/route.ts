import { NextResponse } from "next/server";
import { fetchLivePatient } from "@/lib/robotState";
import patientsFixture from "@/mocks/fixtures/patients.json";

/**
 * GET /api/v1/robot-state
 *
 * Proxy endpoint polled by the browser every few seconds.
 * Fetches live state from the robot (server-side, no CORS issues) and
 * returns the merged PatientRecord for pat-0001.
 *
 * Response headers disable all caching so every browser poll gets fresh data.
 */
export async function GET() {
  const base = patientsFixture.find((p) => p.patient_id === "pat-0001");
  if (!base) {
    return NextResponse.json(
      { error: "Patient pat-0001 not found in fixture" },
      { status: 404 }
    );
  }

  const patient = await fetchLivePatient(base);

  return NextResponse.json(patient, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}
