# Project Structure

## Top-level layout

```
robot_control/       # Python backend — runs on the Stretch robot
web_interface/       # Next.js frontend — doctor-facing dashboard
.kiro/specs/         # Spec-driven development artifacts
```

---

## `robot_control/`

| File | Role |
|---|---|
| `main.py` | Entry point — initialises robot, sets patient info, starts `json_server`, loops on voice detection |
| `json_server.py` | `ThreadingHTTPServer` on port 8081. Owns the shared `state` dict. `GET /state` returns it; `PUT /state` dispatches to handlers (`move`, `session`, `status`, `audio_input`) |
| `robot_interface.py` | Wraps `stretch_body` — `initialize()` and `move(direction)` public API. Falls back to simulation mode when hardware is absent |
| `stream_server.py` | MJPEG video + streaming WAV audio server on port 8080. Uses RealSense + ReSpeaker |
| `detect_voice.py` | Voice wake-word detection — called as a subprocess; exit code 0 = help triggered |

**Shared state pattern:** `json_server.state` is a plain `dict` imported by all modules. Mutations happen in-place; no message queue or pub/sub.

---

## `web_interface/`

### App Router structure (`app/`)

```
app/
  (doctor)/              # Route group — doctor interface
    layout.tsx           # Root HTML shell + ToastContainer
    page.tsx             # Dashboard (patient list)
    sessions/[id]/
      page.tsx           # Active session page
  api/v1/                # Next.js Route Handlers (server-side API)
    patients/
      route.ts           # GET /api/v1/patients
      [id]/
        route.ts         # GET /api/v1/patients/:id
        join/route.ts    # POST /api/v1/patients/:id/join
    robot-state/
      route.ts           # Proxies to robot json_server
  patient/[id]/status/
    page.tsx             # Patient-facing status screen
```

### Components (`components/`)

Organised by feature area — do not mix concerns across folders:

- `dashboard/` — `PatientCard`, `EmptyState`
- `session/` — all session-page panels (`VideoPanel`, `MovementPad`, `AlertStatusCard`, `RobotStatusCard`, `CommandLog`, `LastCommandPanel`, `SessionHeader`, etc.)
- `modals/` — `DispatchConfirmDialog`, `ReportModal`, `ReportForm`, `EndSessionConfirmDialog`
- `patient/` — `PatientStatusPage` (patient-facing view)
- `ui/` — generic primitives: `Badge`, `Banner`, `Toast`, `ToastContainer`

### State (`stores/`)

| Store | Owns |
|---|---|
| `patientStore` | Dashboard patient map, active session patient, modal/dialog open state |
| `commandStore` | Last robot command, command status, rolling log (capped at 20) |
| `toastStore` | Toast notification queue |

Store types are defined in `types/index.ts` alongside all shared interfaces (`PatientRecord`, `RobotCommand`, `ReportPayload`, `DispatchRequest`).

### Supporting directories

| Directory | Purpose |
|---|---|
| `lib/` | `apiClient.ts` (fetch wrapper, prepends `/api/v1`), `constants.ts` (poll intervals, thresholds, limits), `formatters.ts`, `robotState.ts` (live robot state fetch + merge) |
| `hooks/` | `useRobotStateSync` (polls robot at 5 s, patches `patientStore`), `useAudioSocket` |
| `mocks/` | MSW v2 handlers (`handlers/`) + fixture JSON (`fixtures/patients.json`) + browser/server setup |
| `types/` | Single `index.ts` — all shared TypeScript types and Zustand store shapes |
| `__tests__/` | `unit/` (component + utility tests), `integration/` (multi-component flow tests) |

---

## Conventions

- **API calls** always go through `lib/apiClient.ts` (`get<T>`, `post<T>`). Never call `fetch` directly in components.
- **Constants** (poll intervals, character limits, thresholds) live in `lib/constants.ts`. No magic numbers in components.
- **Types** are centralised in `types/index.ts`. Do not define local interfaces that duplicate shared types.
- **Inline SVG icons** are used in `page.tsx` files; `lucide-react` is used in components.
- **`"use client"`** is required on any component that uses hooks, event handlers, or browser APIs.
- **Tests** mirror the source structure. Unit tests go in `__tests__/unit/`, integration tests in `__tests__/integration/`. Use MSW handlers for API mocking — do not mock `fetch` directly.
- **Python modules** share state via `json_server.state` (imported directly). Avoid circular imports by using lazy imports inside handler functions (see `_apply_move` in `json_server.py`).
