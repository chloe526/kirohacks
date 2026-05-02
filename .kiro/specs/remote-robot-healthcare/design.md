# Design Document: Remote Robot Healthcare — Doctor Interface

## Overview

This document describes the frontend architecture for the Remote Robot Healthcare web application. The system provides two browser-based interfaces:

- **Doctor Interface** — a clinician-facing React/Next.js application for managing wellness check sessions, issuing robot commands, and filing clinical reports.
- **Patient UI** — a read-only status screen displayed in the patient's home.

**Data flow (website scope only):**
1. The robot sends a JSON trigger payload to the backend when "HELP" is detected. The website receives this (via polling or push) and sets `patient.status → HELP_TRIGGERED`, surfacing an alert to the doctor.
2. When the doctor joins, the website opens a WebSocket to `wss://{host}/api/v1/sessions/{session_id}/audio` and plays the incoming audio stream in the session UI.
3. The doctor clicks directional controls. The website POSTs a `RobotCommand` JSON object (`action`: `left | right | up | down | stop`) to the backend. The website does not execute movement — it only sends the JSON.

**Out of scope for the website:** wake word detection, robot microphone capture, ROS, real robot movement. The website sends and receives JSON only.

The application is built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, and **Zustand** for state management. A mock API layer intercepts all network calls when `NEXT_PUBLIC_USE_MOCK_API=true`.

### Key Design Goals

