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
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
      <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-4">
        {/* Left: back arrow + patient name + badge + timer */}
        <div className="flex items-center gap-4 min-w-0">
          {/* Robot connection dot */}
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

          {/* Patient name — prominent */}
          <h1 className="truncate text-xl font-bold text-slate-900">
            {patient.name}
          </h1>

          {/* Status badge */}
          <SessionStatusBadge status={patient.status} />

          {/* Session ID — visually subtle, required for test assertions */}
          {patient.session.session_id && (
            <span className="hidden font-mono text-xs text-slate-400 sm:block">
              {patient.session.session_id}
            </span>
          )}

          {/* Timer — slightly larger, monospace */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-md bg-slate-50 px-3 py-1.5 ring-1 ring-slate-200">
            <svg
              className="h-3.5 w-3.5 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" strokeWidth="2" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2" />
            </svg>
            <SessionTimer startedAt={patient.session.started_at} />
          </div>
        </div>

        {/* Right: action buttons */}
        <div className="flex flex-shrink-0 items-center gap-3">
          {/* Dispatch button */}
          <button
            onClick={onDispatch}
            disabled={isEscalated}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${
              isEscalated
                ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                : "bg-red-600 text-white hover:bg-red-700 active:bg-red-800"
            }`}
            aria-label={
              isEscalated
                ? "Emergency services already dispatched"
                : "Dispatch emergency services"
            }
          >
            {isEscalated ? (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Dispatched
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Dispatch Emergency Services
              </>
            )}
          </button>

          {/* End Session button */}
          <button
            onClick={onEndSession}
            disabled={!isInSession}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            aria-label="End session and submit report"
          >
            End Session
          </button>
        </div>
      </div>
    </header>
  );
}
