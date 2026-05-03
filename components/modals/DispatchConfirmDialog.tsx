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
      // Construct DispatchRequest object
      const dispatchRequest: DispatchRequest = {
        session_id: sessionId,
        patient_id: patientId,
        reason: reason.trim(),
        address: fullAddress,
        requested_at: new Date().toISOString(),
      };

      // POST to /api/v1/dispatch
      await post("/dispatch", dispatchRequest);

      // Reset form state after successful dispatch
      setReason("");
      onSuccess();
    } catch (err) {
      console.error("Dispatch failed:", err);
      
      // Handle specific error cases
      if (err instanceof Error && err.message.includes("status 409")) {
        setError("Emergency services were already dispatched for this session");
        // Auto-close after 2 seconds for duplicate dispatch
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleCancel}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dispatch-dialog-title"
    >
      <div
        className="w-full max-w-md rounded-lg bg-slate-800 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-6">
          <h2
            id="dispatch-dialog-title"
            className="text-xl font-semibold text-slate-100"
          >
            Dispatch Emergency Services
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            This action will immediately contact emergency services for the patient.
          </p>
        </div>

        {/* Patient Information */}
        <div className="mb-6 rounded-lg bg-slate-700/50 p-4">
          <h3 className="mb-2 text-sm font-medium text-slate-300">
            Patient Information
          </h3>
          <div className="space-y-1">
            <p className="text-slate-100 font-medium">{patientName}</p>
            <p className="text-sm text-slate-300">{fullAddress}</p>
          </div>
        </div>

        {/* Reason for Dispatch */}
        <div className="mb-6">
          <label
            htmlFor="dispatch-reason"
            className="mb-2 block text-sm font-medium text-slate-300"
          >
            Reason for dispatch *
          </label>
          <textarea
            id="dispatch-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe the emergency situation requiring immediate medical attention..."
            className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-slate-100 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            rows={4}
            required
            disabled={isSubmitting}
          />
          <div className="mt-1 flex justify-between text-xs">
            <span
              className={`${
                reason.trim().length < DISPATCH_REASON_MIN_CHARS
                  ? "text-red-400"
                  : "text-green-400"
              }`}
            >
              {reason.trim().length < DISPATCH_REASON_MIN_CHARS
                ? `Minimum ${DISPATCH_REASON_MIN_CHARS} characters required`
                : "✓ Reason provided"}
            </span>
            <span className="text-slate-400">
              {reason.length} characters
            </span>
          </div>
          
          {/* Error message */}
          {error && (
            <div className="mt-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isReasonValid || isSubmitting}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-red-600"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                Dispatching...
              </span>
            ) : (
              "Confirm Dispatch"
            )}
          </button>
        </div>

        {/* Warning Notice */}
        <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3">
          <p className="text-xs text-red-300">
            ⚠️ This action cannot be undone. Emergency services will be contacted
            immediately with the patient's location and your provided reason.
          </p>
        </div>
      </div>
    </div>
  );
}