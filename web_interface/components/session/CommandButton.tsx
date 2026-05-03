"use client";

import React, { useState, useCallback, useRef } from "react";
import type { RobotAction, RobotCommand } from "@/types";
import { useCommandStore } from "@/stores/commandStore";
import { usePatientStore } from "@/stores/patientStore";

// Server-side proxy — avoids CORS when calling the robot IP directly from the browser
const ROBOT_COMMAND_URL = "/api/v1/robot/command";

interface CommandButtonProps {
  sessionId: string;
  action: RobotAction;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  onCommandSent?: (cmd: RobotCommand) => void;
}

type ButtonStatus = "idle" | "sent" | "failed";

/**
 * CommandButton — sends a single robot command via the Next.js proxy.
 *
 * Flow:
 *   click → POST /api/v1/robot/command { move: action }
 *         → proxy forwards PUT http://10.40.98.25:8081/state { move: action }
 *         → on success: update command log + patch full patient state from response
 *         → on failure: log error, show "Command failed" indicator
 *
 * The command log entry is only added after the proxy confirms success.
 */
export function CommandButton({
  sessionId,
  action,
  label,
  icon,
  disabled = false,
  onCommandSent,
}: CommandButtonProps) {
  const [status, setStatus] = useState<ButtonStatus>("idle");
  const [isInFlight, setIsInFlight] = useState(false);
  const inFlightRef = useRef(false);

  const addCommand = useCommandStore((s) => s.addCommand);
  const patchActivePatient = usePatientStore((s) => s.patchActivePatient);

  const handleClick = useCallback(async () => {
    if (inFlightRef.current || disabled) return;

    const cmd: RobotCommand = {
      session_id: sessionId,
      action,
      issued_at: new Date().toISOString(),
    };

    setIsInFlight(true);
    inFlightRef.current = true;

    try {
      console.log("[ROBOT COMMAND] sending", action);

      const res = await fetch(ROBOT_COMMAND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ move: action }),
      });

      console.log("[ROBOT COMMAND] proxy status", res.status);
      const data = await res.json();
      console.log("[ROBOT COMMAND] proxy response", data);

      if (!res.ok) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }

      console.log("[ROBOT COMMAND] sent:", action);

      // Add to command log only after confirmed success
      addCommand(cmd, true);

      // Patch the full patient state from the robot's response — preserves
      // connection, battery, and all other fields rather than overwriting piecemeal
      if (data?.state) {
        patchActivePatient(data.state);
      }

      setStatus("sent");
    } catch (error) {
      console.error("[ROBOT COMMAND] failed:", action, error);
      addCommand(cmd, false);
      setStatus("failed");
    } finally {
      setIsInFlight(false);
      inFlightRef.current = false;
      onCommandSent?.(cmd);

      setTimeout(() => {
        setStatus("idle");
      }, 3000);
    }
  }, [disabled, sessionId, action, addCommand, patchActivePatient, onCommandSent]);

  const isDisabled = disabled || isInFlight;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        aria-label={label}
        aria-busy={isInFlight}
        className={[
          "flex h-14 w-14 items-center justify-center rounded-xl",
          "text-sm font-medium transition-all duration-150",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
          isDisabled
            ? "cursor-not-allowed bg-slate-100 text-slate-300 opacity-60"
            : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm active:bg-slate-100 active:scale-95 cursor-pointer shadow-sm",
        ].join(" ")}
      >
        {icon && <span aria-hidden="true" className="[&>svg]:h-5 [&>svg]:w-5">{icon}</span>}
        <span className="sr-only">{label}</span>
      </button>
      {/* 3-second status indicator — text-green-400 / text-red-400 kept for test assertions */}
      {status !== "idle" && (
        <span
          role="status"
          aria-live="polite"
          className={[
            "text-xs font-medium px-2 py-0.5 rounded-full",
            status === "sent"
              ? "text-green-400 bg-green-500/10"
              : "text-red-400 bg-red-500/10",
          ].join(" ")}
        >
          {status === "sent" ? "Command sent" : "Command failed"}
        </span>
      )}
    </div>
  );
}