- **Implementation-ready**: every component has defined props, state, and responsibilities.
- **Mock-first**: the entire UI is buildable and testable without a running backend.
- **Urgency-aware**: HELP_TRIGGERED / `escalated` states surface visually with red glows and flashing indicators.
- **Accessible**: minimum 24px status text, ARIA labels on all interactive controls, keyboard-navigable control pad.

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js App Router                        │
│                                                                  │
│  /login          /          /sessions/[id]   /patient/[id]/status│
│  LoginPage    Dashboard    SessionPage        PatientStatusPage  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │     Zustand Stores       │
              │  patientStore  ◄──────── single source of truth   │
              │  commandStore           │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │      API Client Layer    │
              │  apiClient.ts           │
              │  (fetch wrapper)        │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │    Mock API Interceptor  │
              │  mockApiHandler.ts      │
              │  (MSW / custom handler) │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │      Fixture Files       │
              │  /fixtures/*.json       │
              └─────────────────────────┘
```

### Technology Stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | Next.js 14 (App Router) | File-based routing, SSR-ready, industry standard |
| Language | TypeScript 5 | Type safety for JSON contracts |
| Styling | Tailwind CSS 3 | Utility-first, design tokens via CSS variables |
| State | Zustand 4 | Lightweight, no boilerplate, easy devtools |
| Mock API | MSW 2 (Mock Service Worker) | Intercepts at network level, works in browser and Node |
| Icons | Lucide React | Consistent, accessible icon set |
| Testing | Vitest + React Testing Library + fast-check | Unit, component, and property-based tests |

---

## Components and Interfaces

### Component Hierarchy

```
App
├── NavBar
├── LoginPage
├── Dashboard
│   ├── SessionCard (×N)
│   └── EmptyState
├── SessionPage
│   ├── SessionHeader
│   │   ├── SessionStatusBadge
│   │   ├── SessionTimer
│   │   └── EmergencyDispatchButton
│   ├── PatientProfilePanel  (left)
│   │   ├── PatientInfoCard
│   │   ├── MedicationList
│   │   ├── AllergyList
│   │   ├── EmergencyContactList
│   │   └── ClinicalNotesCollapsible
│   ├── CentrePanel  (centre)
│   │   ├── VideoPanel
│   │   ├── RobotStatusCard
│   │   ├── ControlBar
│   │   │   ├── MovementPad
│   │   │   ├── CameraControls
│   │   │   └── AudioControls
│   │   └── LastCommandPanel
│   └── ActionPanel  (right)
│       ├── AlertStatusCard
│       ├── CommandLog
│       └── SessionNotesInput
├── ReportModal
│   └── ReportForm
├── DispatchConfirmDialog
├── EndSessionConfirmDialog
└── PatientStatusPage
```

### Component Specifications

#### `SessionPage`

**Responsibility**: Top-level page component for an active session. Orchestrates data fetching, polling, and layout.

**Props**: `{ params: { id: string } }` (Next.js route params)

**State (via Zustand — `patientStore`)**:
- `activePatient` — single `PatientRecord` object (source of truth for all session UI)
- `isReportModalOpen` — boolean
- `isDispatchDialogOpen` — boolean

**Behaviour**:
- On mount: fetch `PatientRecord` from `GET /api/v1/patients/{patient_id}` — one request, all data.
- Poll `PatientRecord` every 10 seconds; update `activePatient` in store on each response.
- When `activePatient.status` becomes `IDLE` (after report) or `ESCALATED`, stop polling and replace centre panel with confirmation view.

---

#### `SessionHeader`

**Responsibility**: Fixed top bar showing session metadata and primary action buttons.

**Props**:
```ts
interface SessionHeaderProps {
  patient: PatientRecord;
  onEndSession: () => void;
  onDispatch: () => void;
}
```

**Layout**:
```
┌──────────────────────────────────────────────────────────────────┐
│  [●] John Doe  │  sess-xyz789  │  ⏱ 00:07:23  │  [IN_SESSION]   │
│                                          [End Session] [🚨 Dispatch]│
└──────────────────────────────────────────────────────────────────┘
```

**Behaviour**:
- Timer counts up from `patient.session.started_at` using `setInterval` (1 s tick).
- Status badge colour: `IN_SESSION` → green, `ESCALATED` → red (flashing), `IDLE` → grey, `HELP_TRIGGERED` → amber (flashing).
- When `patient.status` is `ESCALATED`, "Dispatch" button is disabled and relabelled "Dispatched".

---

#### `VideoPanel`

**Responsibility**: Video placeholder and live audio playback for the session. Manages the audio WebSocket connection lifecycle.

**Props**:
```ts
interface VideoPanelProps {
  patientName: string;                              // patient.name
  robotConnection: 'online' | 'offline';            // patient.robot.connection
  sessionId: string;                                // patient.session.session_id
  sessionActive: boolean;                           // patient.session.active
}
```

**Layout**:
```
┌─────────────────────────────────────────────────────┐
│                                          [🎤 Live]  │
│                    📷                               │
│         Live video feed — not yet connected         │
│                                                     │
│  John Doe                        [🔇 Mute]          │
└─────────────────────────────────────────────────────┘
  min-height: 360px, aspect-ratio: 16/9
```

**Behaviour**:
- Dark background (`bg-slate-900`). Camera icon + text centred. `patient.name` overlaid bottom-left.
- Connection state badge top-right: derived from `patient.robot.connection` — `"offline"` → "Disconnected" (red), `"online"` → "Live" (green).
- **Audio**: when `sessionActive` is `true`, open a WebSocket to `wss://{host}/api/v1/sessions/{sessionId}/audio` and pipe the binary audio stream to a Web Audio API `AudioContext` for playback.
- Audio status indicator: green mic icon ("Audio connected") when WebSocket is `OPEN`; red strikethrough mic ("Audio disconnected") when `CLOSED` or `ERROR`.
- Mute/unmute toggle (bottom-right): suspends/resumes `AudioContext` without closing the WebSocket.
- On WebSocket drop: retry up to 3 times with 2 s delay, showing "Reconnecting audio…" during each attempt.
- On `sessionActive → false`: close the WebSocket and `AudioContext`.
- **Mock mode**: when `NEXT_PUBLIC_USE_MOCK_API=true`, skip the WebSocket and display a static "Audio (mocked)" badge instead.

---

#### `PatientInfoCard`

**Responsibility**: Renders the patient's demographic and medical summary.

**Props**:
```ts
interface PatientInfoCardProps {
  name: string;           // patient.name
  addressLine1: string;   // patient.address.line1
  addressLine2: string;   // patient.address.line2
}
```

**Rendered fields**: placeholder avatar, `name`, `address.line1`, `address.line2`.

---

#### `RobotStatusCard`

**Responsibility**: Displays robot connectivity and battery state.

**Props**:
```ts
interface RobotStatusCardProps {
  robot: PatientRecord['robot'];
}
```

**Behaviour**:
- Online indicator: green dot (`robot.connection === 'online'`) / red dot (`'offline'`).
- Battery bar: red + "Low Battery" label when `robot.battery ≤ 20`.
- `robot.last_command` displayed as the most recent command label.
- `robot.last_command_at` displayed as "Last command: X seconds/minutes ago".
- When offline: amber banner "Robot offline — commands will not be delivered".

---

#### `AlertStatusCard`

**Responsibility**: Displays session alert state. Visually escalates when status is `escalated`.

**Props**:
```ts
interface AlertStatusCardProps {
  status: PatientStatus;                    // patient.status
  helpTriggeredAt: string | null;           // patient.help_event.triggered_at
}
```

**Behaviour**:
- `IDLE`: neutral card, no urgency indicators.
- `HELP_TRIGGERED`: amber border, flashing animation (`animate-pulse`), displays "Help triggered X minutes ago" (live counter from `helpTriggeredAt`).
- `IN_SESSION`: green border, label "Session in progress".
- `ESCALATED`: red border, red glow (`shadow-red-500/50`), pulsing animation, text "ESCALATED — Emergency services dispatched".

---

#### `ControlBar`

**Responsibility**: Container for all robot control sub-panels.

**Props**:
```ts
interface ControlBarProps {
  sessionId: string;                        // patient.session.session_id
  robotOnline: boolean;                     // patient.robot.connection === 'online'
  onCommandSent: (cmd: RobotCommand) => void;
}
```

**Sub-components**:

**`MovementPad`** — five-button layout matching the five valid actions:
```
         [▲ Up]
[◄ Left] [■ Stop] [► Right]
         [▼ Down]
```

**`AudioControls`** — mute/unmute toggle (mic icon). Moved into `VideoPanel`; `ControlBar` no longer owns audio state.

All buttons disabled + tooltip "Robot is offline" when `robotOnline === false`.

---

#### `CommandButton`

**Responsibility**: Reusable button that constructs and POSTs a `RobotCommand` on click.

**Props**:
```ts
interface CommandButtonProps {
  sessionId: string;
  action: 'left' | 'right' | 'up' | 'down' | 'stop';
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  onCommandSent: (cmd: RobotCommand) => void;
}
```

**Behaviour**:
- On click: build `RobotCommand` `{ session_id, action, issued_at: now() }` and call `POST /api/v1/sessions/{sessionId}/commands`.
- Show "Command sent" (green) or "Command failed" (red) for 3 seconds.
- The website does not execute movement — it only constructs and sends the JSON.

---

#### `EmergencyPanel` / `DispatchConfirmDialog`

**Responsibility**: Confirmation dialog for EMS dispatch.

**Props**:
```ts
interface DispatchConfirmDialogProps {
  isOpen: boolean;
  patientName: string;        // patient.name
  addressLine1: string;       // patient.address.line1
  addressLine2: string;       // patient.address.line2
  sessionId: string;          // patient.session.session_id
  patientId: string;          // patient.patient_id
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}
```

**Behaviour**:
- "Confirm Dispatch" button disabled until reason field has ≥ 10 characters.
- On confirm: POST dispatch request, show persistent banner, optimistically update `patientStore.activePatient.status` to `ESCALATED`.
- On HTTP 409: show "Emergency services were already dispatched for this session".

---

#### `ReportModal` / `ReportForm`

**Responsibility**: End-session report form rendered as a modal overlay.

**Props**:
```ts
interface ReportModalProps {
  isOpen: boolean;
  sessionId: string;
  patientName: string;
  durationSeconds: number;
  clinicianId: string;
  onSuccess: () => void;
  onDismiss: () => void;
}
```

**Fields**: `chief_complaint` (textarea, 500 char max), `assessment` (textarea, 1000 char max), `plan` (textarea, 1000 char max), `disposition` (radio: Resolved / Follow-up Required / Escalate to Emergency Services).

**Behaviour**:
- Inline validation errors on empty required fields.
- Loading state on submit button.
- On HTTP 201: close modal, success toast, optimistically update `patientStore.activePatient`: set `status → IDLE`, `session.ended_at → now()`, `session.active → false`.
- On HTTP 422: display server-returned field errors inside form.
- On dismiss without submit: confirmation dialog "Are you sure? The session will remain open until a report is submitted."

---

#### `LastCommandPanel`

**Responsibility**: Read-only display of the most recently sent robot command as formatted JSON.

**Props**:
```ts
interface LastCommandPanelProps {
  lastCommand: RobotCommand | null;
  commandStatus: 'idle' | 'acknowledged' | 'failed';
}
```

---

#### `CommandLog`

**Responsibility**: Scrollable log of the last 20 commands issued in the session.

**Props**:
```ts
interface CommandLogProps {
  commands: RobotCommand[];
}
```

Each entry shows: command type, direction, timestamp (local time).

---

#### `PatientStatusPage`

**Responsibility**: Read-only patient-facing status screen at `/patient/[id]/status`.

**Props**: `{ params: { id: string } }`

**Behaviour**:
- Fetch `PatientRecord` from `GET /api/v1/patients/{patient_id}` every 5 seconds.
- Display status message derived from `patient.status` in ≥ 24px font.
- When `patient.status === 'HELP_TRIGGERED'`, also display "Help requested X minutes ago" from `patient.help_event.triggered_at`.
- When `patient.status === 'IN_SESSION'`, also display "Session in progress for X minutes" from `patient.session.started_at`.
- No clinical data, no controls.

---

## Data Models

All TypeScript types mirror the canonical `PatientRecord` contract from the requirements document. The three previous separate types (`Session`, `PatientProfile`, `RobotStatus`) are replaced by a single unified type.

```ts
// ── PatientRecord — single source of truth for all UI state ──

type PatientStatus = 'IDLE' | 'HELP_TRIGGERED' | 'IN_SESSION' | 'ESCALATED';

interface PatientRecord {
  patient_id: string;
  name: string;
  address: {
    line1: string;
    line2: string;
  };
  status: PatientStatus;
  last_updated: string;           // ISO 8601
  help_event: {
    triggered_at: string | null;  // ISO 8601 | null
  };
  robot: {
    connection: 'online' | 'offline';
    battery: number;              // 0–100
    last_command: string;
    last_command_at: string;      // ISO 8601
  };
  session: {
    session_id: string | null;
    active: boolean;
    started_at: string | null;    // ISO 8601 | null
    ended_at: string | null;      // ISO 8601 | null
  };
}

// ── Outbound payloads (produced by UI, not consumed from it) ──

type RobotAction = 'left' | 'right' | 'up' | 'down' | 'stop';

interface RobotCommand {
  session_id: string;
  action: RobotAction;
  issued_at: string;              // ISO 8601
  // Note: the website constructs and POSTs this object only.
  // Wake word detection, microphone capture, ROS, and movement
  // execution are all out of scope for the website.
}

type Disposition = 'resolved' | 'follow_up' | 'escalated';

interface ReportPayload {
  session_id: string;
  clinician_id: string;
  chief_complaint: string;
  assessment: string;
  plan: string;
  disposition: Disposition;
  duration_seconds: number;
  submitted_at: string;           // ISO 8601
}

interface DispatchRequest {
  session_id: string;
  patient_id: string;
  reason: string;
  address: string;                // line1 + " " + line2
  requested_at: string;           // ISO 8601
}
```

### Zustand Store Shapes

The previous `sessionStore`, `patientStore`, and `robotStore` are collapsed into a single `patientStore`. `commandStore` is unchanged.

```ts
// patientStore — unified store, replaces sessionStore + patientStore + robotStore
interface PatientStore {
  // Dashboard: map of all patients
  patients: Record<string, PatientRecord>;
  isLoadingList: boolean;
  listError: string | null;
  setPatients: (records: PatientRecord[]) => void;

  // Session page: single active patient
  activePatient: PatientRecord | null;
  isLoadingActive: boolean;
  activeError: string | null;
  setActivePatient: (record: PatientRecord) => void;
  patchActivePatient: (patch: Partial<PatientRecord>) => void; // for optimistic updates

  // UI state
  isReportModalOpen: boolean;
  isDispatchDialogOpen: boolean;
  openReportModal: () => void;
  closeReportModal: () => void;
  openDispatchDialog: () => void;
  closeDispatchDialog: () => void;
}

// commandStore — unchanged except RobotCommand shape
interface CommandStore {
  lastCommand: RobotCommand | null;
  commandStatus: 'idle' | 'acknowledged' | 'failed';
  log: RobotCommand[];            // last 20
  addCommand: (cmd: RobotCommand, success: boolean) => void;
  setCommandStatus: (s: 'idle' | 'acknowledged' | 'failed') => void;
}
```

---

## State Management

### Data Flow Diagram

```
── Inbound: Robot triggers HELP ──────────────────────────────────
Robot detects "HELP"
        │
        ▼
Robot POSTs JSON to backend
        │
        ▼
Backend updates PatientRecord { status: 'HELP_TRIGGERED',
                                 help_event.triggered_at: now() }
        │
        ▼
Website polls GET /api/v1/patients (every 10s) or receives push
        │
        ▼
patientStore.setPatients(updatedList)
        │
        ▼
Dashboard card flashes amber — doctor sees alert

── Inbound: Live audio stream ────────────────────────────────────
Doctor joins session (status → IN_SESSION)
        │
        ▼
VideoPanel opens WebSocket:
  wss://{host}/api/v1/sessions/{session_id}/audio
        │
        ▼
Binary audio frames arrive over WebSocket
        │
        ▼
Web Audio API AudioContext plays stream in browser
        │  (mute toggle suspends AudioContext without closing socket)
        ▼
On session end → WebSocket closed, AudioContext released

── Outbound: Robot command ───────────────────────────────────────
Doctor clicks CommandButton (e.g. "Left")
        │
        ▼
Build RobotCommand { session_id, action: 'left', issued_at: now() }
        │
        ▼
apiClient.post('/api/v1/sessions/{session_id}/commands', cmd)
        │         (intercepted by MSW in mock mode)
        ▼
commandStore.addCommand(cmd, success=true)
  ├─► lastCommand = cmd
  ├─► commandStatus = 'acknowledged'
  └─► log = [cmd, ...log].slice(0, 20)

patientStore.patchActivePatient({
  robot: { last_command: cmd.action,
           last_command_at: cmd.issued_at }
})  ← optimistic local update

After 3s: commandStore.setCommandStatus('idle')

── Optimistic status transitions ─────────────────────────────────
"Join session" click  → patchActivePatient({ status: 'IN_SESSION',
                          session: { active: true, started_at: now() } })
"Dispatch EMS" confirm → patchActivePatient({ status: 'ESCALATED' })
Report submitted (201) → patchActivePatient({ status: 'IDLE',
                          session: { active: false, ended_at: now() } })
```

### Session Lifecycle State Machine

```
IDLE ──[help triggered]──► HELP_TRIGGERED ──[clinician joins]──► IN_SESSION
                                                                      │
                                          IDLE ◄──[report submitted]──┤
                                                                      │
                                      ESCALATED ◄──[dispatch EMS]────┘
```

When `patient.status` transitions to `IDLE` (after report) or `ESCALATED`:
1. Polling interval is cleared.
2. Robot control buttons are disabled.
3. Centre panel switches to confirmation/summary view.
4. Dispatch button is disabled and relabelled.

---

## Mock API Integration Pattern

### MSW Setup

```
src/
  mocks/
    browser.ts          ← MSW browser worker setup
    handlers/
      patients.ts       ← GET /patients, GET /patients/:id, POST /patients/:id/join
      commands.ts       ← POST /sessions/:id/commands
      reports.ts        ← POST /reports
      dispatch.ts       ← POST /dispatch
      audio.ts          ← WS /sessions/:id/audio (mock: no-op, returns silence)
    fixtures/
      patients.json     ← array of PatientRecord objects
```

### Handler Pattern

Each handler:
1. Reads from the corresponding fixture file.
2. Applies a simulated delay of 300–600ms (`await delay(randomBetween(300, 600))`).
3. Logs to console: `[MOCK API] GET /api/v1/sessions → 200`.
4. Returns the fixture JSON.

```ts
// Example: patients list handler
http.get('/api/v1/patients', async () => {
  await delay(randomDelay());
  console.log('[MOCK API] GET /api/v1/patients → 200');
  return HttpResponse.json(patientsFixture);
})

// Example: join handler — returns updated PatientRecord
http.post('/api/v1/patients/:patient_id/join', async ({ params }) => {
  await delay(randomDelay());
  const record = patientsFixture.find(p => p.patient_id === params.patient_id);
  const updated = {
    ...record,
    status: 'IN_SESSION',
    session: { ...record.session, active: true, started_at: new Date().toISOString() }
  };
  console.log(`[MOCK API] POST /api/v1/patients/${params.patient_id}/join → 200`);
  return HttpResponse.json(updated);
})
```

### Error Mode

Set `NEXT_PUBLIC_MOCK_ERROR_MODE=reports:422,dispatch:409` to trigger specific error responses. The handler checks this env var and returns the configured error for matching endpoints.

### Fixture Data

`fixtures/patients.json` — array of 3 `PatientRecord` objects:
- one with `status: "IDLE"`
- one with `status: "HELP_TRIGGERED"` and a non-null `help_event.triggered_at`
- one with `status: "IN_SESSION"` and a non-null `session.started_at`

All three share the same shape — no separate sessions.json or robots.json needed.

---

## Styling System and Design Tokens

### CSS Custom Properties (globals.css)

```css
:root {
  /* Brand */
  --color-primary:       #3B82F6;   /* blue-500 */
  --color-primary-dark:  #1D4ED8;   /* blue-700 */
  --color-accent:        #7C3AED;   /* violet-600 */

  /* Status */
  --color-success:       #22C55E;   /* green-500 */
  --color-warning:       #F59E0B;   /* amber-500 */
  --color-danger:        #EF4444;   /* red-500 */
  --color-danger-glow:   rgba(239, 68, 68, 0.4);

  /* Neutral */
  --color-surface:       #0F172A;   /* slate-900 — dark bg */
  --color-surface-2:     #1E293B;   /* slate-800 — card bg */
  --color-surface-3:     #334155;   /* slate-700 — border */
  --color-text:          #F1F5F9;   /* slate-100 */
  --color-text-muted:    #94A3B8;   /* slate-400 */

  /* Spacing scale follows Tailwind defaults */
  --radius-card:         0.75rem;
  --radius-button:       0.5rem;
}
```

### Tailwind Config Extensions

```ts
// tailwind.config.ts
extend: {
  animation: {
    'pulse-danger': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    'glow-danger':  'glowDanger 1.5s ease-in-out infinite alternate',
  },
  keyframes: {
    glowDanger: {
      from: { boxShadow: '0 0 8px var(--color-danger-glow)' },
      to:   { boxShadow: '0 0 24px var(--color-danger-glow)' },
    },
  },
  colors: {
    danger: 'var(--color-danger)',
    primary: 'var(--color-primary)',
    accent: 'var(--color-accent)',
  },
}
```

### Design Rules

- **Red is reserved for emergencies only**: `escalated` status, Dispatch button, AlertStatusCard in HELP_TRIGGERED state, Low Battery indicator.
- **Blue/violet accents** for primary actions (Join Session, Send Command, Submit Report).
- **Amber** for warnings (pending status badge, low battery warning text).
- **Green** for success states (active status, online indicator, command acknowledged).
- **Dark theme** by default (`slate-900` background, `slate-100` text).

---

## File / Folder Structure

```
remote-robot-healthcare/
├── app/                              ← Next.js App Router
│   ├── layout.tsx                    ← Root layout (NavBar, providers)
│   ├── page.tsx                      ← Redirects to /login or /
│   ├── login/
│   │   └── page.tsx                  ← LoginPage
│   ├── (doctor)/                     ← Route group (auth-protected)
│   │   ├── layout.tsx                ← Auth guard + NavBar
│   │   ├── page.tsx                  ← Dashboard
│   │   └── sessions/
│   │       └── [id]/
│   │           └── page.tsx          ← SessionPage
│   └── patient/
│       └── [id]/
│           └── status/
│               └── page.tsx          ← PatientStatusPage
│
├── components/
│   ├── layout/
│   │   └── NavBar.tsx
│   ├── dashboard/
│   │   ├── SessionCard.tsx
│   │   └── EmptyState.tsx
│   ├── session/
│   │   ├── SessionHeader.tsx
│   │   ├── SessionStatusBadge.tsx
│   │   ├── SessionTimer.tsx
│   │   ├── VideoPanel.tsx
│   │   ├── PatientProfilePanel.tsx
│   │   ├── PatientInfoCard.tsx
│   │   ├── MedicationList.tsx
│   │   ├── AllergyList.tsx
│   │   ├── EmergencyContactList.tsx
│   │   ├── ClinicalNotesCollapsible.tsx
│   │   ├── RobotStatusCard.tsx
│   │   ├── AlertStatusCard.tsx
│   │   ├── ControlBar.tsx
│   │   ├── MovementPad.tsx
│   │   ├── CameraControls.tsx
│   │   ├── AudioControls.tsx
│   │   ├── CommandButton.tsx
│   │   ├── LastCommandPanel.tsx
│   │   └── CommandLog.tsx
│   ├── modals/
│   │   ├── ReportModal.tsx
│   │   ├── ReportForm.tsx
│   │   ├── DispatchConfirmDialog.tsx
│   │   └── EndSessionConfirmDialog.tsx
│   ├── patient/
│   │   └── PatientStatusPage.tsx
│   └── ui/                           ← Shared primitives
│       ├── Button.tsx
│       ├── Badge.tsx
│       ├── Card.tsx
│       ├── Toast.tsx
│       ├── ProgressBar.tsx
│       └── Spinner.tsx
│
├── stores/
│   ├── patientStore.ts           ← unified store (replaces sessionStore + patientStore + robotStore)
│   └── commandStore.ts
│
├── lib/
│   ├── apiClient.ts                  ← fetch wrapper
│   ├── formatters.ts                 ← date/time, duration helpers
│   └── constants.ts                  ← poll intervals, char limits
│
├── mocks/
│   ├── browser.ts                    ← MSW worker
│   ├── handlers/
│   │   ├── patients.ts           ← GET /patients, GET /patients/:id, POST /patients/:id/join
│   │   ├── commands.ts
│   │   ├── reports.ts
│   │   └── dispatch.ts
│   └── fixtures/
│       └── patients.json         ← array of PatientRecord objects
│
├── types/
│   └── index.ts                      ← All TypeScript interfaces
│
└── __tests__/
    ├── unit/
    │   ├── formatters.test.ts
    │   ├── commandBuilder.test.ts
    │   └── reportValidation.test.ts
    ├── components/
    │   ├── SessionHeader.test.tsx
    │   ├── AlertStatusCard.test.tsx
    │   └── ControlBar.test.tsx
    └── properties/
        ├── commandBuilder.property.test.ts
        ├── reportValidation.property.test.ts
        └── sessionStatus.property.test.ts
