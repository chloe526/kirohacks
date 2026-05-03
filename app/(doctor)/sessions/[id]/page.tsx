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
      // Error handling will be improved in future milestones
    }
  };

  // Set up polling
  useEffect(() => {
    // Initial fetch
    fetchPatient();

    // Set up polling interval
    pollIntervalRef.current = setInterval(() => {
      fetchPatient();
    }, POLL_INTERVAL_MS);

    // Cleanup on unmount
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
    // Optimistically update patient status to ESCALATED
    patchActivePatient({ status: "ESCALATED" });
    closeDispatchDialog();
  };

  // Loading state
  if (isLoadingActive || !activePatient) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-lg">Loading session...</div>
      </div>
    );
  }

  // Error state
  if (activeError) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-red-400 text-lg">
          Error loading session: {activeError}
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
    <div className="min-h-screen bg-slate-900">
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
      <div className="container mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left panel: Patient Profile (3 columns on large screens) */}
          <div className="lg:col-span-3">
            <PatientInfoCard
              name={activePatient.name}
              addressLine1={activePatient.address.line1}
              addressLine2={activePatient.address.line2}
            />
          </div>

          {/* Centre panel: Video or Summary (6 columns on large screens) */}
          <div className="lg:col-span-6">
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
          </div>

          {/* Right panel: Alert Status + future action panels (3 columns on large screens) */}
          <div className="lg:col-span-3 space-y-6">
            <AlertStatusCard
              status={activePatient.status}
              helpTriggeredAt={activePatient.help_event.triggered_at}
            />

            {/* Placeholder for future action panels (Milestone 4+) */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <h3 className="text-sm font-medium text-slate-400 mb-2">
                Robot Controls
              </h3>
              <p className="text-xs text-slate-500">
                Coming in Milestone 4
              </p>
            </div>

            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <h3 className="text-sm font-medium text-slate-400 mb-2">
                Command Log
              </h3>
              <p className="text-xs text-slate-500">
                Coming in Milestone 4
              </p>
            </div>
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
            (Date.now() - new Date(activePatient.session.started_at).getTime()) / 1000
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
 *
 * Shows a confirmation message appropriate to the status.
 */
function SummaryPanel({ patient }: { patient: PatientRecord }) {
  const isEscalated = patient.status === "ESCALATED";
  const isEnded =
    patient.status === "IDLE" && patient.session.ended_at !== null;

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 min-h-[360px] flex items-center justify-center">
      <div className="text-center space-y-4">
        {isEscalated && (
          <>
            <div className="text-6xl mb-4" aria-hidden="true">
              🚨
            </div>
            <h2 className="text-2xl font-semibold text-red-400">
              Emergency Services Dispatched
            </h2>
            <p className="text-slate-300 max-w-md">
              Emergency services have been contacted for {patient.name}.
              The session is now in escalated status.
            </p>
          </>
        )}

        {isEnded && (
          <>
            <div className="text-6xl mb-4" aria-hidden="true">
              ✓
            </div>
            <h2 className="text-2xl font-semibold text-green-400">
              Session Ended
            </h2>
            <p className="text-slate-300 max-w-md">
              The session with {patient.name} has been completed.
              {patient.session.session_id && (
                <span className="block mt-2 text-sm text-slate-400">
                  Session ID: {patient.session.session_id}
                </span>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
