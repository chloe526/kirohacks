import { NextResponse } from "next/server";
import patientsFixture from "@/mocks/fixtures/patients.json";

/**
 * POST /api/v1/patients/:id/join
 * 
 * Simulates a clinician joining a session with a patient.
 * 
 * Requirements:
 * - Req 1.5: POST /api/v1/patients/{patient_id}/join with clinician_id
 * - Returns updated patient with status: "IN_SESSION"
 * - Sets session.active: true
 * - Sets session.started_at: current timestamp
 * - Generates a session_id
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Simulate network delay (300-600ms) as per mock API spec
  const delay = Math.floor(Math.random() * 300) + 300;
  await new Promise((resolve) => setTimeout(resolve, delay));

  const patient = patientsFixture.find((p) => p.patient_id === params.id);

  if (!patient) {
    console.log(`[MOCK API] POST /api/v1/patients/${params.id}/join → 404`);
    return NextResponse.json(
      { error: "Patient not found" },
      { status: 404 }
    );
  }

  // Parse request body to get clinician_id (for logging purposes)
  try {
    const body = await request.json();
    console.log(
      `[MOCK API] POST /api/v1/patients/${params.id}/join (clinician: ${body.clinician_id}) → 200`
    );
  } catch {
    console.log(`[MOCK API] POST /api/v1/patients/${params.id}/join → 200`);
  }

  // Generate a session ID
  const sessionId = `sess-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  // Return updated patient with IN_SESSION status
  const updatedPatient = {
    ...patient,
    status: "IN_SESSION" as const,
    last_updated: now,
    session: {
      session_id: sessionId,
      active: true,
      started_at: now,
      ended_at: null,
    },
  };

  return NextResponse.json(updatedPatient);
}
