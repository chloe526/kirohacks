/**
 * mocks/handlers/audio.ts
 *
 * Mock handler for the audio WebSocket endpoint.
 *
 * In mock mode the website skips the real WebSocket and this handler acts as
 * a no-op placeholder. MSW 2 does not natively intercept WebSocket connections
 * in the browser, so this file documents the expected endpoint and provides a
 * server-side no-op for test environments.
 *
 * Expected endpoint: wss://{host}/api/v1/sessions/{session_id}/audio
 *
 * In the real implementation the robot streams binary audio frames over this
 * socket. The website pipes them to a Web Audio API AudioContext for playback.
 *
 * When NEXT_PUBLIC_USE_MOCK_API=true, useAudioSocket skips the WebSocket
 * entirely and returns connectionState: 'connected' immediately, rendering
 * a static "Audio (mocked)" badge in VideoPanel.
 */

// No MSW handler is registered here because MSW 2 browser mode does not
// intercept WebSocket connections. The mock behaviour is handled entirely
// inside the useAudioSocket hook via the NEXT_PUBLIC_USE_MOCK_API env flag.

export const audioHandlers: never[] = [];
