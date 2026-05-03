"use client";

import React, { useState, useCallback, useRef } from "react";
import type { RobotAction, RobotCommand } from "@/types";
import { useCommandStore } from "@/stores/commandStore";
import { usePatientStore } from "@/stores/patientStore";
import { post } from "@/lib/apiClient";

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
 * CommandButton — sends a single robot command to the API.
 *
 * Behaviour:
 * - Builds a RobotCommand { session_id, action, issued_at } on click.
 * - POSTs to /api/v1/sessions/{sessionId}/commands via apiClient.
 * - On success: updates commandStore and patientStore, shows green "Command sent" for 3 s.
 * - On failure: updates commandStore, shows red "Command failed" for 3 s.
 * - Disabled while a command is in-flight (prevents double-clicks).
 * - Calls onCommandSent(cmd) if provided, regardless of success/failure.
 *
 * Related requirements:
 * - Requirement 6: Robot Control UI
 * - Acceptance Criteria 6.1: Construct RobotCommand JSON and POST on click
 * - Acceptance Criteria 6.2: Show "Command sent" / "Command failed" for 3 s
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
  // Ref provides a synchronous guard against double-clicks before React re-renders
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
      await post(`/sessions/${sessionId}/commands`, cmd);

      // Success path
      addCommand(cmd, true);
      patchActivePatient({
        robot: {
          last_command: cmd.action,
          last_command_at: cmd.issued_at,
        } as never,
      });
      setStatus("sent");
    } catch {
      // Failure path
      addCommand(cmd, false);
      setStatus("failed");
    } finally {
      setIsInFlight(false);
      inFlightRef.current = false;
      onCommandSent?.(cmd);

      // Auto-clear the status indicator after 3 seconds
      setTimeout(() => {
        setStatus("idle");
      }, 3000);
    }
  }, [disabled, sessionId, action, addCommand, patchActivePatient, onCommandSent]);

  const isDisabled = disabled || isInFlight;

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        aria-label={label}
        aria-busy={isInFlight}
        className={[
          "flex items-center justify-center gap-2 px-4 py-2 rounded-lg",
          "text-sm font-medium transition-colors duration-150",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900",
          isDisabled
            ? "bg-slate-700 text-slate-500 cursor-not-allowed opacity-60"
            : "bg-slate-700 text-slate-100 hover:bg-slate-600 active:bg-slate-500 cursor-pointer",
        ].join(" ")}
      >
        {icon && <span aria-hidden="true">{icon}</span>}
        <span>{label}</span>
      </button>

      {/* 3-second status indicator */}
      {status !== "idle" && (
        <span
          role="status"
          aria-live="polite"
          className={[
            "text-xs font-medium px-2 py-0.5 rounded",
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