```

---

## Error Handling

### API Error Strategy

| Scenario | Behaviour |
|---|---|
| `GET /api/v1/patients` fails | Show error banner on Dashboard; retry button |
| `POST /api/v1/patients/:id/join` fails | Inline error on patient card; no navigation; revert optimistic update |
| `GET /api/v1/patients/:id` 404 | "Patient profile unavailable" in left panel; rest of page loads |
| `POST /api/v1/sessions/:id/commands` fails | "Command failed" indicator for 3 s; revert `robot.last_command_at` patch |
| `POST /api/v1/reports` 422 | Display server field errors inside modal; keep modal open; revert status patch |
| `POST /api/v1/dispatch` 409 | "Emergency services were already dispatched"; close dialog |
| Network timeout | Generic "Connection error — please retry" toast |

### Loading States

Every data-fetching component renders a skeleton loader while awaiting the first response. Subsequent polling updates happen silently (no skeleton re-render).

### Offline / Robot Offline

When `patient.robot.connection === 'offline'`:
- Amber banner in centre panel.
- All `CommandButton` components receive `disabled={true}`.
- Tooltip on hover: "Robot is offline".

---

## Testing Strategy

### Unit Tests (Vitest + React Testing Library)

Focus on specific examples, edge cases, and error conditions:

- `formatters.ts`: date formatting, duration display, local time conversion.
- `commandBuilder`: correct JSON shape for each command type.
- `reportValidation`: required field checks, character limit enforcement.
- `SessionHeader`: timer increments, status badge colour, button disabled states.
- `AlertStatusCard`: renders red glow and pulse animation when status is `escalated`.
- `ControlBar`: buttons disabled when `robotOnline === false`.
- `ReportForm`: inline errors on empty submit, character counters.
- `DispatchConfirmDialog`: Confirm button disabled until reason ≥ 10 chars.

### Property-Based Tests (Vitest + fast-check)

Each property test runs a minimum of **100 iterations**. Tests are tagged with the format:
`// Feature: remote-robot-healthcare, Property N: <property_text>`

