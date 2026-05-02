import { NextResponse } from "next/server";
import patientsFixture from "@/mocks/fixtures/patients.json";

/**
 * GET /api/v1/patients
 * 
 * Returns the list of all patients from the mock fixture.
 * 
 * Requirements:
 * - Req 1.2: Fetch and display list of PatientRecord objects
 */
export async function GET() {
  // Simulate network delay (300-600ms) as per mock API spec
  const delay = Math.floor(Math.random() * 300) + 300;
  await new Promise((resolve) => setTimeout(resolve, delay));

  console.log("[MOCK API] GET /api/v1/patients → 200");

  return NextResponse.json(patientsFixture);
}
