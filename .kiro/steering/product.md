# Product: Remote Robot Healthcare (Chansey Care)

A telehealth system that lets a clinician remotely monitor and interact with a patient through a Hello Robot Stretch robot. When a patient calls for help (via voice trigger), the robot detects the event and alerts the doctor's dashboard. The doctor can then join a live session, view a video/audio stream from the robot, control the robot's camera orientation, and take clinical actions (end session with a report, or escalate to emergency services).

## Two subsystems

**Robot Control** (`robot_control/`) — Python backend running on the robot hardware.
- Detects a help-trigger voice event (`detect_voice.py`)
- Exposes robot state over HTTP (`json_server.py` on port 8081)
- Streams live video (Intel RealSense) and audio (ReSpeaker) over HTTP (`stream_server.py` on port 8080)
- Accepts movement commands (pan/tilt camera) via `PUT /state`

**Web Interface** (`web_interface/`) — Next.js doctor-facing dashboard.
- Dashboard: lists all patients, sorted by urgency, with a "Join Session" action
- Session page: three-panel layout (patient info + robot status | video stream | alert status + command log)
- Robot movement pad: sends directional commands to the robot
- Modals: end-session report form, EMS dispatch confirmation

## Patient status lifecycle
`IDLE` → `HELP_TRIGGERED` → `CALL_READY` → `IN_SESSION` → `IDLE` (ended) or `ESCALATED`
