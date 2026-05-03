#!/usr/bin/env python3
"""
robot_control/robot_interface.py

Handles camera pointing commands and keeps the shared server state in sync.
Commands are dispatched here from server.py's PUT /state handler.

Public API:
    move(direction)  -- "left" | "right" | "up" | "down" | "stop"
"""

import datetime

import json_server as server

# ---------------------------------------------------------------------------
# Camera movement
# ---------------------------------------------------------------------------

DIRECTIONS = {"left", "right", "up", "down", "stop"}

_movement_lock = __import__("threading").Lock()


def move(direction: str) -> None:
    """
    Point the camera in the given direction.

    Args:
        direction: one of "left", "right", "up", "down", "stop"
    """
    direction = direction.lower()
    if direction not in DIRECTIONS:
        raise ValueError(f"Invalid direction '{direction}'. Must be one of {DIRECTIONS}")

    with _movement_lock:
        # TODO: replace with actual robot SDK calls, e.g.:
        # if direction == "left":  robot_sdk.pan(-1)
        # if direction == "right": robot_sdk.pan(1)
        # if direction == "up":    robot_sdk.tilt(1)
        # if direction == "down":  robot_sdk.tilt(-1)
        # if direction == "stop":  robot_sdk.stop()
        print(f"[robot] move {direction}")
        _record_command(f"move_{direction}")


def _record_command(cmd: str) -> None:
    """Update the robot sub-state with the latest command and timestamp."""
    now = datetime.datetime.now().isoformat()
    server.state["robot"]["last_command"] = cmd
    server.state["robot"]["last_command_at"] = now
    server.state["last_updated"] = now
