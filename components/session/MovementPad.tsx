"use client";

import React from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  StopCircle,
} from "lucide-react";
import { CommandButton } from "@/components/session/CommandButton";
import type { RobotCommand } from "@/types";

interface MovementPadProps {
  sessionId: string;
  robotOnline: boolean;
  onCommandSent: (cmd: RobotCommand) => void;
}

/**
 * MovementPad — D-pad layout of five directional CommandButtons.
 *
 * Layout:
 *          [▲ Up]
 * [◄ Left] [■ Stop] [► Right]
 *          [▼ Down]
 *
 * All buttons are disabled with tooltip "Robot is offline" when
 * robotOnline === false.
 *
 * Related requirements:
 * - Requirement 4: Robot Control UI
 * - Acceptance Criteria 4.4: Five buttons in D-pad layout, disabled when offline
 */
export function MovementPad({
  sessionId,
  robotOnline,
  onCommandSent,
}: MovementPadProps) {
  const isDisabled = !robotOnline;
  const offlineTooltip = isDisabled ? "Robot is offline" : undefined;

  return (
    <div
      role="group"
      aria-label="Robot movement controls"
      className="inline-grid grid-cols-3 grid-rows-3 gap-2"
    >
      {/* Row 1: Up button (centre column) */}
      <div className="col-start-2 row-start-1 flex justify-center">
        <div title={offlineTooltip}>
          <CommandButton
            sessionId={sessionId}
            action="up"
            label="Move Up"
            icon={<ArrowUp size={18} aria-hidden="true" />}
            disabled={isDisabled}
            onCommandSent={onCommandSent}
          />
        </div>
      </div>

      {/* Row 2: Left, Stop, Right */}
      <div className="col-start-1 row-start-2 flex justify-center">
        <div title={offlineTooltip}>
          <CommandButton
            sessionId={sessionId}
            action="left"
            label="Move Left"
            icon={<ArrowLeft size={18} aria-hidden="true" />}
            disabled={isDisabled}
            onCommandSent={onCommandSent}
          />
        </div>
      </div>

      <div className="col-start-2 row-start-2 flex justify-center">
        <div title={offlineTooltip}>
          <CommandButton
            sessionId={sessionId}
            action="stop"
            label="Stop"
            icon={<StopCircle size={18} aria-hidden="true" />}
            disabled={isDisabled}
            onCommandSent={onCommandSent}
          />
        </div>
      </div>

      <div className="col-start-3 row-start-2 flex justify-center">
        <div title={offlineTooltip}>
          <CommandButton
            sessionId={sessionId}
            action="right"
            label="Move Right"
            icon={<ArrowRight size={18} aria-hidden="true" />}
            disabled={isDisabled}
            onCommandSent={onCommandSent}
          />
        </div>
      </div>

      {/* Row 3: Down button (centre column) */}
      <div className="col-start-2 row-start-3 flex justify-center">
        <div title={offlineTooltip}>
          <CommandButton
            sessionId={sessionId}
            action="down"
            label="Move Down"
            icon={<ArrowDown size={18} aria-hidden="true" />}
            disabled={isDisabled}
            onCommandSent={onCommandSent}
          />
        </div>
      </div>
    </div>
  );
}
