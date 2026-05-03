# Tech Stack

## Web Interface (`web_interface/`)

**Framework:** Next.js 14 (App Router) with TypeScript (strict mode)  
**Styling:** Tailwind CSS v3 — utility-first, no CSS modules or styled-components  
**State management:** Zustand v4 — one store per domain (`patientStore`, `commandStore`, `toastStore`)  
**Icons:** lucide-react  
**Testing:** Vitest + jsdom + React Testing Library + MSW v2 (mock service worker) + fast-check (property-based testing)  
**Path alias:** `@/` maps to `web_interface/` root

### Key libraries
| Purpose | Library |
|---|---|
| HTTP mocking (tests) | `msw` v2 — handlers in `mocks/handlers/` |
| Property-based tests | `fast-check` |
| Component tests | `@testing-library/react` + `@testing-library/jest-dom` |

## Robot Control (`robot_control/`)

**Language:** Python 3  
**Robot SDK:** `stretch_body` (Hello Robot) — imported with a graceful fallback for simulation mode when hardware is absent  
**Camera:** `pyrealsense2` (Intel RealSense) + `opencv-python` (`cv2`) + `numpy`  
**Audio:** `pyaudio` (ReSpeaker 6-channel mic array, channel 0 extracted as mono)  
**HTTP server:** stdlib `http.server.ThreadingHTTPServer` — no external web framework

## Common Commands

All commands run from the `web_interface/` directory.

```bash
# Development server (run manually — do not use in agent commands)
npm run dev

# Production build
npm run build

# Run all tests (single pass, no watch)
npm test
# equivalent: npx vitest run

# Run tests in watch mode (run manually)
npm run test:watch

# Lint
npm run lint
```

## Ports
| Service | Port |
|---|---|
| Next.js dev server | 3000 |
| Robot state API (`json_server.py`) | 8081 |
| Robot stream server (`stream_server.py`) | 8080 |

The live robot is expected at `http://10.40.98.25:8081/state`. The web API proxies or falls back to fixture data when the robot is unreachable.
