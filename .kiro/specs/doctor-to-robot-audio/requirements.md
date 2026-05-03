# Requirements Document

## Introduction

This feature adds a doctor-to-robot audio channel to the existing Chansey Care telehealth system. Currently, audio and video stream one-way from the robot to the doctor's browser. This feature enables the reverse direction: the doctor's microphone audio is captured in the browser, streamed over a WebSocket to the robot, and played back on the robot's speaker so the patient can hear the doctor.

The feature is designed for a single-doctor-per-session model. The doctor's microphone starts muted and can be toggled at any time while the stream server is running. Audio is encoded as Opus/WebM by the browser's `MediaRecorder` API and decoded and played back on the robot using a small jitter buffer for smooth playback.

---

## Glossary

- **Doctor_Client**: The Next.js web application running in the doctor's browser.
- **Robot_WS_Server**: The new WebSocket endpoint added to `stream_server.py` on port 8080 that receives audio from the Doctor_Client.
- **Audio_Playback_Engine**: The Python component on the robot that decodes incoming Opus/WebM chunks and plays them through PyAudio on the robot's speaker.
- **Jitter_Buffer**: A small in-memory queue on the robot that holds decoded audio frames to smooth over network timing variations before playback.
- **Mic_Capture_Hook**: The new or extended React hook in the web interface (`useMicCapture` or an extension of `useAudioSocket`) that manages `MediaRecorder`, WebSocket connection, and mute state for the doctor-to-robot direction.
- **Stream_Server**: The existing `stream_server.py` HTTP server on port 8080.
- **Session**: An active telehealth interaction between a doctor and a patient, identified by a `session_id`, during which the stream server is running.
- **Mute_State**: A boolean flag indicating whether the Doctor_Client is currently suppressing microphone capture and transmission.

---

## Requirements

### Requirement 1: WebSocket Endpoint on the Robot

**User Story:** As a doctor, I want my voice to reach the patient through the robot's speaker, so that I can communicate with the patient during a session.

#### Acceptance Criteria

1. WHEN the Stream_Server starts, THE Robot_WS_Server SHALL accept WebSocket connections at the path `/audio-input` on port 8080.
2. WHEN a WebSocket client connects to `/audio-input`, THE Robot_WS_Server SHALL accept binary frames containing Opus/WebM audio data.
3. WHEN a second WebSocket client attempts to connect to `/audio-input` while one connection is already active, THE Robot_WS_Server SHALL reject the new connection with WebSocket close code 1008 (Policy Violation).
4. WHEN the active WebSocket client disconnects, THE Robot_WS_Server SHALL allow a new client to connect to `/audio-input`.
5. IF the Robot_WS_Server encounters an unrecoverable error on the `/audio-input` endpoint, THEN THE Robot_WS_Server SHALL log the error and close the affected WebSocket connection without terminating the Stream_Server process.

---

### Requirement 2: Browser Microphone Capture and Transmission

**User Story:** As a doctor, I want the browser to capture my microphone and send it to the robot, so that the patient can hear me without me needing to configure anything manually.

#### Acceptance Criteria

1. WHEN a Session becomes active and the stream server is reachable, THE Mic_Capture_Hook SHALL request microphone permission from the browser using the `getUserMedia` API.
2. WHEN microphone permission is granted, THE Mic_Capture_Hook SHALL open a WebSocket connection to `ws://{robot_host}:8080/audio-input`.
3. WHEN the WebSocket connection to `/audio-input` is established, THE Mic_Capture_Hook SHALL initialise a `MediaRecorder` with Opus/WebM encoding and begin capturing audio in chunks of no more than 250 ms.
4. WHILE the Mute_State is `true`, THE Mic_Capture_Hook SHALL NOT transmit audio chunks over the WebSocket.
5. WHILE the Mute_State is `false` and the WebSocket connection is open, THE Mic_Capture_Hook SHALL send each `MediaRecorder` data chunk as a binary WebSocket frame immediately upon receipt.
6. THE Mic_Capture_Hook SHALL initialise with Mute_State set to `true`.
7. WHEN the doctor activates the mute toggle, THE Mic_Capture_Hook SHALL toggle the Mute_State between `true` and `false`.
8. IF microphone permission is denied by the browser, THEN THE Mic_Capture_Hook SHALL set the connection state to `'permission-denied'` and SHALL NOT attempt to open a WebSocket connection.
9. IF the WebSocket connection to `/audio-input` closes unexpectedly, THEN THE Mic_Capture_Hook SHALL attempt to reconnect up to `AUDIO_RECONNECT_ATTEMPTS` times with `AUDIO_RECONNECT_DELAY_MS` between attempts before setting the connection state to `'disconnected'`.
10. WHEN the Session becomes inactive, THE Mic_Capture_Hook SHALL stop the `MediaRecorder`, close the WebSocket connection, and release the microphone.

---

### Requirement 3: Audio Playback on the Robot