See Correctness Properties section for the full list of properties.

### Integration Tests

- Mock API handlers return correct fixture shapes for all endpoints.
- Session polling updates the UI without full page reload.
- End-to-end flow: join session → send command → submit report → session closed.

### Accessibility

- All interactive controls have `aria-label` attributes.
- Keyboard navigation: Tab through control pad, Enter/Space to activate.
- Colour is never the sole indicator of state (icons + text accompany all colour cues).
- Minimum 24px font for PatientStatusPage status message.


---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Patient card renders all required fields

*For any* array of `PatientRecord` objects, the Dashboard should render a card for each patient that contains `patient.name`, a status badge derived from `patient.status`, and `patient.last_updated` formatted as local time.

**Validates: Requirements 1.2**

---

### Property 2: Status badge colour matches patient status

*For any* `PatientRecord` with a given `status` value, the rendered status badge should have the colour token corresponding to that status: amber (flashing) for `HELP_TRIGGERED`, green for `IN_SESSION`, grey for `IDLE`, red for `ESCALATED`.

**Validates: Requirements 1.3**

---

### Property 3: Patient list sort order invariant

*For any* array of `PatientRecord` objects, after applying the dashboard sort function, patients should appear in priority order: `HELP_TRIGGERED` first, then `IN_SESSION`, then `ESCALATED`, then `IDLE`, ordered by `last_updated` ascending within each group.

