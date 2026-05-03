#!/usr/bin/env python3
"""
Lightweight web server that exposes a global state dictionary at GET /state.
Import and call start_server() to run it, or run this file directly.
"""

import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

# Robot state
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


HOST = "localhost"
PORT = 8081


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
            self.send_response(404)
            self.end_headers()

    # Suppress default request logging - remove this to see access logs
    def log_message(self, format, *args):
        pass


def start_server(host: str = HOST, port: int = PORT) -> HTTPServer:
    httpd = HTTPServer((host, port), _Handler)

    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    print(f"Server running at http://{host}:{port}/state")

