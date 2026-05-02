/**
 * mocks/server.ts
 *
 * MSW Node server for use in Vitest tests.
 * Import and start this in test files that need mock API responses.
 *
 * @example
 * import { server } from '@/mocks/server';
 * beforeAll(() => server.listen());
 * afterEach(() => server.resetHandlers());
 * afterAll(() => server.close());
 */

import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