**Validates: Requirements 1.4**

---

### Property 4: Terminal patient status disables controls and shows summary view

*For any* `PatientRecord` whose `status` is `IDLE` with a non-null `session.ended_at`, or whose `status` is `ESCALATED`, the Session_Page should disable all robot control buttons and display the session summary view rather than the active control panels.

**Validates: Requirements 2.5, 12.4**

---

### Property 5: Patient profile card renders all required fields

*For any* valid `PatientRecord`, the rendered `PatientInfoCard` should contain `patient.name`, `patient.address.line1`, and `patient.address.line2`.

**Validates: Requirements 3.2**

---

### Property 6: Robot status card renders all required fields

*For any* valid `PatientRecord`, the rendered `RobotStatusCard` should contain the online/offline indicator (from `patient.robot.connection`), battery percentage progress bar (from `patient.robot.battery`), `patient.robot.last_command`, and `patient.robot.last_command_at` formatted as "X seconds/minutes ago".

**Validates: Requirements 4.2**

---

### Property 7: Battery low indicator threshold

*For any* `patient.robot.battery` value, the low battery indicator (red colour + "Low Battery" label) should be displayed if and only if `patient.robot.battery` is 20 or below.

**Validates: Requirements 4.3**

---

### Property 8: Video panel overlay contains patient name

