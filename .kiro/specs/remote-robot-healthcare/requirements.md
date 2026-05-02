# Requirements Document

## Introduction

The Remote Robot Healthcare web application provides two browser-based interfaces for remote wellness check sessions: a **Doctor Interface** used by clinicians to monitor patients, issue robot commands, and file clinical reports, and a **Patient UI** that displays session status to the patient's household.

**Data flow overview (frontend scope only):**
1. The robot detects a "HELP" trigger and sends a JSON payload to the backend. The website receives this and updates the patient's `status` to `HELP_TRIGGERED`, prompting the doctor to join.
2. Once the doctor joins, the website receives a live audio stream over a WebSocket and plays it in the session UI so the doctor can hear the patient.
3. The doctor issues directional commands via the UI. The website sends JSON command objects to the backend/robot for: `left`, `right`, `up`, `down`, `stop`.

**Out of scope for the website:** wake word detection, robot microphone capture, ROS integration, and real robot movement execution. The website only sends and receives JSON — it does not implement any robot-side logic.

---

## Glossary

- **Doctor_Interface**: The web application used by a remote clinician during a wellness check session
- **Patient_UI**: The read-only web page displayed on a screen in the patient's home showing session status
- **Dashboard**: The main landing page of the Doctor_Interface listing patients by status
- **Session_Page**: The full-screen view inside the Doctor_Interface for a single active session
- **Clinician**: A licensed medical professional using the Doctor_Interface
- **Patient**: The person in the home whose wellness check is being conducted
- **PatientRecord**: The single canonical JSON object that represents all UI-relevant state for one patient, including identity, status, robot state, and session state. This is the source of truth for all UI rendering.
- **PatientStatus**: The `status` field of a PatientRecord; one of `IDLE`, `HELP_TRIGGERED`, `IN_SESSION`, or `ESCALATED`
- **Report_Payload**: The JSON object submitted by the Clinician at the end of a session (produced by the UI, not consumed from it)
- **Mock_Command**: A robot control action (e.g., move forward, tilt camera) that produces a JSON command object but does not communicate with real hardware
- **Disposition**: The clinical outcome of a session; one of `resolved`, `follow_up`, or `escalated`
- **Fixture**: A static JSON file used in place of a live API response during development

---

## JSON Data Structures

### PatientRecord (Canonical — Source of Truth for All UI State)

The `PatientRecord` is the single unified JSON object consumed by all UI components. Every piece of UI state — patient identity, session lifecycle, robot connectivity, and help events — is derived from this object. No other inbound data contract is required.

```json
{
  "patient_id": "pat-001",
  "name": "John Doe",
  "address": {
    "line1": "1234 Imaginary Ave",
    "line2": "City State 12345"
  },
  "status": "IDLE | HELP_TRIGGERED | IN_SESSION | ESCALATED",
  "last_updated": "ISO_8601_TIMESTAMP",
  "help_event": {
    "triggered_at": "ISO_8601_TIMESTAMP | null"
  },
  "robot": {
    "connection": "online | offline",
    "battery": 82,
    "last_command": "move forward",
    "last_command_at": "ISO_8601_TIMESTAMP"
  },
  "session": {
    "session_id": "string | null",
    "active": true,
    "started_at": "ISO_8601_TIMESTAMP | null",
    "ended_at": "ISO_8601_TIMESTAMP | null"
  }
}
```

**PatientStatus lifecycle:**

| Status | Meaning | Visual treatment |
|---|---|---|
| `IDLE` | No active help request or session | Neutral / default |
| `HELP_TRIGGERED` | Patient has triggered a help request; awaiting clinician | Flashing / urgent (amber or red) |
| `IN_SESSION` | Clinician has joined; session is active | Active session UI (green) |
| `ESCALATED` | Emergency services have been dispatched | Emergency state (red glow, pulse) |

**Status transition rules (simulated via local state or mock API):**

1. Help event triggered → `status` becomes `HELP_TRIGGERED`, `help_event.triggered_at` is set to current UTC timestamp
2. Clinician joins → `status` becomes `IN_SESSION`, `session.started_at` is set to current UTC timestamp, `session.active` becomes `true`
3. Session ends → `status` becomes `IDLE`, `session.ended_at` is set to current UTC timestamp, `session.active` becomes `false`

