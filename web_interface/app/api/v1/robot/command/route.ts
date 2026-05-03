import { NextResponse } from "next/server";

const ROBOT_STATE_URL = "http://10.40.98.25:8081/state";

/**
 * POST /api/v1/robot/command
 *
 * Server-side proxy for robot movement commands. Forwards to the robot
 * state endpoint as a PUT, avoiding browser CORS restrictions.
 *
 * Request body:  { "move": "left" | "right" | "up" | "down" | "stop" }
 * Response:      { ok: true, state: PatientRecord } on success
 *                { error: string } on failure
 */
export async function POST(request: Request) {
  let move: string;

  try {
    const body = await request.json();
    move = body.move;
    if (!move) {
      return NextResponse.json({ error: "Missing move field" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  console.log(`[ROBOT COMMAND] forwarding PUT ${ROBOT_STATE_URL} → { move: "${move}" }`);

  try {
    const robotRes = await fetch(ROBOT_STATE_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ move }),
      signal: AbortSignal.timeout(5000),
    });

    const text = await robotRes.text();
    console.log(`[ROBOT COMMAND] robot responded ${robotRes.status}: ${text}`);

    if (!robotRes.ok) {
      return NextResponse.json(
        { error: `Robot returned ${robotRes.status}: ${text}` },
        { status: robotRes.status }
      );
    }

    // Parse and return the robot's response (includes updated state)
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data);
    } catch {
      // Robot returned non-JSON 200 — treat as success with no state update
      return NextResponse.json({ ok: true });
    }
  } catch (err) {
    console.error("[ROBOT COMMAND] proxy fetch failed:", err);
    return NextResponse.json(
      { error: "Robot unreachable" },
      { status: 502 }
    );
  }
}