*For any* `PatientRecord`, the `VideoPanel` overlay should contain `patient.name` rendered at the bottom-left of the placeholder area.

**Validates: Requirements 5.3**

---

### Property 9: Robot command construction correctness

*For any* `PatientRecord` with a non-null `session.session_id` and any valid `command`/`direction` combination, clicking the corresponding `CommandButton` should produce a `RobotCommand` object whose `session_id` matches `patient.session.session_id`, whose `command` and `direction` fields match the button's configuration, and whose `issued_at` is a valid ISO 8601 UTC timestamp.

**Validates: Requirements 6.3**

---

### Property 10: Last command panel renders as valid JSON

*For any* `RobotCommand` object, the `LastCommandPanel` should render it as syntactically valid, indented JSON that contains all fields of the command (`session_id`, `command`, `direction`, `issued_at`).

**Validates: Requirements 6.4**

---

### Property 11: Command log retains only the last 20 entries

*For any* sequence of N robot commands sent during a session (where N > 20), the command log should contain exactly 20 entries, all of which are the 20 most recently sent commands in reverse-chronological order.

**Validates: Requirements 6.7**

---

### Property 12: Report form displays session metadata as read-only

*For any* `session_id`, patient full name, and elapsed duration in seconds, the `ReportForm` should display all three values as non-editable read-only fields at the top of the form.

