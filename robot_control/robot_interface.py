#!/usr/bin/env python3
"""
robot_control/robot_interface.py

Handles camera pointing commands and keeps the shared server state in sync.
Commands are dispatched here from server.py's PUT /state handler.

Public API:
    initialize()     -- start up the robot hardware; call once at program start
    move(direction)  -- "left" | "right" | "up" | "down" | "stop"
"""

import datetime
import math
import threading

import json_server as server

try:
    import stretch_body.robot as stretch_robot
except ImportError:
    stretch_robot = None

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DIRECTIONS = {"left", "right", "up", "down", "stop"}

# Camera pan/tilt increment in radians (10 degrees)
_PAN_TILT_INCREMENT_RAD = math.radians(10)

# ---------------------------------------------------------------------------
# Module-level robot instance
# ---------------------------------------------------------------------------

_robot = None
_movement_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Initialization
# ---------------------------------------------------------------------------

def initialize() -> bool:
    """
    Start up the Stretch robot hardware.

    Opens USB communication, loads parameters, launches background polling
    threads, and homes the robot if needed. Should be called once at program
    start before any calls to move().

    Returns:
        True if the robot connected and started successfully, False otherwise
        (e.g. when running without hardware or stretch_body is not installed).
    """
    global _robot

    if stretch_robot is None:
        print("[robot] stretch_body not available — running in simulation mode")
        server.state["robot"]["connection"] = "offline"
        return False

    _robot = stretch_robot.Robot()
    did_startup = _robot.startup()
    print(f"[robot] Connected to hardware: {did_startup}")

    if not did_startup:
        server.state["robot"]["connection"] = "offline"
        return False

    if not _robot.is_homed():
        print("[robot] Robot is not homed — running homing procedure...")
        _robot.home()

    server.state["robot"]["connection"] = "online"
    print("[robot] Initialization complete")
    return True


# ---------------------------------------------------------------------------
# Camera movement
# ---------------------------------------------------------------------------

def move(direction: str) -> None:
    """
    Pan or tilt the camera by 10 degrees in the given direction.

    Uses head_pan for left/right and head_tilt for up/down. Each call moves
    the joint by _PAN_TILT_INCREMENT_RAD (10°) relative to its current
    position, clamped to the joint's hard limits. "stop" is a no-op that
    records the command without moving.

    Args:
        direction: one of "left", "right", "up", "down", "stop"
    """
    direction = direction.lower()
    if direction not in DIRECTIONS:
        raise ValueError(f"Invalid direction '{direction}'. Must be one of {DIRECTIONS}")

    with _movement_lock:
        if _robot is not None:
            _execute_move(direction)
        else:
            # Simulation mode — log the intent without touching hardware
            print(f"[robot] (sim) move {direction}")

        _record_command(direction)


def _execute_move(direction: str) -> None:
    """
    Dispatch a pan/tilt command to the Stretch head joints.

    Pan  (head_pan):  left = positive increment, right = negative increment
    Tilt (head_tilt): up   = positive increment, down  = negative increment
    """
    if direction == "stop":
        # No active velocity to cancel for Dynamixel servos; just record.
        return

    if direction in ("left", "right"):
        joint_name = "head_pan"
        delta = _PAN_TILT_INCREMENT_RAD if direction == "left" else -_PAN_TILT_INCREMENT_RAD
    else:  # "up" or "down"
        joint_name = "head_tilt"
        delta = _PAN_TILT_INCREMENT_RAD if direction == "up" else -_PAN_TILT_INCREMENT_RAD

    joint = _robot.head.get_joint(joint_name)
    current_pos = joint.status["pos"]
    lo, hi = joint.soft_motion_limits["hard"]
    target_pos = max(lo, min(hi, current_pos + delta))

    _robot.head.move_to(joint_name, target_pos)
    print(f"[robot] {joint_name} {current_pos:.3f} → {target_pos:.3f} rad")


# ---------------------------------------------------------------------------
# State helpers
# ---------------------------------------------------------------------------

def _record_command(cmd: str) -> None:
    """Update the robot sub-state with the latest command and timestamp."""
    now = datetime.datetime.now().isoformat()
    server.state["robot"]["last_command"] = cmd
    server.state["robot"]["last_command_at"] = now
    server.state["last_updated"] = now

def update_battery() -> None:
    """Update the robot state with the latest battery reading and timestamp."""
    now = datetime.datetime.now().isoformat()
    server.state["last_updated"] = now
    voltage = _robot.pimu.status['voltage']
    
    # linear interpolation between 10.0 and 13.8 volts
    out = min(1, max(0, (voltage - 10.0) / 3.8))


    server.state["robot"]["battery"] = out