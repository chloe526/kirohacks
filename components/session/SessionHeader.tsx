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
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white px-6 py-3 shadow-sm">
      <div className="mx-auto flex max-w-screen-xl items-center justify-between">
        {/* Left section: Patient info, session ID, timer, status badge */}
        <div className="flex items-center gap-5 min-w-0">
          {/* Robot connection dot + patient name */}
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                patient.robot.connection === "online"
                  ? "bg-green-500"
                  : "bg-red-400"
              }`}
              aria-label={
                patient.robot.connection === "online"
                  ? "Robot online"
                  : "Robot offline"
              }
            />
            <h1 className="truncate text-lg font-semibold text-slate-900">
              {patient.name}
            </h1>
          </div>

          {/* Session ID */}
          {patient.session.session_id && (
            <span className="hidden font-mono text-xs text-slate-400 sm:block">
              {patient.session.session_id}
            </span>
          )}

          {/* Session Timer */}
          <SessionTimer startedAt={patient.session.started_at} />

          {/* Status Badge */}
          <SessionStatusBadge status={patient.status} />
        </div>

        {/* Right section: Action buttons */}
        <div className="flex flex-shrink-0 items-center gap-3 pl-4">
          {/* End Session button — secondary style */}
          <button
            onClick={onEndSession}
            disabled={!isInSession}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="End session and submit report"
          >
            End Session
          </button>

          {/* Dispatch Emergency Services button — danger style */}
          <button
            onClick={onDispatch}
            disabled={isEscalated}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${
              isEscalated
                ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                : "bg-red-600 text-white hover:bg-red-700"
            }`}
            aria-label={
              isEscalated
                ? "Emergency services already dispatched"
                : "Dispatch emergency services"
            }
          >
            {isEscalated ? (
              <span className="flex items-center gap-1.5">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Dispatched
              </span>
            ) : (
              "Dispatch Emergency"
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