### Robot Command Object (produced by UI — outbound only)

```json
{
  "session_id": "sess-xyz789",
  "action": "left | right | up | down | stop",
  "issued_at": "ISO_8601_TIMESTAMP"
}
```

`action` is one of: `left` | `right` | `up` | `down` | `stop`

### Report Payload Object (produced by UI — outbound only)

```json
{
  "session_id": "sess-xyz789",
  "clinician_id": "doc-456",
  "chief_complaint": "Patient reported dizziness and shortness of breath",
  "assessment": "Likely orthostatic hypotension, no acute distress observed",
  "plan": "Advised patient to sit and hydrate; follow up with PCP within 48 hours",
  "disposition": "follow_up",
  "duration_seconds": 420,
  "submitted_at": "ISO_8601_TIMESTAMP"
}
```

### Dispatch Request Object (produced by UI — outbound only)

```json
{
  "session_id": "sess-xyz789",
  "patient_id": "pat-001",
  "reason": "Patient unresponsive, possible cardiac event",
  "address": "1234 Imaginary Ave, City State 12345",
  "requested_at": "ISO_8601_TIMESTAMP"
}
```

---

## Requirements

### Requirement 1: Doctor Dashboard Page

**User Story:** As a clinician, I want a dashboard that shows me all patients and their current status so that I can quickly identify who needs attention and join an active session.

#### Acceptance Criteria

1. THE Doctor_Interface SHALL display a Dashboard page as the default landing page after the Clinician logs in.
2. WHEN the Dashboard loads, THE Doctor_Interface SHALL fetch and display a list of PatientRecord objects from `GET /api/v1/patients` and render each patient as a card showing: `patient.name`, `patient.status` badge, and `patient.last_updated` formatted as local time.
3. THE Doctor_Interface SHALL visually distinguish patient cards by `patient.status` using color-coded badges: `HELP_TRIGGERED` in amber with a flashing indicator, `IN_SESSION` in green, `IDLE` in grey, `ESCALATED` in red.
4. WHEN the Dashboard is displaying patients, THE Doctor_Interface SHALL sort the patient list with `HELP_TRIGGERED` patients first, then `IN_SESSION`, then `ESCALATED`, then `IDLE`, ordered by `patient.last_updated` ascending within each group.
5. WHEN a Clinician clicks "Join Session" on a `HELP_TRIGGERED` patient card, THE Doctor_Interface SHALL send `POST /api/v1/patients/{patient_id}/join` with the body `{ "clinician_id": "<current_clinician_id>" }` and navigate to the Session_Page on a successful response.
6. IF the `POST /api/v1/patients/{patient_id}/join` request returns an error, THEN THE Doctor_Interface SHALL display an inline error message on the patient card without navigating away from the Dashboard.
7. THE Doctor_Interface SHALL refresh the patient list every 10 seconds while the Dashboard is visible, updating card statuses without a full page reload.
8. WHEN the patient list is empty, THE Doctor_Interface SHALL display a message reading "No patients on record" in place of the patient list.

---

### Requirement 2: Session Page Layout

**User Story:** As a clinician, I want a dedicated session page that organises all session tools in one view so that I can work efficiently without switching between pages.

#### Acceptance Criteria

1. THE Session_Page SHALL be divided into three persistent panels: a left panel for the Patient Profile, a centre panel for the video placeholder and robot controls, and a right panel for session actions and notes.
2. WHEN the Session_Page loads, THE Doctor_Interface SHALL display the `patient.status` badge, the `patient.session.session_id`, and the elapsed session time (counting up from `patient.session.started_at`) in a fixed header bar.
3. THE Session_Page header SHALL include an "End Session" button and a "Dispatch Emergency Services" button that remain visible and accessible at all times during an active session.
4. WHILE `patient.status` is `IN_SESSION`, THE Doctor_Interface SHALL display all three panels simultaneously on screens 1280px wide or wider.
5. WHEN `patient.status` changes to `IDLE` (session ended) or `ESCALATED`, THE Doctor_Interface SHALL replace the centre panel with a confirmation message and disable all robot control buttons.
6. THE Session_Page SHALL be navigable via the URL `/sessions/{patient_id}` and SHALL load the correct PatientRecord when accessed directly by URL.

