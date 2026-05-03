"use client";

import React from "react";

interface EndSessionConfirmDialogProps {
  isOpen: boolean;
  onGoBack: () => void;
  onLeaveAnyway: () => void;
}

/**
 * EndSessionConfirmDialog
 *
 * Confirmation dialog shown when clinician dismisses the report modal without submitting.
 * Warns that the session will remain open until a report is submitted.
 *
 * Requirements:
 * - Shown when clinician dismisses report modal without submitting
 * - Message: "Are you sure? The session will remain open until a report is submitted."
 * - "Go Back" returns to report form
 * - "Leave Anyway" closes both dialogs
 */
export function EndSessionConfirmDialog({
  isOpen,
  onGoBack,
  onLeaveAnyway,
}: EndSessionConfirmDialogProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onGoBack();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onGoBack}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-session-dialog-title"
    >
      <div
        className="w-full max-w-md rounded-lg bg-slate-800 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-6">
          <h2
            id="end-session-dialog-title"
            className="text-xl font-semibold text-slate-100"
          >
            Confirm Leave Session
          </h2>
        </div>

        {/* Warning Message */}
        <div className="mb-6">
          <p className="text-slate-300 leading-relaxed">
            Are you sure? The session will remain open until a report is submitted.
          </p>
        </div>

        {/* Warning Notice */}
        <div className="mb-6 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
          <p className="text-sm text-amber-300">
            ⚠️ Without a report, this session cannot be properly closed and will
            continue to appear as active in the system.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onGoBack}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800"
          >
            Go Back
          </button>
          <button
            onClick={onLeaveAnyway}
            className="flex-1 rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-800"
          >
            Leave Anyway
          </button>
        </div>
      </div>
    </div>
  );
}