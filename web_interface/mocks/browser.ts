/**
 * mocks/browser.ts
 *
 * MSW browser worker setup.
 *
 * Usage — add to your root layout or _app:
 *
 *   if (process.env.NEXT_PUBLIC_USE_MOCK_API === 'true') {
 *     const { worker } = await import('@/mocks/browser');
 *     await worker.start({ onUnhandledRequest: 'bypass' });
 *   }
 *
 * The worker intercepts all fetch calls matching the registered handlers and
 * returns fixture JSON with a simulated 300–600 ms delay.
 * Every intercepted call is logged to the browser console as:
 *   [MOCK API] {METHOD} {path} → {status}
 */

import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
