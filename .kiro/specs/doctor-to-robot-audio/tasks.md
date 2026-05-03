# Tasks: Doctor-to-Robot Audio

## Task List

- [x] 1. WebSocket server on the robot (`stream_server.py`)
  - [x] 1.1 Implement RFC 6455 WebSocket handshake helper in `stream_server.py`
  - [x] 1.2 Add `/audio-input` path to `StreamHandler.do_GET` with single-client enforcement (close code 1008)
  - [x] 1.3 Implement WebSocket frame-reading loop that passes binary payloads to `AudioInputHandler`
  - [x] 1.4 Add module-level `_audio_input_active` flag and `_audio_input_lock` to `stream_server.py`
  - [x] 1.5 Ensure WebSocket server is initialised before the camera capture thread starts

- [x] 2. Audio playback engine (`AudioInputHandler`)
  - [x] 2.1 Create `AudioInputHandler` class with jitter buffer (`collections.deque`, min 2 / max 8 frames)
  - [x] 2.2 Implement `on_frame(data)`: decode Opus/WebM with `pyav`, resample to 16 kHz mono int16, enqueue PCM
  - [x] 2.3 Implement background `_playback_loop` thread: drain buffer to PyAudio output stream
  - [x] 2.4 Implement `on_disconnect()`: drain remaining frames within 500 ms, stop playback thread
  - [x] 2.5 Handle PyAudio output device unavailable at startup (log error, disable playback, WS still accepts)
  - [x] 2.6 Handle malformed frame in `on_frame`: log warning, discard, continue

- [x] 3. `useMicCapture` hook (`web_interface/hooks/useMicCapture.ts`)
  - [x] 3.1 Scaffold `useMicCapture(robotHost, active)` hook with `MicConnectionState` type and initial state (`isMuted=true`, `connectionState='idle'`)
  - [x] 3.2 Implement `getUserMedia` call on activation; set `'permission-denied'` on rejection
  - [x] 3.3 Open WebSocket to `ws://{robotHost}:8080/audio-input` on permission grant
  - [x] 3.4 Initialise `MediaRecorder` with `audio/webm;codecs=opus` (timeslice 200 ms); fall back to `audio/webm` with console warning
  - [x] 3.5 Wire `MediaRecorder.ondataavailable` to send binary frames when unmuted and WS is open
  - [x] 3.6 Implement `toggleMute` (flips `isMuted`; MediaRecorder keeps running)
  - [x] 3.7 Implement reconnect retry logic (up to `AUDIO_RECONNECT_ATTEMPTS` × `AUDIO_RECONNECT_DELAY_MS`)
  - [x] 3.8 Implement cleanup on `active=false` or unmount: stop MediaRecorder, close WS, stop all MediaStreamTrack instances
  - [x] 3.9 Implement mock mode (`NEXT_PUBLIC_USE_MOCK_API=true`): skip WS/MediaRecorder, report `'connected'` + `isMuted=true`

- [x] 4. `VideoPanel` UI updates
  - [x] 4.1 Add `useMicCapture` call to `VideoPanel`, deriving `robotHost` from `ROBOT_STREAM_HOST` constant
  - [x] 4.2 Render outgoing-audio status indicator (labels: "Connecting mic…", "Mic connected", "Mic disconnected", "Mic permission denied")
  - [x] 4.3 Render outgoing mute toggle button: "Speak" + MicOff icon when muted; "Mute Mic" + Mic icon when unmuted
  - [x] 4.4 Disable outgoing mute toggle when `connectionState !== 'connected'`
  - [x] 4.5 Add `ROBOT_STREAM_HOST` and `ROBOT_STREAM_PORT` constants to `lib/constants.ts`

- [x] 5. Frontend tests
  - [x] 5.1 Write unit tests for `useMicCapture` (permission denied, WS URL, MediaRecorder init, cleanup, mock mode, retry)
  - [x] 5.2 Write property test — Property 1: mute suppresses all transmission (fast-check, 100 runs)
  - [x] 5.3 Write property test — Property 2: unmuted transmission is complete (fast-check, 100 runs)
  - [x] 5.4 Write property test — Property 3: toggle is an involution (fast-check, 100 runs)
  - [x] 5.5 Write property test — Property 4: non-connected states disable the mute button (fast-check, 100 runs)
  - [x] 5.6 Write property test — Property 5: status indicator reflects connection state (fast-check, 100 runs)
  - [x] 5.7 Update `VideoPanel.test.tsx`: two distinct mute buttons, "Speak"/"Mute Mic" labels, disabled states, status indicator labels
  - [x] 5.8 Add MSW audio-input mock handler stub to `mocks/handlers/audio.ts`

- [x] 6. Python tests
  - [x] 6.1 Create `robot_control/tests/` directory with `__init__.py`
  - [x] 6.2 Write `test_audio_input_handler.py`: valid frame → PCM in buffer, malformed frame discarded (Property 6), resampling output format (Property 7), jitter buffer min/max, `on_disconnect` drains buffer
  - [x] 6.3 Write `test_ws_server.py`: single-client enforcement (1008), reconnect after disconnect (Property 9), server survives frame-loop exception
  - [x] 6.4 Write `test_audio_roundtrip.py`: encode PCM → Opus/WebM with pyav, feed to `on_frame`, verify PCM produced without error (Requirement 6.5)
