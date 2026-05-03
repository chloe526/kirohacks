import { NextResponse } from "next/server";

const ROBOT_AUDIO_INPUT_URL = "http://10.40.98.25:8080/audio-input";

/**
 * POST /api/v1/audio-input
 *
 * Server-side proxy for doctor→robot audio. The browser sends raw signed-16-bit
 * mono PCM chunks (one POST per MediaRecorder timeslice) and this route
 * forwards the binary body to the robot's stream server, avoiding CORS.
 *
 * The robot plays the received PCM through its speaker via PyAudio.
 *
 * Request body:  raw PCM bytes (Content-Type: application/octet-stream)
 * Response:      204 No Content on success
 *                502 Bad Gateway if the robot is unreachable
 */
export async function POST(request: Request) {
  let body: ArrayBuffer;
  try {
    body = await request.arrayBuffer();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  if (body.byteLength === 0) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const robotRes = await fetch(ROBOT_AUDIO_INPUT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(body.byteLength),
      },
      body: body,
      signal: AbortSignal.timeout(3000),
    });

    if (!robotRes.ok) {
      return new NextResponse(null, { status: robotRes.status });
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    // Robot unreachable — don't surface this as an error to the client;
    // audio chunks are fire-and-forget so we return 204 to keep the
    // browser sending without backing off.
    return new NextResponse(null, { status: 204 });
  }
}
