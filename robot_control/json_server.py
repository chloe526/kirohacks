#!/usr/bin/env python3
"""
Lightweight web server that exposes the robot state at GET /state and
accepts movement/session commands via PUT /state.

PUT /state examples:
    { "move": "left" }
    { "move": "right" }
    { "move": "up" }
    { "move": "down" }
    { "move": "stop" }
    { "status": "IDLE" }
    { "session": { "active": true, "session_id": "abc" } }
"""

import datetime
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# ---------------------------------------------------------------------------
# Shared robot state
# ---------------------------------------------------------------------------

state: dict = {
    "patient_id": "",
    "name": "",
    "address": {
        "line1": "",
        "line2": ""
    },

    # IDLE | HELP_TRIGGERED | CALL_READY
    "status": "IDLE",

    # ISO_8601_TIMESTAMP
    "last_updated": "",

    "help_event": {
        # ISO_8601_TIMESTAMP
        "triggered_at": ""
    },

    "robot": {
        # online | offline
        "connection": "",
        # percent
        "battery": 0.00,
        "last_command": "",

        # ISO_8601_TIMESTAMP
        "last_command_at": ""
    },

    "session": {
        "session_id": "",
        "active": False,
        # ISO_8601_TIMESTAMP
        "started_at": "",
        # ISO_8601_TIMESTAMP
        "ended_at": ""
    }
}

HOST = "0.0.0.0"
PORT = 8081

# ---------------------------------------------------------------------------
# PUT /state handlers
# ---------------------------------------------------------------------------
# Each handler receives the value for its key and updates state/calls robot_interface.
# Import robot_interface lazily to avoid a circular import.

def _apply_move(value: str) -> None:
    import robot_interface
    robot_interface.move(str(value))


def _apply_session(value: dict) -> None:
    session = state["session"]
    for key in ("session_id", "active", "started_at", "ended_at"):
        if key in value:
            session[key] = value[key]
    state["last_updated"] = datetime.datetime.now().isoformat()


def _apply_status(value: str) -> None:
    allowed = {"IDLE", "HELP_TRIGGERED", "CALL_READY"}
    if value not in allowed:
        raise ValueError(f"Invalid status '{value}'. Must be one of {allowed}")
    state["status"] = value
    state["last_updated"] = datetime.datetime.now().isoformat()


_PUT_HANDLERS: dict[str, callable] = {
    "move":    _apply_move,
    "session": _apply_session,
    "status":  _apply_status,
}

# ---------------------------------------------------------------------------
# HTTP handler
# ---------------------------------------------------------------------------

class _Handler(BaseHTTPRequestHandler):

    def do_GET(self):
        if self.path == "/state":
            body = json.dumps(state, indent=2).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_error(404)

    def do_PUT(self):
        if self.path != "/state":
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            self._respond(400, {"error": "Empty request body"})
            return

        try:
            payload = json.loads(self.rfile.read(length))
        except json.JSONDecodeError as exc:
            self._respond(400, {"error": f"Invalid JSON: {exc}"})
            return

        if not isinstance(payload, dict):
            self._respond(400, {"error": "Payload must be a JSON object"})
            return

        errors: dict[str, str] = {}
        for key, value in payload.items():
            handler = _PUT_HANDLERS.get(key)
            if handler is None:
                errors[key] = f"Unknown key '{key}'"
                continue
            try:
                handler(value)
            except (ValueError, TypeError, KeyError) as exc:
                errors[key] = str(exc)

        if errors:
            self._respond(422, {"errors": errors})
        else:
            self._respond(200, {"ok": True, "state": state})

    def _respond(self, code: int, data: dict) -> None:
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        pass  # silence access log

# ---------------------------------------------------------------------------
# Server startup
# ---------------------------------------------------------------------------

def start_server(host: str = HOST, port: int = PORT) -> ThreadingHTTPServer:
    httpd = ThreadingHTTPServer((host, port), _Handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    print(f"[server] Running at http://{host}:{port}/state")
    return httpd
