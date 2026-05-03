import { http, HttpResponse, delay } from "msw";

function randomDelay(): number {
  return Math.floor(Math.random() * 300) + 300;
}

function log(method: string, path: string, status: number): void {
  console.log(`[MOCK API] ${method} ${path} → ${status}`);
}

export const commandHandlers = [
  // POST /api/v1/sessions/:session_id/commands — acknowledge a robot command
  http.post(
    "/api/v1/sessions/:session_id/commands",
    async ({ params }) => {
      await delay(randomDelay());
      const { session_id } = params as { session_id: string };
      log("POST", `/api/v1/sessions/${session_id}/commands`, 200);
      return HttpResponse.json({ ok: true });
    }
  ),
];