**Validates: Requirements 7.3**

---

### Property 13: Report payload construction correctness

*For any* valid combination of `chief_complaint`, `assessment`, `plan`, `disposition`, and elapsed time, submitting the report form should produce a `ReportPayload` whose fields exactly match the provided form values and whose `duration_seconds` equals the elapsed session time.

**Validates: Requirements 7.4**

---

### Property 14: Report form validation rejects any empty required field

*For any* non-empty subset of required report fields (`chief_complaint`, `assessment`, `plan`, `disposition`) left empty, submitting the form should display an inline validation error beneath each empty field and should not invoke the reports API.

**Validates: Requirements 7.6**

---

### Property 15: Dispatch dialog shows correct patient information

*For any* `PatientRecord`, clicking "Dispatch Emergency Services" should open a confirmation dialog that contains `patient.name`, `patient.address.line1`, and `patient.address.line2`.

**Validates: Requirements 8.2**

---

### Property 16: Dispatch reason length gates confirmation button

*For any* string entered in the "Reason for dispatch" field, the "Confirm Dispatch" button should be enabled if and only if the string's length is 10 or greater.

**Validates: Requirements 8.3**

---

### Property 17: Dispatch request payload construction correctness

*For any* `PatientRecord` with a non-null `session.session_id` and a reason string (length ≥ 10), confirming the dispatch should produce a `DispatchRequest` whose `session_id` matches `patient.session.session_id`, `patient_id` matches `patient.patient_id`, `address` is the concatenation of `patient.address.line1` and `patient.address.line2`, and `requested_at` is a valid ISO 8601 UTC timestamp.