---

### Requirement 3: Patient Profile Panel

**User Story:** As a clinician, I want to see the patient's identity and address during a session so that I can confirm who I am speaking with and have their location on hand.

#### Acceptance Criteria

1. WHEN the Session_Page loads, THE Doctor_Interface SHALL render the patient profile in the left panel using data from the PatientRecord.
2. THE Doctor_Interface SHALL display the following fields from the PatientRecord in the left panel: `patient.name`, `patient.address.line1`, and `patient.address.line2`.
3. THE Doctor_Interface SHALL display a placeholder avatar in the left panel when no photo is available.
4. IF the PatientRecord cannot be loaded, THEN THE Doctor_Interface SHALL display "Patient profile unavailable" in the left panel and SHALL NOT block the rest of the Session_Page from loading.
5. WHILE the left panel is visible, THE Doctor_Interface SHALL allow the Clinician to scroll the profile content independently of the other panels.

---

### Requirement 4: Robot Status Display

**User Story:** As a clinician, I want to see the robot's current status so that I know whether the robot is reachable and what its battery level is before issuing commands.

#### Acceptance Criteria

1. WHEN the Session_Page loads, THE Doctor_Interface SHALL display the robot status in the centre panel above the robot controls using `patient.robot` fields from the PatientRecord.
2. THE Doctor_Interface SHALL display the following robot fields: online/offline indicator (green dot when `patient.robot.connection` is `"online"`, red dot when `"offline"`), `patient.robot.battery` as a labelled percentage progress bar, `patient.robot.last_command` as the most recent command label, and `patient.robot.last_command_at` formatted as "Last command: X seconds/minutes ago".
3. WHEN `patient.robot.battery` is 20 or below, THE Doctor_Interface SHALL display the battery indicator in red and show the label "Low Battery".
4. WHEN `patient.robot.connection` is `"offline"`, THE Doctor_Interface SHALL display a banner reading "Robot offline — commands will not be delivered" and SHALL disable all robot control buttons.
5. THE Doctor_Interface SHALL re-fetch the PatientRecord every 15 seconds while the Session_Page is visible and update the robot status display without a full page reload.

---

### Requirement 5: Video and Audio Panel

**User Story:** As a clinician, I want a video area and live audio feed in the session view so that I can see and hear the patient during the session.

#### Acceptance Criteria

1. THE Session_Page centre panel SHALL contain a video placeholder area with a minimum height of 360px and a 16:9 aspect ratio.
2. THE Doctor_Interface SHALL display the placeholder with a dark background, a camera icon, and the text "Live video feed — not yet connected" centred within the area.
3. THE Doctor_Interface SHALL display `patient.name` as an overlay label at the bottom-left of the video placeholder area.
4. THE video placeholder area SHALL be visually distinct from the robot control buttons below it, separated by a visible divider.
5. WHEN `patient.status` is `IN_SESSION`, THE Doctor_Interface SHALL connect to the audio WebSocket at `wss://{host}/api/v1/sessions/{session_id}/audio` and play the incoming audio stream so the Clinician can hear the patient.
6. THE Doctor_Interface SHALL display an audio status indicator showing "Audio connected" (green mic icon) when the WebSocket connection is open, and "Audio disconnected" (red mic icon with strikethrough) when it is closed or errored.
7. THE Doctor_Interface SHALL provide a mute/unmute toggle button that suspends and resumes playback of the incoming audio stream without closing the WebSocket connection.
8. IF the audio WebSocket connection drops during an active session, THE Doctor_Interface SHALL attempt to reconnect up to 3 times with a 2-second delay between attempts, displaying "Reconnecting audio…" during each attempt.
9. THE audio WebSocket connection SHALL be closed when the session ends (`patient.status` transitions away from `IN_SESSION`).

