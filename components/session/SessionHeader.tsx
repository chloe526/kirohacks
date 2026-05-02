"use client";

import React from "react";
import type { PatientRecord } from "@/types";
import { SessionStatusBadge } from "./SessionStatusBadge";
import { SessionTimer } from "./SessionTimer";

interface SessionHeaderProps {
  patient: PatientRecord;
  onEndSession: () => void;
  onDispatch: () => void;
}

/**
 * SessionHeader
 *
 * Fixed top bar showing session metadata and primary action buttons.
 *
 * Layout:
 * ┌──────────────────────────────────────────────────────────────────┐
 * │  [●] John Doe  │  sess-xyz789  │  ⏱ 00:07:23  │  [IN_SESSION]   │
 * │                                          [End Session] [🚨 Dispatch]│
 * └──────────────────────────────────────────────────────────────────┘
 *
 * Behaviour:
 * - Timer counts up from `patient.session.started_at` using `setInterval` (1 s tick).
 * - Status badge colour: `IN_SESSION` → green, `ESCALATED` → red (flashing),
 *   `IDLE` → grey, `HELP_TRIGGERED` → amber (flashing).
 * - When `patient.status` is `ESCALATED`, "Dispatch" button is disabled and
 *   relabelled "Dispatched".
 */
export function SessionHeader({
  patient,
  onEndSession,
  onDispatch,
}: SessionHeaderProps) {
  const isEscalated = patient.status === "ESCALATED";
  const isInSession = patient.status === "IN_SESSION";

  return (
    <header className="sticky top-0 z-50 border-b border-slate-700 bg-slate-900 px-6 py-4 shadow-lg">
      <div className="flex items-center justify-between">
        {/* Left section: Patient info, session ID, timer, status badge */}
        <div className="flex items-center gap-6">
          {/* Patient name with online indicator */}
          <div className="flex items-center gap-2">
            <div
              className={`h-3 w-3 rounded-full ${
                patient.robot.connection === "online"
                  ? "bg-green-500"
                  : "bg-red-500"
              }`}
              aria-label={
                patient.robot.connection === "online"
                  ? "Robot online"
                  : "Robot offline"
              }
            />
            <h1 className="text-xl font-semibold text-slate-100">
              {patient.name}
            </h1>
          </div>

          {/* Session ID */}
          {patient.session.session_id && (
            <div className="text-sm text-slate-400">
              <span className="font-mono">{patient.session.session_id}</span>
            </div>
          )}

          {/* Session Timer */}
          <SessionTimer startedAt={patient.session.started_at} />

          {/* Status Badge */}
          <SessionStatusBadge status={patient.status} />
        </div>

        {/* Right section: Action buttons */}
        <div className="flex items-center gap-3">
          {/* End Session button */}
          <button
            onClick={onEndSession}
            disabled={!isInSession}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-slate-700"
            aria-label="End session and submit report"
          >
            End Session
          </button>

          {/* Dispatch Emergency Services button */}
          <button
            onClick={onDispatch}
            disabled={isEscalated}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              isEscalated
                ? "cursor-not-allowed bg-slate-700 text-slate-400 opacity-50"
                : "bg-red-600 text-white hover:bg-red-700"
            }`}
            aria-label={
              isEscalated
                ? "Emergency services already dispatched"
                : "Dispatch emergency services"
            }
          >
            {isEscalated ? (
              <span className="flex items-center gap-2">
                Dispatched
                <span className="text-lg" aria-hidden="true">
                  ✓
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="text-lg" aria-hidden="true">
                  🚨
                </span>
                Dispatch Emergency Services
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
