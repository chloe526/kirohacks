"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { usePatientStore } from "@/stores/patientStore";
import { get } from "@/lib/apiClient";
import { SESSION_POLL_INTERVAL_MS } from "@/lib/constants";
import type { PatientRecord } from "@/types";
import { SessionHeader } from "@/components/session/SessionHeader";
import { PatientInfoCard } from "@/components/session/PatientInfoCard";
import { VideoPanel } from "@/components/session/VideoPanel";
import { AlertStatusCard } from "@/components/session/AlertStatusCard";
import { RobotStatusCard } from "@/components/session/RobotStatusCard";
import { MovementPad } from "@/components/session/MovementPad";
import { LastCommandPanel } from "@/components/session/LastCommandPanel";
import { CommandLogConnected } from "@/components/session/CommandLog";
import { DispatchConfirmDialog } from "@/components/modals/DispatchConfirmDialog";
import { ReportModal } from "@/components/modals/ReportModal";
import { Banner } from "@/components/ui/Banner";

/**
 * SessionPage
 *
 * Polls /api/v1/patients/:id every SESSION_POLL_INTERVAL_MS (2 s) so that
 * robot state (connection, battery, last command) stays live.
 *
 * All child components receive props derived directly from activePatient —
 * no local state copies, no hardcoded fallbacks.
 */
export default function SessionPage() {
  const params = useParams();
  const patientId = params.id as string;

  const {
    activePatient,
    isLoadingActive,
    activeError,
    setActivePatient,
    openReportModal,
    openDispatchDialog,
    isReportModalOpen,
    closeReportModal,
    isDispatchDialogOpen,
    closeDispatchDialog,
    patchActivePatient,
  } = usePatientStore();

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Stable fetch — useCallback prevents stale closures in the interval.
  const fetchPatient = useCallback(async () => {
    console.log(`[SESSION] fetching patient ${patientId}`);
    try {
      const patient = await get<PatientRecord>(`/patients/${patientId}`);
      console.log(`[SESSION] received status: ${patient.status}`);
      console.log(`[SESSION] received robot connection: ${patient.robot.connection}`);
      setActivePatient(patient);
    } catch (error) {
      console.error("[SESSION] Failed to fetch patient:", error);
    }
  }, [patientId, setActivePatient]);

  // Initial fetch + 2 s polling loop.
  useEffect(() => {
    fetchPatient();
    pollIntervalRef.current = setInterval(fetchPatient, SESSION_POLL_INTERVAL_MS);
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [fetchPatient]);

  // Stop polling once the session is definitively over.
  useEffect(() => {
    if (!activePatient) return;
    const shouldStop =
      (activePatient.status === "IDLE" && activePatient.session.ended_at !== null) ||
      activePatient.status === "ESCALATED";
    if (shouldStop && pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, [activePatient?.status, activePatient?.session.ended_at]);

  const handleDispatchSuccess = () => {
    patchActivePatient({ status: "ESCALATED" });
    closeDispatchDialog();
  };

  if (isLoadingActive || !activePatient) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
          <span className="text-sm">Loading session…</span>
        </div>
      </div>
    );
  }

  if (activeError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-red-700">Error loading session</p>
          <p className="mt-1 text-sm text-red-600">{activeError}</p>
        </div>
      </div>
    );
  }

  // Derive all booleans from the live patient object — no local state copies.
  const robotOnline = activePatient.robot?.connection === "online";
  const showSummaryView =
    (activePatient.status === "IDLE" && activePatient.session.ended_at !== null) ||
    activePatient.status === "ESCALATED";

  return (
    <div className="min-h-screen bg-slate-50">
      <SessionHeader
        patient={activePatient}
        onEndSession={openReportModal}
        onDispatch={openDispatchDialog}
      />

      {activePatient.status === "ESCALATED" && (
        <Banner
          message="Emergency services have been dispatched"
          variant="error"
          className="sticky top-[73px] z-40"
        />
      )}

      <div className="mx-auto max-w-screen-xl px-6 py-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Left: patient info + robot status */}
          <div className="lg:col-span-3 space-y-4">
            <PatientInfoCard
              name={activePatient.name}
              addressLine1={activePatient.address.line1}
              addressLine2={activePatient.address.line2}
            />
            <RobotStatusCard robot={activePatient.robot} />
          </div>

          {/* Centre: video + movement controls */}
          <div className="lg:col-span-6 space-y-4">
            {showSummaryView ? (
              <SummaryPanel patient={activePatient} />
            ) : (
              <VideoPanel
                patientName={activePatient.name}
                robotConnection={activePatient.robot.connection}
                sessionId={activePatient.session.session_id}
                sessionActive={activePatient.session.active}
              />
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-5 text-sm font-semibold text-slate-700">
                Robot Movement Controls
              </h3>
              <div className="flex justify-center">
                <MovementPad
                  sessionId={activePatient.session.session_id ?? ""}
                  robotOnline={robotOnline}
                  onCommandSent={() => {}}
                />
              </div>
            </div>

            <LastCommandPanel />
          </div>

          {/* Right: alert status + command log */}
          <div className="lg:col-span-3 space-y-4">
            <AlertStatusCard
              status={activePatient.status}
              helpTriggeredAt={activePatient.help_event.triggered_at}
            />
            <CommandLogConnected />
          </div>
        </div>
      </div>

      <DispatchConfirmDialog
        isOpen={isDispatchDialogOpen}
        patientName={activePatient.name}
        addressLine1={activePatient.address.line1}
        addressLine2={activePatient.address.line2}
        sessionId={activePatient.session.session_id || ""}
        patientId={activePatient.patient_id}
        onSuccess={handleDispatchSuccess}
        onCancel={closeDispatchDialog}
      />

      {activePatient.session.started_at && (
        <ReportModal
          isOpen={isReportModalOpen}
          sessionId={activePatient.session.session_id || ""}
          patientName={activePatient.name}
          durationSeconds={Math.floor(
            (Date.now() - new Date(activePatient.session.started_at).getTime()) / 1000
          )}
          clinicianId="doc-456"
          onSuccess={closeReportModal}
          onDismiss={closeReportModal}
        />
      )}
    </div>
  );
}

/**
 * SummaryPanel
 *
 * Displayed in place of the VideoPanel when the session has ended (IDLE with
 * ended_at) or has been escalated (ESCALATED).
 */
function SummaryPanel({ patient }: { patient: PatientRecord }) {
  const isEscalated = patient.status === "ESCALATED";
  const isEnded =
    patient.status === "IDLE" && patient.session.ended_at !== null;

  return (
    <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
      <div className="text-center space-y-3">
        {isEscalated && (
          <>
            <div
              className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-red-50"
              aria-hidden="true"
            >
              <svg
                className="h-8 w-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-red-700">
              Emergency Services Dispatched
            </h2>
            <p className="text-sm text-slate-500 max-w-sm">
              Emergency services have been contacted for {patient.name}. The
              session is now in escalated status.
            </p>
          </>
        )}

        {isEnded && (
          <>
            <div
              className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-green-50"
              aria-hidden="true"
            >
              <svg
                className="h-8 w-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-green-700">
              Session Ended
            </h2>
            <p className="text-sm text-slate-500 max-w-sm">
              The session with {patient.name} has been completed.
              {patient.session.session_id && (
                <span className="mt-1 block font-mono text-xs text-slate-400">
                  {patient.session.session_id}
                </span>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}