---

### Requirement 6: Robot Control UI

**User Story:** As a clinician, I want robot control buttons so that I can issue directional commands and see the resulting JSON that will be sent to the robot.

#### Acceptance Criteria

1. THE Session_Page centre panel SHALL display a directional control pad with five buttons: Left, Right, Up, Down, and Stop.
2. WHEN a Clinician clicks any robot control button, THE Doctor_Interface SHALL construct a `RobotCommand` JSON object with the following shape and send it as `POST /api/v1/sessions/{session_id}/commands`:
   ```json
   {
     "session_id": "sess-xyz789",
     "action": "left | right | up | down | stop",
     "issued_at": "ISO_8601_TIMESTAMP"
   }
   ```
3. WHEN a robot command is sent, THE Doctor_Interface SHALL display the serialised `RobotCommand` object in a read-only "Last Command Sent" panel below the controls, formatted as indented JSON.
4. WHEN the API responds to a robot command, THE Doctor_Interface SHALL display a status indicator showing "Command sent" in green or "Command failed" in red, clearing after 3 seconds.
5. WHILE `patient.robot.connection` is `"offline"`, THE Doctor_Interface SHALL disable all robot control buttons and display a tooltip reading "Robot is offline" on hover.
6. THE Doctor_Interface SHALL maintain a scrollable command log in the right panel showing the last 20 commands issued during the session, each entry displaying the `action` value and `issued_at` timestamp formatted as local time.
7. THE website SHALL NOT implement robot movement logic; it only constructs and POSTs the JSON command object.

---

### Requirement 7: Report Submission UI

**User Story:** As a clinician, I want a structured report form that appears when I end a session so that I can document the encounter before the session is closed.

#### Acceptance Criteria

1. WHEN the Clinician clicks "End Session", THE Doctor_Interface SHALL display a report form as a modal overlay without navigating away from the Session_Page.
2. THE report form SHALL contain the following fields: `chief_complaint` (required, text area, max 500 characters), `assessment` (required, text area, max 1000 characters), `plan` (required, text area, max 1000 characters), and `disposition` (required, radio button group with options: "Resolved", "Follow-up Required", "Escalate to Emergency Services").
3. THE report form SHALL display `patient.session.session_id`, `patient.name`, and elapsed session duration (derived from `patient.session.started_at`) as read-only fields at the top of the form.
4. WHEN the Clinician submits the report form, THE Doctor_Interface SHALL construct a Report_Payload_Object, populate `duration_seconds` from the elapsed session timer, and send it as `POST /api/v1/reports`.
5. WHEN the Clinician submits the report form, THE Doctor_Interface SHALL display a loading indicator on the submit button and disable all form fields until the API responds.
6. IF the report form is submitted with any required field empty, THEN THE Doctor_Interface SHALL display an inline validation error beneath each empty field and SHALL NOT submit the form.
7. WHEN the Report_Service responds with HTTP 201, THE Doctor_Interface SHALL close the modal, display a success toast notification reading "Report submitted successfully", and update the local PatientRecord `status` to `IDLE` and `session.ended_at` to the current UTC timestamp.
8. IF the Report_Service responds with HTTP 422, THEN THE Doctor_Interface SHALL display the list of missing fields returned in the response body within the report form without closing the modal.
9. WHEN the Clinician dismisses the report modal without submitting, THE Doctor_Interface SHALL display a confirmation dialog reading "Are you sure? The session will remain open until a report is submitted."

---

### Requirement 8: Emergency Dispatch UI

**User Story:** As a clinician, I want a clearly accessible dispatch button so that I can summon emergency services for the patient with a single confirmed action.

#### Acceptance Criteria

