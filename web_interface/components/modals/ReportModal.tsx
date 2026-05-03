"use client";

import React, { useState } from "react";
import { ReportForm } from "./ReportForm";
import { EndSessionConfirmDialog } from "./EndSessionConfirmDialog";
import { post } from "@/lib/apiClient";
import { usePatientStore } from "@/stores/patientStore";
import { useToastStore } from "@/stores/toastStore";
import type { ReportPayload, Disposition } from "@/types";

interface ReportModalProps {
  isOpen: boolean;
  sessionId: string;
  patientName: string;
  durationSeconds: number;
  clinicianId: string;
  onSuccess: () => void;
  onDismiss: () => void;
}

interface ServerValidationErrors {
  chief_complaint?: string;
  assessment?: string;
  plan?: string;
  disposition?: string;
}

/**
 * ReportModal
 *
 * Modal overlay that wraps ReportForm for end-session documentation.
 * Handles form submission, API calls, loading states, and error handling.
 *
 * Requirements:
 * - Wraps ReportForm in a modal overlay
 * - On submit constructs ReportPayload and POSTs to /api/v1/reports
 * - Shows loading state on submit button
 * - On HTTP 201 closes modal and fires success toast
 * - On HTTP 422 displays server field errors inside form without closing
 */
export function ReportModal({
  isOpen,
  sessionId,
  patientName,
  durationSeconds,
  clinicianId,
  onSuccess,
  onDismiss,
}: ReportModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState<ServerValidationErrors>({});
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { activePatient, patchActivePatient } = usePatientStore();
  const { addToast } = useToastStore();

  if (!isOpen) return null;

  const handleSubmit = async (formData: {
    chief_complaint: string;
    assessment: string;
    plan: string;
    disposition: Disposition;
  }) => {
    setIsSubmitting(true);
    setServerErrors({});

    try {
      const reportPayload: ReportPayload = {
        session_id: sessionId,
        clinician_id: clinicianId,
        chief_complaint: formData.chief_complaint,
        assessment: formData.assessment,
        plan: formData.plan,
        disposition: formData.disposition,
        duration_seconds: durationSeconds,
        submitted_at: new Date().toISOString(),
      };

      await post<{ report_id: string }>("/reports", reportPayload);

      if (activePatient) {
        patchActivePatient({
          status: "IDLE",
          session: {
            ...activePatient.session,
            active: false,
            ended_at: new Date().toISOString(),
          },
        });
      }

      addToast("Report submitted successfully", "success");
      onSuccess();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("422")) {
          try {
            const errorBody = error.message.split(": ")[1];
            if (errorBody) {
              const parsedErrors = JSON.parse(errorBody);
              setServerErrors(parsedErrors);
            }
          } catch {
            setServerErrors({
              chief_complaint:
                "Validation error occurred. Please check all fields.",
            });
          }
        } else {
          addToast("Failed to submit report. Please try again.", "error");
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleDismiss();
    }
  };

  const handleDismiss = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmGoBack = () => {
    setShowConfirmDialog(false);
  };

  const handleConfirmLeaveAnyway = () => {
    setShowConfirmDialog(false);
    onDismiss();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm"
        onClick={handleBackdropClick}
      >
        <div className="my-8 w-full max-w-2xl rounded-xl bg-white shadow-xl">
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">
              End Session Report
            </h2>
            <button
              onClick={handleDismiss}
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              aria-label="Close modal"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Report Form */}
          <div className="px-6 py-5">
            <ReportForm
              sessionId={sessionId}
              patientName={patientName}
              sessionStartedAt={new Date(
                Date.now() - durationSeconds * 1000
              ).toISOString()}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              validationErrors={serverErrors}
            />
          </div>
        </div>
      </div>

      {/* End Session Confirmation Dialog */}
      <EndSessionConfirmDialog
        isOpen={showConfirmDialog}
        onGoBack={handleConfirmGoBack}
        onLeaveAnyway={handleConfirmLeaveAnyway}
      />
    </>
  );
}
