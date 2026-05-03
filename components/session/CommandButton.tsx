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

      addCommand(cmd, true);
      patchActivePatient({
        robot: {
          last_command: cmd.action,
          last_command_at: cmd.issued_at,
        } as never,
      });
      setStatus("sent");
    } catch {
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