**User Story:** As a patient, I want to hear the doctor's voice through the robot's speaker clearly and without excessive interruptions, so that I can understand what the doctor is saying.

#### Acceptance Criteria

1. WHEN a binary WebSocket frame is received on `/audio-input`, THE Audio_Playback_Engine SHALL decode the Opus/WebM data and place the resulting PCM frames into the Jitter_Buffer.
2. THE Jitter_Buffer SHALL hold a minimum of 2 and a maximum of 8 decoded audio frames before beginning playback of a new utterance.
3. WHEN the Jitter_Buffer contains frames ready for playback, THE Audio_Playback_Engine SHALL output audio through the default PyAudio output device at 16 kHz, 16-bit mono PCM.
4. WHEN the Jitter_Buffer is empty and no new frames arrive within 500 ms, THE Audio_Playback_Engine SHALL treat the gap as silence and resume playback when new frames arrive.
5. IF the PyAudio output device is unavailable at startup, THEN THE Audio_Playback_Engine SHALL log the error and disable speaker playback without preventing the Robot_WS_Server from accepting connections.
6. IF decoding of a received audio frame fails, THEN THE Audio_Playback_Engine SHALL discard the malformed frame, log a warning, and continue processing subsequent frames.

---

### Requirement 4: Mute Toggle UI

**User Story:** As a doctor, I want a clearly visible mute/unmute button for my outgoing microphone, so that I can control whether the patient hears me at any time.

#### Acceptance Criteria

1. THE VideoPanel SHALL display a dedicated outgoing-audio mute toggle button that is visually distinct from the existing incoming-audio mute toggle.
2. WHEN the Mute_State is `true`, THE VideoPanel SHALL render the outgoing mute button with a muted-microphone icon and a label of "Speak" to indicate the doctor can activate their mic.
3. WHEN the Mute_State is `false`, THE VideoPanel SHALL render the outgoing mute button with an active-microphone icon and a label of "Mute Mic" to indicate the doctor's mic is live.
4. WHEN the outgoing mute toggle is clicked and the Mic_Capture_Hook connection state is `'connected'`, THE VideoPanel SHALL invoke the `toggleMute` function exposed by the Mic_Capture_Hook.
5. WHEN the Mic_Capture_Hook connection state is not `'connected'`, THE VideoPanel SHALL render the outgoing mute toggle in a disabled state.
6. THE VideoPanel SHALL display a status indicator for the outgoing audio connection that reflects the Mic_Capture_Hook connection state: `'connecting'`, `'connected'`, `'disconnected'`, or `'permission-denied'`.
7. WHEN the Mic_Capture_Hook connection state is `'permission-denied'`, THE VideoPanel SHALL display a status indicator with the label "Mic permission denied".

---

### Requirement 5: Connection Lifecycle and Cleanup

**User Story:** As a system operator, I want the audio connection to be reliably established and torn down with the session, so that microphone resources are never leaked and the robot is not left playing stale audio.

#### Acceptance Criteria

1. WHEN the stream server starts, THE Robot_WS_Server SHALL be ready to accept connections on `/audio-input` before the first video frame is served.
2. WHEN the Doctor_Client navigates away from the session page, THE Mic_Capture_Hook SHALL stop the `MediaRecorder` and close the WebSocket connection within 1 second.
3. WHEN the WebSocket connection on `/audio-input` closes for any reason, THE Audio_Playback_Engine SHALL drain the Jitter_Buffer and stop playback within 500 ms.
4. THE Mic_Capture_Hook SHALL release the browser microphone resource (stop all `MediaStreamTrack` instances) whenever the WebSocket connection closes, whether intentionally or due to error.
5. WHERE `NEXT_PUBLIC_USE_MOCK_API=true`, THE Mic_Capture_Hook SHALL skip WebSocket connection and `MediaRecorder` initialisation, and SHALL report connection state as `'connected'` with Mute_State `true`.

---

### Requirement 6: Audio Format Contract

**User Story:** As a developer, I want a clearly defined audio format contract between the browser and the robot, so that encoding and decoding are always compatible.

#### Acceptance Criteria

1. THE Mic_Capture_Hook SHALL encode outgoing audio using `MediaRecorder` with MIME type `audio/webm;codecs=opus`.
2. IF the browser does not support `audio/webm;codecs=opus`, THEN THE Mic_Capture_Hook SHALL fall back to `audio/webm` and log a warning to the browser console.
3. THE Audio_Playback_Engine SHALL decode received WebM/Opus data using the `pyav` library (or equivalent FFmpeg-based decoder) before writing PCM to the Jitter_Buffer.
4. THE Audio_Playback_Engine SHALL resample decoded audio to 16 kHz mono 16-bit PCM before writing to the PyAudio output stream.
5. FOR ALL valid Opus/WebM audio chunks produced by the Mic_Capture_Hook, the Audio_Playback_Engine SHALL successfully decode the chunk without error (round-trip compatibility property).