**Validates: Requirements 8.4**

---

### Property 18: Patient status page displays correct status message

*For any* valid `PatientStatus` value, the `PatientStatusPage` should display the corresponding status message: `IDLE` → "No active session", `HELP_TRIGGERED` → "Help request received — connecting you to a clinician…", `IN_SESSION` → "A clinician is with you now", `ESCALATED` → "Emergency services have been contacted".

**Validates: Requirements 11.3**

---

### Property 19: Patient status page greeting uses first name

*For any* `patient.name` string, the `PatientStatusPage` should display the first word of the name as the personalised greeting at the top of the page.

**Validates: Requirements 11.6**

---

### Property 20: Patient status page contains no clinical data

*For any* `PatientRecord`, the rendered `PatientStatusPage` should not contain any robot control buttons, report form elements, `address` fields, or `session_id` values.

**Validates: Requirements 11.9**

---

### Property 21: Unauthenticated users are redirected to login

*For any* protected route path (any path other than `/login`), navigating to that path without a valid authentication token should result in a redirect to `/login`.

**Validates: Requirements 12.2**

---

### Property 22: Mock API delay falls within configured range

*For any* mocked API endpoint and any request to that endpoint, the simulated response delay should be between 300ms and 600ms inclusive.

**Validates: Requirements 13.3**

---

### Property 23: Mock API console log format

*For any* mock API call with any HTTP method, path, and response status, the console log entry should match the format `[MOCK API] {METHOD} {path} → {status}` exactly.

**Validates: Requirements 13.6**
