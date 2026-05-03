"use client";

import React, { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { usePatientStore } from "@/stores/patientStore";
import { get } from "@/lib/apiClient";
import { POLL_INTERVAL_MS } from "@/lib/constants";
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
 * Top-level page component for an active session. Orchestrates data fetching,
 * polling, and layout.
 *
 * Responsibilities:
 * - Fetch PatientRecord on mount from GET /api/v1/patients/{patient_id}
 * - Store in patientStore.activePatient
 * - Poll every POLL_INTERVAL_MS (10 seconds)
 * - Render three-panel layout:
 *   - Left: PatientInfoCard (patient profile)
 *   - Centre: VideoPanel (video placeholder) or summary message
 *   - Right: AlertStatusCard + stubs for future action panels
 *
 * Behaviour:
 * - When patient.status is IDLE with session.ended_at non-null, or ESCALATED,
 *   replace centre panel with a summary/confirmation message
 * - Stop polling when session is no longer active
 *
 * Related requirements:
 * - Requirement 2: Session Page Layout
 * - Milestone 3, Task 3.6
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

  // Fetch patient data
  const fetchPatient = async () => {
    try {
      const patient = await get<PatientRecord>(`/patients/${patientId}`);
      setActivePatient(patient);
    } catch (error) {
      console.error("Failed to fetch patient:", error);
    }
  };

  // Set up polling
  useEffect(() => {
    fetchPatient();

    pollIntervalRef.current = setInterval(() => {
      fetchPatient();
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [patientId]);

  // Stop polling when session ends or is escalated
  useEffect(() => {
    if (!activePatient) return;

    const shouldStopPolling =
      (activePatient.status === "IDLE" &&
        activePatient.session.ended_at !== null) ||
      activePatient.status === "ESCALATED";

    if (shouldStopPolling && pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, [activePatient?.status, activePatient?.session.ended_at]);

  // Handle successful dispatch
  const handleDispatchSuccess = () => {
    patchActivePatient({ status: "ESCALATED" });
    closeDispatchDialog();
  };

  // Loading state
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

  // Error state
  if (activeError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-red-700">
            Error loading session
          </p>
          <p className="mt-1 text-sm text-red-600">{activeError}</p>
        </div>
      </div>
    );
  }

  // Determine if we should show the summary view instead of active session
  const showSummaryView =
    (activePatient.status === "IDLE" &&
      activePatient.session.ended_at !== null) ||
    activePatient.status === "ESCALATED";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Fixed header */}
      <SessionHeader
        patient={activePatient}
        onEndSession={openReportModal}
        onDispatch={openDispatchDialog}
      />

      {/* Persistent EMS Dispatch Banner */}
      {activePatient.status === "ESCALATED" && (
        <Banner
          message="Emergency services have been dispatched"
          variant="error"
          className="sticky top-[73px] z-40"
        />
      )}

      {/* Three-panel layout */}
      <div className="mx-auto max-w-screen-xl px-6 py-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Left panel: Patient Profile (3 columns) */}
          <div className="lg:col-span-3 space-y-4">
            <PatientInfoCard
              name={activePatient.name}
              addressLine1={activePatient.address.line1}
              addressLine2={activePatient.address.line2}
            />
            <RobotStatusCard robot={activePatient.robot} />
          </div>

          {/* Centre panel: Video or Summary (6 columns) */}
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

            {/* Robot Movement Controls */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-5 text-sm font-semibold text-slate-700">
                Robot Movement Controls
              </h3>
              <div className="flex justify-center">
                <MovementPad
                  sessionId={activePatient.session.session_id ?? ""}
                  robotOnline={activePatient.robot.connection === "online"}
                  onCommandSent={() => {}}
                />
              </div>
            </div>

            <LastCommandPanel />
          </div>

          {/* Right panel: Alert Status + Command Log (3 columns) */}
          <div className="lg:col-span-3 space-y-4">
            <AlertStatusCard
              status={activePatient.status}
              helpTriggeredAt={activePatient.help_event.triggered_at}
            />
            <CommandLogConnected />
          </div>
        </div>
      </div>

      {/* Modals */}
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

      {/* Report Modal */}
      {activePatient.session.started_at && (
        <ReportModal
          isOpen={isReportModalOpen}
          sessionId={activePatient.session.session_id || ""}
          patientName={activePatient.name}
          durationSeconds={Math.floor(
            (Date.now() -
              new Date(activePatient.session.started_at).getTime()) /
              1000
          )}
          clinicianId="doc-456" // TODO: Get from auth context
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
