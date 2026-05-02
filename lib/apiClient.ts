/**
 * lib/apiClient.ts
 *
 * Thin `fetch` wrapper for the Remote Robot Healthcare API.
 *
 * - Prepends `/api/v1` to every path.
 * - Sets `Content-Type: application/json` on every request.
 * - Throws a descriptive `Error` on any non-2xx response, including the
 *   HTTP status code and the response body (if available).
 *
 * Usage:
 *   import { get, post } from "@/lib/apiClient";
 *   const patient = await get<PatientRecord>(`/patients/${id}`);
 *   const result  = await post<SessionResult>("/sessions", { patient_id: id });
 */

const BASE = "/api/v1";

/**
 * Build a full URL by prepending the API base path.
 * Ensures exactly one `/` between the base and the caller-supplied path.
 */
function buildUrl(path: string): string {
  const normalised = path.startsWith("/") ? path : `/${path}`;
  return `${BASE}${normalised}`;
}

/**
 * Core fetch helper shared by `get` and `post`.
 * Throws an `Error` with status code and body text on non-2xx responses.
 */
async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = buildUrl(path);

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers ?? {}),
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    let body = "";
    try {
      body = await response.text();
    } catch {
      // ignore — body reading is best-effort
    }
    const detail = body ? `: ${body}` : "";
    throw new Error(
      `API request failed with status ${response.status}${detail}`
    );
  }

  // 204 No Content — return undefined cast to T
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

/**
 * Issue a GET request to `/api/v1{path}` and return the parsed JSON body.
 *
 * @example
 * const patient = await get<PatientRecord>("/patients/abc-123");
 */
export async function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" });
}

/**
 * Issue a POST request to `/api/v1{path}` with an optional JSON body and
 * return the parsed JSON response.
 *
 * @example
 * const session = await post<Session>("/sessions", { patient_id: "abc-123" });
 */
export async function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
