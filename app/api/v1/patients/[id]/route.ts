import { NextResponse } from "next/server";
import patientsFixture from "@/mocks/fixtures/patients.json";

/**
 * GET /api/v1/patients/:id
 * 
 * Returns a single patient by patient_id.
 * 
 * Requirements:
 * - Returns 404 if patient not found
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Simulate network delay (300-600ms) as per mock API spec
  const delay = Math.floor(Math.random() * 300) + 300;
  await new Promise((resolve) => setTimeout(resolve, delay));

  const patient = patientsFixture.find((p) => p.patient_id === params.id);

  if (!patient) {
    console.log(`[MOCK API] GET /api/v1/patients/${params.id} → 404`);
    return NextResponse.json(
      { error: "Patient not found" },
      { status: 404 }
    );
  }

  console.log(`[MOCK API] GET /api/v1/patients/${params.id} → 200`);
  return NextResponse.json(patient);
}
