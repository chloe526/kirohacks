# Implementation Tasks

## Milestone 1: Data Foundation

**Goal:** Establish all TypeScript types, fixture data, formatter utilities, and the mock API layer. Every subsequent milestone depends on this being correct and complete.

**Dependencies:** None — this is the base layer.

**Files to create/modify:**
- `types/index.ts`
- `mocks/fixtures/patients.json`
- `lib/formatters.ts`
- `lib/constants.ts`
- `mocks/handlers/patients.ts`
- `mocks/handlers/commands.ts`
- `mocks/handlers/reports.ts`
- `mocks/handlers/dispatch.ts`
- `mocks/handlers/audio.ts`
- `mocks/browser.ts`

**What NOT to implement yet:** Any React components, pages, stores, or routing.

---

- [x] 1.1 Define all TypeScript interfaces in `types/index.ts`: `PatientRecord`, `PatientStatus`, `RobotAction`, `RobotCommand`, `ReportPayload`, `DispatchRequest`, `PatientStore`, `CommandStore`
- [x] 1.2 Create `mocks/fixtures/patients.json` with three `PatientRecord` objects: one `IDLE`, one `HELP_TRIGGERED` (non-null `help_event.triggered_at`), one `IN_SESSION` (non-null `session.started_at`, non-null `session.session_id`)
- [x] 1.3 Implement `lib/formatters.ts` with: `formatLocalTime(iso: string): string`, `formatRelativeTime(iso: string): string` (e.g. "2 minutes ago"), `formatDuration(startIso: string, endIso?: string): string` (e.g. "4 minutes 12 seconds"), `formatLastCommand(iso: string): string` (e.g. "Last command: 30 seconds ago")
- [x] 1.4 Create `lib/constants.ts` with: `POLL_INTERVAL_MS = 10_000`, `ROBOT_POLL_INTERVAL_MS = 15_000`, `PATIENT_STATUS_POLL_MS = 5_000`, `AUDIO_RECONNECT_ATTEMPTS = 3`, `AUDIO_RECONNECT_DELAY_MS = 2_000`, `COMMAND_LOG_MAX = 20`, `DISPATCH_REASON_MIN_CHARS = 10`
- [x] 1.5 Set up MSW in `mocks/browser.ts` and implement all mock handlers: `GET /api/v1/patients` → array from fixture, `GET /api/v1/patients/:id` → single fixture record, `POST /api/v1/patients/:id/join` → returns updated record with `status: IN_SESSION` and `session.started_at: now()`, `POST /api/v1/sessions/:id/commands` → returns `{ ok: true }`, `POST /api/v1/reports` → returns `{ report_id: "rep-001" }` with HTTP 201, `POST /api/v1/dispatch` → returns updated record with `status: ESCALATED`, `WS /api/v1/sessions/:id/audio` → no-op mock (immediately closes or sends silence)
- [x] 1.6 Write unit tests in `__tests__/unit/formatters.test.ts` covering: relative time under 60 s, relative time over 60 s, duration with end time, duration without end time (counts from start to now), `formatLocalTime` returns a non-empty locale string

**Acceptance criteria:**
- All TypeScript types compile with no errors
- `patients.json` fixture validates against the `PatientRecord` interface
- All formatter functions return correctly formatted strings for known inputs
- MSW handlers return the correct fixture shapes and HTTP status codes when called directly in tests
- Console logs `[MOCK API] {METHOD} {path} → {status}` for every intercepted call

---

## Milestone 2: Doctor Dashboard

**Goal:** Render the patient list from fixture data, show status badges with correct colours, surface the `HELP_TRIGGERED` urgency state, and wire up the "Join Session" button to navigate to the session page.

**Dependencies:** Milestone 1 (types, fixtures, mock API, formatters).

**Files to create/modify:**
- `stores/patientStore.ts`
- `lib/apiClient.ts`
- `app/(doctor)/page.tsx`
- `components/dashboard/PatientCard.tsx`
- `components/dashboard/EmptyState.tsx`
- `components/ui/Badge.tsx`
- `components/ui/Spinner.tsx`

**What NOT to implement yet:** Session page, robot controls, audio, report modal, dispatch dialog.

---

