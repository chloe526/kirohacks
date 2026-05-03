import { NextResponse } from "next/server";
import patientsFixture from "@/mocks/fixtures/patients.json";
import { fetchLivePatient } from "@/lib/robotState";

/**
 * GET /api/v1/patients
 *
 * Returns the list of all patients.
 * For `pat-0001`, live robot state from http://10.40.98.25:8081/state is the
 * source of truth for status, robot, help_event, and session fields.
 * All other patients are returned from fixture data unchanged.
 */
export async function GET() {
  const patients = await Promise.all(
    patientsFixture.map(async (p) => {
      if (p.patient_id === "pat-0001") {
        return fetchLivePatient(p);
      }
      return p;
    })
  );

  console.log("[MOCK API] GET /api/v1/patients → 200");
  return NextResponse.json(patients);
}
