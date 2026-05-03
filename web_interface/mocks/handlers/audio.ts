/**
 * mocks/handlers/audio.ts
 *
 * Mock handler stubs for audio-related endpoints.
 *
 * Incoming audio (robot→doctor):
 *   wss://{host}/api/v1/sessions/{session_id}/audio
 *   Handled entirely inside useAudioSocket via NEXT_PUBLIC_USE_MOCK_API flag.
 *
 * Outgoing audio (doctor→robot) — doctor-to-robot-audio spec:
 *   ws://{robotHost}:8080/audio-input
 *   MSW v2 browser mode does not intercept WebSocket connections, so mock
 *   behaviour is handled inside useMicCapture via NEXT_PUBLIC_USE_MOCK_API.
 *   When NEXT_PUBLIC_USE_MOCK_API=true, useMicCapture skips getUserMedia and
 *   the WebSocket entirely, reporting connectionState='connected' + isMuted=true.
 *
 * This file exports empty handler arrays so it can be safely imported by
 * mocks/handlers/index.ts without side effects.
 */

export const audioHandlers: never[] = [];