- [ ] 2.1 Create `lib/apiClient.ts` as a thin `fetch` wrapper that prepends `/api/v1`, sets `Content-Type: application/json`, and throws on non-2xx responses
- [ ] 2.2 Create `stores/patientStore.ts` (Zustand) with: `patients: Record<string, PatientRecord>`, `isLoadingList`, `listError`, `setPatients()`, `activePatient: PatientRecord | null`, `setActivePatient()`, `patchActivePatient()`, and UI booleans `isReportModalOpen`, `isDispatchDialogOpen` with their open/close actions
- [ ] 2.3 Build `components/ui/Badge.tsx`: accepts `status: PatientStatus` and renders a colour-coded pill — grey for `IDLE`, amber + `animate-pulse` for `HELP_TRIGGERED`, green for `IN_SESSION`, red for `ESCALATED`
- [ ] 2.4 Build `components/dashboard/PatientCard.tsx`: displays `patient.name`, `Badge`, `patient.last_updated` via `formatLocalTime`, and a "Join Session" button enabled only when `status === 'HELP_TRIGGERED'`; when `HELP_TRIGGERED` the entire card has a flashing amber border (`animate-pulse border-amber-500`)
- [ ] 2.5 Build `app/(doctor)/page.tsx` (Dashboard): on mount fetch `GET /api/v1/patients`, store results in `patientStore`, render sorted list (`HELP_TRIGGERED` → `IN_SESSION` → `ESCALATED` → `IDLE`), poll every `POLL_INTERVAL_MS`, show `EmptyState` when list is empty, show inline error on card if join fails
- [ ] 2.6 Wire "Join Session" button: call `POST /api/v1/patients/:id/join`, optimistically patch `patientStore` with `status: IN_SESSION`, then `router.push('/sessions/{patient_id}')`

**Acceptance criteria:**
- Dashboard renders all three fixture patients with correct badge colours
- `HELP_TRIGGERED` card has flashing amber border
- List is sorted in priority order
- "Join Session" button is disabled on `IDLE` and `IN_SESSION` cards
- Clicking "Join Session" on a `HELP_TRIGGERED` card navigates to `/sessions/{patient_id}`
- Dashboard re-fetches every 10 seconds without a full page reload
- Empty state message appears when no patients are returned

---

## Milestone 3: Session Page Layout

**Goal:** Build the three-panel session page shell — fixed header with timer and status badge, left patient profile panel, centre video placeholder, right action panel — all populated from a single `PatientRecord`.

**Dependencies:** Milestone 1 (types, formatters), Milestone 2 (patientStore, routing).

**Files to create/modify:**
- `app/(doctor)/sessions/[id]/page.tsx`
- `components/session/SessionHeader.tsx`
- `components/session/SessionStatusBadge.tsx`
- `components/session/SessionTimer.tsx`
- `components/session/PatientProfilePanel.tsx`
- `components/session/PatientInfoCard.tsx`
- `components/session/VideoPanel.tsx` (placeholder only — no audio yet)
- `components/session/AlertStatusCard.tsx`
- `components/ui/Card.tsx`

**What NOT to implement yet:** Robot controls, audio WebSocket, report modal, dispatch dialog, command log.

---

- [ ] 3.1 Build `components/session/SessionHeader.tsx`: displays `patient.name`, `SessionStatusBadge`, `SessionTimer` (counting up from `patient.session.started_at`), "End Session" button (opens report modal — stub for now), "Dispatch Emergency Services" button (opens dispatch dialog — stub for now); when `patient.status === 'ESCALATED'` disable dispatch button and relabel "Dispatched"
- [ ] 3.2 Build `components/session/SessionTimer.tsx`: accepts `startedAt: string | null`; uses `setInterval` (1 s) to count up from `startedAt`; renders `HH:MM:SS`; cleans up interval on unmount
- [ ] 3.3 Build `components/session/PatientInfoCard.tsx`: renders placeholder avatar, `patient.name`, `patient.address.line1`, `patient.address.line2`; shows "Patient profile unavailable" if `activePatient` is null without blocking the rest of the page
- [ ] 3.4 Build `components/session/VideoPanel.tsx` (placeholder only): 16:9 dark area, camera icon, "Live video feed — not yet connected" text, `patient.name` overlay bottom-left, connection badge top-right derived from `patient.robot.connection`; no audio logic yet
- [ ] 3.5 Build `components/session/AlertStatusCard.tsx`: neutral for `IDLE`; amber border + pulse + "Help triggered X ago" counter for `HELP_TRIGGERED`; green border for `IN_SESSION`; red glow + pulse + "ESCALATED — Emergency services dispatched" for `ESCALATED`
- [ ] 3.6 Assemble `app/(doctor)/sessions/[id]/page.tsx`: fetch `PatientRecord` on mount, store in `patientStore.activePatient`, poll every `POLL_INTERVAL_MS`; render three-panel layout (left: `PatientProfilePanel`, centre: `VideoPanel`, right: `AlertStatusCard` + stubs); when `patient.status` is `IDLE` with `session.ended_at` non-null or `ESCALATED`, replace centre panel with a summary/confirmation message and disable controls