1. THE Session_Page header SHALL display a "Dispatch Emergency Services" button styled in red and labelled with a warning icon at all times during an active session.
2. WHEN the Clinician clicks "Dispatch Emergency Services", THE Doctor_Interface SHALL display a confirmation dialog containing `patient.name`, the patient's address composed from `patient.address.line1` and `patient.address.line2`, and a required free-text field labelled "Reason for dispatch".
3. THE Doctor_Interface SHALL require the "Reason for dispatch" field to contain at least 10 characters before enabling the "Confirm Dispatch" button in the dialog.
4. WHEN the Clinician confirms the dispatch, THE Doctor_Interface SHALL construct a Dispatch_Request_Object (using `patient.patient_id`, `patient.session.session_id`, and the composed address) and send it as `POST /api/v1/dispatch`.
5. WHEN the dispatch API responds successfully, THE Doctor_Interface SHALL close the confirmation dialog, display a persistent banner reading "Emergency services have been dispatched", and update the local PatientRecord `status` to `ESCALATED`.
6. IF the dispatch API returns HTTP 409 (duplicate dispatch), THEN THE Doctor_Interface SHALL display the message "Emergency services were already dispatched for this session" and close the dialog.
7. WHEN `patient.status` is `ESCALATED`, THE Doctor_Interface SHALL disable the "Dispatch Emergency Services" button and replace its label with "Dispatched".

---

### Requirement 9: Timestamp Display

**User Story:** As a clinician, I want to see human-readable time information derived from the PatientRecord timestamps so that I can understand how long a situation has been ongoing.

#### Acceptance Criteria

1. WHEN `patient.status` is `HELP_TRIGGERED` and `patient.help_event.triggered_at` is non-null, THE Doctor_Interface SHALL display a live counter showing "Help triggered X minutes ago" (or "X seconds ago" for durations under 60 seconds), updating every second.
2. WHEN `patient.status` is `IN_SESSION` and `patient.session.started_at` is non-null, THE Doctor_Interface SHALL display a live session duration counter in the Session_Page header counting up from `patient.session.started_at`, updating every second.
3. WHEN `patient.robot.last_command_at` is non-null, THE Doctor_Interface SHALL display the time elapsed since the last robot command in the format "Last command: X seconds/minutes ago", updating every 10 seconds.
4. WHEN `patient.session.ended_at` is non-null, THE Doctor_Interface SHALL display the total session duration in the session summary view, calculated as the difference between `patient.session.ended_at` and `patient.session.started_at`.
5. THE Doctor_Interface SHALL format all displayed timestamps as local time using the browser's locale, and SHALL format all durations as human-readable strings (e.g., "2 minutes 34 seconds").

---

### Requirement 10: Status-Driven UI Behaviour

**User Story:** As a clinician, I want the interface to visually reflect the urgency of each patient's status so that I can immediately identify situations that require action.

#### Acceptance Criteria

1. WHEN `patient.status` is `HELP_TRIGGERED`, THE Doctor_Interface SHALL render the patient card and any associated status indicators with a flashing amber or red visual treatment to communicate urgency.
2. WHEN `patient.status` is `IN_SESSION`, THE Doctor_Interface SHALL render the Session_Page in its active state with all robot controls enabled (subject to `patient.robot.connection`), the session timer running, and the status badge displayed in green.
3. WHEN `patient.status` is `ESCALATED`, THE Doctor_Interface SHALL render a red pulsing glow on the patient card and Session_Page header, disable the "Dispatch Emergency Services" button, and display a persistent "Emergency services have been dispatched" banner.
4. WHEN `patient.status` is `IDLE`, THE Doctor_Interface SHALL render the patient card in a neutral grey state and SHALL NOT display any urgency indicators.
5. THE Doctor_Interface SHALL derive all visual state exclusively from the `patient.status` field of the PatientRecord; no separate status flags or boolean fields SHALL be used as the primary source of UI state.

---

### Requirement 11: Patient UI (Status Screen)

**User Story:** As a patient's household member, I want a simple status screen that shows whether a wellness check session is in progress so that we know the system is working.

#### Acceptance Criteria

