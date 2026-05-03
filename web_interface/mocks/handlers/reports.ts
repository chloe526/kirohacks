import { http, HttpResponse, delay } from "msw";

function randomDelay(): number {
  return Math.floor(Math.random() * 300) + 300;
}

function log(method: string, path: string, status: number): void {
  console.log(`[MOCK API] ${method} ${path} → ${status}`);
}

export const reportHandlers = [
  // POST /api/v1/reports — submit a clinical report
  http.post("/api/v1/reports", async ({ request }) => {
    await delay(randomDelay());

    const body = (await request.json()) as Record<string, unknown>;

    // Simulate 422 if required fields are missing (for error-mode testing)
    const required = [
      "session_id",
      "clinician_id",
      "chief_complaint",
      "assessment",
      "plan",
      "disposition",
    ];
    const missing = required.filter((f) => !body[f]);

    if (missing.length > 0) {
      log("POST", "/api/v1/reports", 422);
      return HttpResponse.json(
        { error: "Missing required fields", fields: missing },
        { status: 422 }
      );
    }

    log("POST", "/api/v1/reports", 201);
    return HttpResponse.json(
      {
        report_id: `rep-${Date.now()}`,
        session_id: body.session_id,
        created_at: new Date().toISOString(),
      },
      { status: 201 }
    );
  }),
];