**Acceptance criteria:**
- Session page loads the correct `PatientRecord` for the URL `patient_id`
- Header shows patient name, status badge, and a running timer
- Left panel shows name and address from fixture
- Centre panel shows the video placeholder with correct connection badge
- Right panel shows `AlertStatusCard` with correct visual state for each status
- Navigating directly to `/sessions/{patient_id}` loads the correct data
- When status is `ESCALATED`, dispatch button is disabled and relabelled

---

## Milestone 4: Robot Controls

**Goal:** Implement the five directional control buttons, `RobotCommand` JSON construction and POST, last-command display, and command log.

**Dependencies:** Milestone 3 (session page, patientStore, commandStore).

**Files to create/modify:**
- `stores/commandStore.ts`
- `components/session/ControlBar.tsx`
- `components/session/MovementPad.tsx`
- `components/session/CommandButton.tsx`
- `components/session/LastCommandPanel.tsx`
- `components/session/CommandLog.tsx`
- `components/session/RobotStatusCard.tsx`

**What NOT to implement yet:** Audio WebSocket, report modal, dispatch dialog.

---

- [ ] 4.1 Create `stores/commandStore.ts` (Zustand): `lastCommand: RobotCommand | null`, `commandStatus: 'idle' | 'acknowledged' | 'failed'`, `log: RobotCommand[]` (max `COMMAND_LOG_MAX`), `addCommand(cmd, success)`, `setCommandStatus()`
- [ ] 4.2 Build `components/session/RobotStatusCard.tsx`: online/offline dot from `robot.connection`, battery progress bar (red + "Low Battery" when `robot.battery ≤ 20`), `robot.last_command` label, `robot.last_command_at` via `formatLastCommand`; amber offline banner when `robot.connection === 'offline'`
- [ ] 4.3 Build `components/session/CommandButton.tsx`: accepts `sessionId`, `action: RobotAction`, `label`, `icon`, `disabled`; on click builds `RobotCommand { session_id, action, issued_at: now() }`, POSTs to `/api/v1/sessions/{sessionId}/commands`, calls `commandStore.addCommand`, patches `patientStore.activePatient.robot.last_command` and `last_command_at`; shows 3 s "Command sent" / "Command failed" indicator
- [ ] 4.4 Build `components/session/MovementPad.tsx`: renders five `CommandButton` instances for `left`, `right`, `up`, `down`, `stop` in a D-pad layout; all disabled when `robotOnline === false` with tooltip "Robot is offline"
- [ ] 4.5 Build `components/session/LastCommandPanel.tsx`: renders `commandStore.lastCommand` as indented JSON in a `<pre>` block; shows "Command sent" (green) or "Command failed" (red) badge from `commandStore.commandStatus`; shows placeholder text "No commands sent yet" when `lastCommand` is null
- [ ] 4.6 Build `components/session/CommandLog.tsx`: scrollable list of last 20 `RobotCommand` entries from `commandStore.log`; each row shows `cmd.action` and `formatLocalTime(cmd.issued_at)`; newest entry at top

**Acceptance criteria:**
- Clicking each of the five buttons POSTs the correct `{ session_id, action, issued_at }` JSON
- `LastCommandPanel` updates immediately after each click and renders valid indented JSON
- Command log shows up to 20 entries, oldest entry drops off when limit is exceeded
- All buttons are disabled when `patient.robot.connection === 'offline'`
- Battery bar turns red and shows "Low Battery" when `robot.battery ≤ 20`
- "Command sent" indicator appears for 3 seconds then clears

---

## Milestone 5: Audio WebSocket UI

**Goal:** Connect the `VideoPanel` to the audio WebSocket, play the incoming stream, show connection state, and implement mute/unmute and reconnect behaviour. In mock mode, show a static "Audio (mocked)" badge.

**Dependencies:** Milestone 3 (VideoPanel shell, session page, patientStore).

**Files to create/modify:**
- `components/session/VideoPanel.tsx` (extend from Milestone 3)
- `hooks/useAudioSocket.ts`
- `mocks/handlers/audio.ts` (extend from Milestone 1)

**What NOT to implement yet:** Report modal, dispatch dialog, patient status screen.

---

