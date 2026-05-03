"use client";

import React, { useState } from "react";
import { DISPATCH_REASON_MIN_CHARS } from "@/lib/constants";
import { post } from "@/lib/apiClient";
import type { DispatchRequest } from "@/types";

interface DispatchConfirmDialogProps {
  isOpen: boolean;
  patientName: string;
  addressLine1: string;
  addressLine2: string;
  sessionId: string;
  patientId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * DispatchConfirmDialog
 *
 * Confirmation dialog for EMS dispatch. Shows patient info and requires
 * a reason with minimum character count before allowing confirmation.
 *
 * Requirements:
 * - Modal overlay showing patient.name and address
 * - Required "Reason for dispatch" textarea
 * - "Confirm Dispatch" button disabled until reason length ≥ DISPATCH_REASON_MIN_CHARS
 * - "Cancel" closes dialog without action
 */
export function DispatchConfirmDialog({
  isOpen,
  patientName,
  addressLine1,
  addressLine2,
  sessionId,
  patientId,
  onSuccess,
  onCancel,
}: DispatchConfirmDialogProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReasonValid = reason.trim().length >= DISPATCH_REASON_MIN_CHARS;
  const fullAddress = `${addressLine1}, ${addressLine2}`;

  const handleConfirm = async () => {
    if (!isReasonValid || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const dispatchRequest: DispatchRequest = {
        session_id: sessionId,
        patient_id: patientId,
        reason: reason.trim(),
        address: fullAddress,
        requested_at: new Date().toISOString(),
      };

      await post("/dispatch", dispatchRequest);

      setReason("");
      onSuccess();
    } catch (err) {
      console.error("Dispatch failed:", err);

      if (err instanceof Error && err.message.includes("status 409")) {
        setError("Emergency services were already dispatched for this session");
        setTimeout(() => {
          setReason("");
          setError(null);
          onCancel();
        }, 2000);
      } else {
        setError("Failed to dispatch emergency services. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setReason("");
    setError(null);
    onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={handleCancel}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dispatch-dialog-title"
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5">
          <h2
            id="dispatch-dialog-title"
            className="text-lg font-semibold text-slate-900"
          >
            Dispatch Emergency Services
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            This action will immediately contact emergency services for the
            patient.
          </p>
        </div>

        {/* Patient Information */}
        <div className="mb-5 rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
            Patient
          </p>
          <p className="font-medium text-slate-900">{patientName}</p>
          <p className="mt-0.5 text-sm text-slate-600">{fullAddress}</p>
        </div>

        {/* Reason for Dispatch */}
        <div className="mb-5">
          <label
            htmlFor="dispatch-reason"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Reason for dispatch{" "}
            <span className="text-red-500" aria-hidden="true">
              *
            </span>
          </label>
          <textarea
            id="dispatch-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe the emergency situation requiring immediate medical attention…"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-400"
            rows={4}
            required
            disabled={isSubmitting}
          />
          <div className="mt-1.5 flex justify-between text-xs">
            <span
              className={
                reason.trim().length < DISPATCH_REASON_MIN_CHARS
                  ? "text-slate-400"
                  : "text-green-600 font-medium"
              }
            >
              {reason.trim().length < DISPATCH_REASON_MIN_CHARS
                ? `Minimum ${DISPATCH_REASON_MIN_CHARS} characters required`
                : "✓ Reason provided"}
            </span>
            <span className="text-slate-400">{reason.length} characters</span>
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Warning Notice */}
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-700">
            This action cannot be undone. Emergency services will be contacted
            immediately with the patient&apos;s location and your provided reason.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            disabled={isSubmitting}
            className="flex-1 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isReasonValid || isSubmitting}
            className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Dispatching...
              </span>
            ) : (
              "Confirm Dispatch"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
