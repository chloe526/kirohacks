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
      // Construct ReportPayload
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

      // POST to /api/v1/reports
      await post<{ report_id: string }>("/reports", reportPayload);

      // On HTTP 201 success:
      // 1. Optimistically update patient status
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

      // 2. Show success toast
      addToast("Report submitted successfully", "success");

      // 3. Close modal and call success callback
      onSuccess();
    } catch (error) {
      if (error instanceof Error) {
        // Check if it's a 422 validation error
        if (error.message.includes("422")) {
          try {
            // Try to parse server validation errors from error message
            // This is a simplified approach - in a real app you'd have better error parsing
            const errorBody = error.message.split(": ")[1];
            if (errorBody) {
              const parsedErrors = JSON.parse(errorBody);
              setServerErrors(parsedErrors);
            }
          } catch {
            // If parsing fails, show generic error
            setServerErrors({
              chief_complaint: "Validation error occurred. Please check all fields.",
            });
          }
        } else {
          // Other errors - show generic message
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
    // Show confirmation dialog when trying to dismiss without submitting
    setShowConfirmDialog(true);
  };

  const handleConfirmGoBack = () => {
    // Return to report form
    setShowConfirmDialog(false);
  };

  const handleConfirmLeaveAnyway = () => {
    // Close both dialogs
    setShowConfirmDialog(false);
    onDismiss();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={handleBackdropClick}
      >
        <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-slate-800 p-6 shadow-xl">
          {/* Modal Header */}
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-100">
              End Session Report
            </h2>
            <button
              onClick={handleDismiss}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              aria-label="Close modal"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
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
          <ReportForm
            sessionId={sessionId}
            patientName={patientName}
            sessionStartedAt={new Date(Date.now() - durationSeconds * 1000).toISOString()}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            validationErrors={serverErrors}
          />
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