1. THE Patient_UI SHALL be a single read-only page accessible at `/patient/{patient_id}/status` that displays the current status for that patient.
2. WHEN the Patient_UI loads, THE Patient_UI SHALL fetch the PatientRecord from `GET /api/v1/patients/{patient_id}` and display the `patient.status` in large, high-contrast text.
3. THE Patient_UI SHALL display one of the following status messages based on `patient.status`: `IDLE` → "No active session", `HELP_TRIGGERED` → "Help request received — connecting you to a clinician…", `IN_SESSION` → "A clinician is with you now", `ESCALATED` → "Emergency services have been contacted".
4. WHEN `patient.status` is `HELP_TRIGGERED` and `patient.help_event.triggered_at` is non-null, THE Patient_UI SHALL display "Help requested X minutes ago" beneath the status message.
5. WHEN `patient.status` is `IN_SESSION` and `patient.session.started_at` is non-null, THE Patient_UI SHALL display "Session in progress for X minutes" beneath the status message.
6. THE Patient_UI SHALL display the first name from `patient.name` at the top of the page as a personalised greeting.
7. THE Patient_UI SHALL refresh the PatientRecord every 5 seconds and update the displayed message without a full page reload.
8. THE Patient_UI SHALL use a minimum font size of 24px for the status message to ensure readability at a distance.
9. THE Patient_UI SHALL NOT display any clinical data, robot controls, or report information.

---

### Requirement 12: Navigation and Routing

**User Story:** As a clinician, I want consistent navigation so that I can move between the dashboard and session pages without losing context.

#### Acceptance Criteria

1. THE Doctor_Interface SHALL implement client-side routing with the following routes: `/` → Dashboard, `/sessions/{patient_id}` → Session_Page, `/login` → Login page.
2. WHEN an unauthenticated user navigates to any route other than `/login`, THE Doctor_Interface SHALL redirect the user to `/login`.
3. WHEN a Clinician navigates from the Session_Page back to the Dashboard using the browser back button or a "Back to Dashboard" link, THE Doctor_Interface SHALL NOT end the active session.
4. WHEN a Clinician navigates to `/sessions/{patient_id}` for a patient whose `patient.status` is `IDLE` and `patient.session.ended_at` is non-null, THE Doctor_Interface SHALL display the session summary view (patient name, disposition, session duration derived from `session.started_at` and `session.ended_at`) rather than the active session controls.
5. THE Doctor_Interface SHALL display a persistent navigation bar on all pages showing the application name, the logged-in clinician's name, and a logout button.

---

### Requirement 13: Mock API and Fixture Data

**User Story:** As a frontend developer, I want a mock API layer and static fixture files so that I can build and test the entire UI without a running backend.

#### Acceptance Criteria

1. THE Doctor_Interface SHALL include a mock API layer that intercepts all `fetch` or `axios` calls and returns fixture JSON when the environment variable `VITE_USE_MOCK_API` (or equivalent) is set to `true`.
2. THE mock API layer SHALL provide fixture responses for all endpoints referenced in these requirements: `GET /api/v1/patients`, `GET /api/v1/patients/{patient_id}`, `POST /api/v1/patients/{patient_id}/join`, `POST /api/v1/sessions/{session_id}/commands`, `POST /api/v1/reports`, and `POST /api/v1/dispatch`.
3. THE mock API layer SHALL simulate a network delay of 300–600ms for all responses to allow loading states to be visible during development.
4. THE fixture data SHALL include at least three PatientRecord objects — one with `status: "IDLE"`, one with `status: "HELP_TRIGGERED"` (with a non-null `help_event.triggered_at`), and one with `status: "IN_SESSION"` (with a non-null `session.started_at`) — stored as JSON files in a `fixtures/` directory conforming to the PatientRecord shape.
5. THE mock API layer SHALL support a configurable error mode in which specific endpoints return error responses (HTTP 404, 422, 409) to allow error-state UI to be developed and tested.
6. THE Doctor_Interface SHALL log every mock API call to the browser console in the format `[MOCK API] {METHOD} {path} → {status}` when running in mock mode.
7. WHEN the mock API receives `POST /api/v1/patients/{patient_id}/join`, THE mock API layer SHALL return an updated PatientRecord with `status: "IN_SESSION"` and `session.started_at` set to the current UTC timestamp.
8. WHEN the mock API receives `POST /api/v1/dispatch`, THE mock API layer SHALL return an updated PatientRecord with `status: "ESCALATED"`.