- [ ] 5.1 Create `hooks/useAudioSocket.ts`: accepts `sessionId: string | null` and `active: boolean`; when `active` is true opens `WebSocket` at `wss://{host}/api/v1/sessions/{sessionId}/audio`; exposes `connectionState: 'connecting' | 'connected' | 'disconnected'`, `isMuted: boolean`, `toggleMute()`, and `reconnectCount: number`; on close/error retries up to `AUDIO_RECONNECT_ATTEMPTS` times with `AUDIO_RECONNECT_DELAY_MS` delay; cleans up on unmount or when `active` becomes false
- [ ] 5.2 Pipe WebSocket binary frames to a Web Audio API `AudioContext`: in `useAudioSocket`, decode incoming `ArrayBuffer` messages via `AudioContext.decodeAudioData` and schedule playback; suspend `AudioContext` when muted, resume when unmuted
- [ ] 5.3 Integrate `useAudioSocket` into `VideoPanel.tsx`: pass `sessionId` and `sessionActive` props; render audio status indicator — green mic icon ("Audio connected") when `connected`, red strikethrough mic ("Audio disconnected") when `disconnected`, amber spinner when `connecting`; show "Reconnecting audio… (attempt N/3)" during retry
- [ ] 5.4 Add mute/unmute toggle button to `VideoPanel`: calls `toggleMute()` from the hook; button label and icon reflect `isMuted` state; button is disabled when `connectionState !== 'connected'`
- [ ] 5.5 Mock mode fallback: when `NEXT_PUBLIC_USE_MOCK_API=true`, `useAudioSocket` skips the WebSocket entirely and returns `connectionState: 'connected'` immediately; `VideoPanel` renders a static "Audio (mocked)" badge in place of the live indicator

**Acceptance criteria:**
- In mock mode, `VideoPanel` shows "Audio (mocked)" badge and mute toggle is functional
- In live mode, audio status indicator reflects WebSocket `readyState`
- Mute toggle suspends/resumes audio without closing the socket
- On disconnect, the hook retries up to 3 times showing the attempt count
- After 3 failed retries, indicator shows "Audio disconnected" permanently until session restarts
- WebSocket is closed when `sessionActive` becomes false

---

## Milestone 6: EMS Dispatch

**Goal:** Implement the "Dispatch Emergency Services" confirmation dialog, reason validation, dispatch JSON construction, and the `ESCALATED` UI state.

**Dependencies:** Milestone 3 (session page, session header, patientStore).

**Files to create/modify:**
- `components/modals/DispatchConfirmDialog.tsx`
- `components/session/SessionHeader.tsx` (wire dispatch button)
- `stores/patientStore.ts` (dispatch dialog open/close already stubbed)

**What NOT to implement yet:** Report modal, patient status screen.

---

- [ ] 6.1 Build `components/modals/DispatchConfirmDialog.tsx`: modal overlay showing `patient.name`, `patient.address.line1 + line2`, and a required "Reason for dispatch" textarea; "Confirm Dispatch" button disabled until reason length ≥ `DISPATCH_REASON_MIN_CHARS`; "Cancel" closes dialog without action
- [ ] 6.2 On confirm: construct `DispatchRequest { session_id, patient_id, reason, address, requested_at: now() }` and POST to `/api/v1/dispatch`; show loading state on confirm button during request
- [ ] 6.3 On successful dispatch response: close dialog, optimistically patch `patientStore.activePatient.status → ESCALATED`, display a persistent banner "Emergency services have been dispatched" (non-dismissable)
- [ ] 6.4 Handle HTTP 409 (duplicate dispatch): show inline message "Emergency services were already dispatched for this session" inside the dialog and close after 2 seconds
- [ ] 6.5 Wire dispatch button in `SessionHeader.tsx`: calls `patientStore.openDispatchDialog()`; when `patient.status === 'ESCALATED'` button is disabled and labelled "Dispatched ✓" in a muted style (not red)

**Acceptance criteria:**
- "Confirm Dispatch" button is disabled until reason has ≥ 10 characters
- Submitting POSTs the correct `DispatchRequest` JSON shape
- After success, session header dispatch button is disabled and relabelled "Dispatched ✓"
- Persistent "Emergency services have been dispatched" banner is visible and cannot be dismissed
- `AlertStatusCard` transitions to `ESCALATED` visual state (red glow, pulse)
- HTTP 409 shows the duplicate message without crashing

---

## Milestone 7: Report Flow

**Goal:** Implement the end-session report modal, form validation, report JSON construction, and the transition back to `IDLE` status.

**Dependencies:** Milestone 3 (session page, session header, patientStore), Milestone 1 (formatters for duration).

**Files to create/modify:**
- `components/modals/ReportModal.tsx`
- `components/modals/ReportForm.tsx`
- `components/modals/EndSessionConfirmDialog.tsx`
- `components/ui/Toast.tsx`
- `components/session/SessionHeader.tsx` (wire end session button)

