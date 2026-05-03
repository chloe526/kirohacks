import { NextResponse } from "next/server";
import patientsFixture from "@/mocks/fixtures/patients.json";
import { fetchLivePatient } from "@/lib/robotState";

/**
 * GET /api/v1/patients/:id
 *
 * Returns a single patient by patient_id.
 * For `pat-0001`, live robot state is the source of truth.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const base = patientsFixture.find((p) => p.patient_id === params.id);

  if (!base) {
    console.log(`[MOCK API] GET /api/v1/patients/${params.id} → 404`);
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const patient =
    base.patient_id === "pat-0001" ? await fetchLivePatient(base) : base;

  console.log(`[MOCK API] GET /api/v1/patients/${params.id} → 200`);
  return NextResponse.json(patient);
}