**What NOT to implement yet:** Patient status screen.

---

- [ ] 7.1 Build `components/modals/ReportForm.tsx`: fields — `chief_complaint` (textarea, max 500 chars, required), `assessment` (textarea, max 1000 chars, required), `plan` (textarea, max 1000 chars, required), `disposition` (radio: "Resolved" / "Follow-up Required" / "Escalate to Emergency Services"); read-only header showing `session_id`, `patient.name`, and elapsed duration from `formatDuration(session.started_at)`; inline validation errors on empty required fields; character counter on each textarea
- [ ] 7.2 Build `components/modals/ReportModal.tsx`: wraps `ReportForm` in a modal overlay; on submit constructs `ReportPayload { session_id, clinician_id, chief_complaint, assessment, plan, disposition, duration_seconds, submitted_at: now() }` and POSTs to `/api/v1/reports`; shows loading state on submit button; on HTTP 201 closes modal and fires success toast; on HTTP 422 displays server field errors inside form without closing
- [ ] 7.3 Build `components/modals/EndSessionConfirmDialog.tsx`: shown when clinician dismisses the report modal without submitting; message "Are you sure? The session will remain open until a report is submitted."; "Go Back" returns to report form, "Leave Anyway" closes both dialogs
- [ ] 7.4 Build `components/ui/Toast.tsx`: temporary notification (3 s auto-dismiss) rendered at top-right; accepts `message: string` and `variant: 'success' | 'error'`
- [ ] 7.5 On successful report submission: optimistically patch `patientStore.activePatient` — set `status → IDLE`, `session.ended_at → now()`, `session.active → false`; show success toast "Report submitted successfully"
- [ ] 7.6 Wire "End Session" button in `SessionHeader.tsx`: calls `patientStore.openReportModal()`; button is disabled when `patient.status` is not `IN_SESSION`

**Acceptance criteria:**
- Report form shows inline validation errors when any required field is empty on submit
- Character counters update as the clinician types
- Submitting POSTs the correct `ReportPayload` JSON shape with `duration_seconds` derived from the session timer
- After HTTP 201, session status badge updates to `IDLE` and centre panel shows session summary
- Dismissing the modal without submitting shows the confirmation dialog
- "Leave Anyway" closes both dialogs; session remains open (status unchanged)
- Toast appears for 3 seconds then disappears

---

## Milestone 8: Patient Status Screen

**Goal:** Build the read-only `/patient/{patient_id}/status` page that displays the current status in large text, shows relative time counters, and polls every 5 seconds.

**Dependencies:** Milestone 1 (types, formatters, mock API `GET /api/v1/patients/:id`).

**Files to create/modify:**
- `app/patient/[id]/status/page.tsx`
- `components/patient/PatientStatusPage.tsx`

**What NOT to implement yet:** Nothing — this is the final milestone.

---

- [ ] 8.1 Build `components/patient/PatientStatusPage.tsx`: fetches `PatientRecord` from `GET /api/v1/patients/{patient_id}` on mount; polls every `PATIENT_STATUS_POLL_MS`; displays first name from `patient.name` as greeting at top of page
- [ ] 8.2 Render status message in ≥ 24px font based on `patient.status`: `IDLE` → "No active session", `HELP_TRIGGERED` → "Help request received — connecting you to a clinician…", `IN_SESSION` → "A clinician is with you now", `ESCALATED` → "Emergency services have been contacted"
- [ ] 8.3 When `patient.status === 'HELP_TRIGGERED'` and `help_event.triggered_at` is non-null, display "Help requested X minutes ago" beneath the status message using `formatRelativeTime`; update every second
- [ ] 8.4 When `patient.status === 'IN_SESSION'` and `session.started_at` is non-null, display "Session in progress for X minutes" beneath the status message using `formatDuration`; update every second
- [ ] 8.5 Apply status-appropriate background colour to the full page: neutral for `IDLE`, amber tint for `HELP_TRIGGERED`, green tint for `IN_SESSION`, red tint for `ESCALATED`; ensure no clinical data, robot controls, or report elements are present
- [ ] 8.6 Wire `app/patient/[id]/status/page.tsx` to render `PatientStatusPage` with the `patient_id` from route params; this route is public (no auth guard)

**Acceptance criteria:**
- Status message is ≥ 24px and updates within 5 seconds of a fixture change
- Correct message is shown for each of the four status values
- Relative time counter updates every second for `HELP_TRIGGERED` and `IN_SESSION`
- Page contains no robot controls, report form, or clinical data
- Page is accessible at `/patient/{patient_id}/status` without authentication
- Background colour reflects the current status
