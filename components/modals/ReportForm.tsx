"use client";

import React, { useState } from "react";
import { formatDuration } from "@/lib/formatters";
import {
  CHIEF_COMPLAINT_MAX_CHARS,
  ASSESSMENT_MAX_CHARS,
  PLAN_MAX_CHARS,
} from "@/lib/constants";
import type { Disposition } from "@/types";

interface ReportFormProps {
  sessionId: string;
  patientName: string;
  sessionStartedAt: string;
  onSubmit: (formData: {
    chief_complaint: string;
    assessment: string;
    plan: string;
    disposition: Disposition;
  }) => void;
  isSubmitting?: boolean;
  validationErrors?: {
    chief_complaint?: string;
    assessment?: string;
    plan?: string;
    disposition?: string;
  };
}

/**
 * ReportForm
 *
 * Structured report form for end-of-session documentation.
 * Contains required fields with character limits and inline validation.
 *
 * Requirements:
 * - chief_complaint (textarea, max 500 chars, required)
 * - assessment (textarea, max 1000 chars, required)  
 * - plan (textarea, max 1000 chars, required)
 * - disposition (radio: "Resolved" / "Follow-up Required" / "Escalate to Emergency Services")
 * - Read-only header showing session_id, patient.name, and elapsed duration
 * - Inline validation errors on empty required fields
 * - Character counter on each textarea
 */
export function ReportForm({
  sessionId,
  patientName,
  sessionStartedAt,
  onSubmit,
  isSubmitting = false,
  validationErrors = {},
}: ReportFormProps) {
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");
  const [disposition, setDisposition] = useState<Disposition | "">("");

  // Local validation state
  const [localErrors, setLocalErrors] = useState<{
    chief_complaint?: string;
    assessment?: string;
    plan?: string;
    disposition?: string;
  }>({});

  const elapsedDuration = formatDuration(sessionStartedAt);

  const validateField = (field: string, value: string) => {
    const errors = { ...localErrors };
    
    switch (field) {
      case "chief_complaint":
        if (!value.trim()) {
          errors.chief_complaint = "Chief complaint is required";
        } else {
          delete errors.chief_complaint;
        }
        break;
      case "assessment":
        if (!value.trim()) {
          errors.assessment = "Assessment is required";
        } else {
          delete errors.assessment;
        }
        break;
      case "plan":
        if (!value.trim()) {
          errors.plan = "Plan is required";
        } else {
          delete errors.plan;
        }
        break;
      case "disposition":
        if (!value) {
          errors.disposition = "Disposition is required";
        } else {
          delete errors.disposition;
        }
        break;
    }
    
    setLocalErrors(errors);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields
    const errors: typeof localErrors = {};
    
    if (!chiefComplaint.trim()) {
      errors.chief_complaint = "Chief complaint is required";
    }
    if (!assessment.trim()) {
      errors.assessment = "Assessment is required";
    }
    if (!plan.trim()) {
      errors.plan = "Plan is required";
    }
    if (!disposition) {
      errors.disposition = "Disposition is required";
    }
    
    setLocalErrors(errors);
    
    // If there are validation errors, don't submit
    if (Object.keys(errors).length > 0) {
      return;
    }
    
    // Submit the form data
    onSubmit({
      chief_complaint: chiefComplaint.trim(),
      assessment: assessment.trim(),
      plan: plan.trim(),
      disposition: disposition as Disposition,
    });
  };

  // Combine local and server validation errors
  const getFieldError = (field: keyof typeof localErrors) => {
    return validationErrors[field] || localErrors[field];
  };

  const dispositionOptions = [
    { value: "resolved", label: "Resolved" },
    { value: "follow_up", label: "Follow-up Required" },
    { value: "escalated", label: "Escalate to Emergency Services" },
  ] as const;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Read-only Header */}
      <div className="rounded-lg bg-slate-700/50 p-4">
        <h3 className="mb-3 text-lg font-semibold text-slate-100">
          Session Report
        </h3>
        <div className="grid grid-cols-1 gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Session ID:</span>
            <span className="font-mono text-slate-200">{sessionId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Patient:</span>
            <span className="text-slate-200">{patientName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Duration:</span>
            <span className="text-slate-200">{elapsedDuration}</span>
          </div>
        </div>
      </div>

      {/* Chief Complaint */}
      <div>
        <label
          htmlFor="chief-complaint"
          className="mb-2 block text-sm font-medium text-slate-300"
        >
          Chief Complaint *
        </label>
        <textarea
          id="chief-complaint"
          value={chiefComplaint}
          onChange={(e) => {
            setChiefComplaint(e.target.value);
            validateField("chief_complaint", e.target.value);
          }}
          placeholder="Patient's primary concern or reason for the session..."
          className={`w-full rounded-lg border px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 ${
            getFieldError("chief_complaint")
              ? "border-red-500 bg-red-500/10 focus:border-red-500 focus:ring-red-500"
              : "border-slate-600 bg-slate-700 focus:border-blue-500 focus:ring-blue-500"
          }`}
          rows={3}
          maxLength={CHIEF_COMPLAINT_MAX_CHARS}
          disabled={isSubmitting}
          required
        />
        <div className="mt-1 flex justify-between text-xs">
          {getFieldError("chief_complaint") ? (
            <span className="text-red-400">
              {getFieldError("chief_complaint")}
            </span>
          ) : (
            <span></span>
          )}
          <span
            className={`${
              chiefComplaint.length > CHIEF_COMPLAINT_MAX_CHARS * 0.9
                ? "text-amber-400"
                : "text-slate-400"
            }`}
          >
            {chiefComplaint.length}/{CHIEF_COMPLAINT_MAX_CHARS}
          </span>
        </div>
      </div>

      {/* Assessment */}
      <div>
        <label
          htmlFor="assessment"
          className="mb-2 block text-sm font-medium text-slate-300"
        >
          Assessment *
        </label>
        <textarea
          id="assessment"
          value={assessment}
          onChange={(e) => {
            setAssessment(e.target.value);
            validateField("assessment", e.target.value);
          }}
          placeholder="Clinical assessment and observations..."
          className={`w-full rounded-lg border px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 ${
            getFieldError("assessment")
              ? "border-red-500 bg-red-500/10 focus:border-red-500 focus:ring-red-500"
              : "border-slate-600 bg-slate-700 focus:border-blue-500 focus:ring-blue-500"
          }`}
          rows={4}
          maxLength={ASSESSMENT_MAX_CHARS}
          disabled={isSubmitting}
          required
        />
        <div className="mt-1 flex justify-between text-xs">
          {getFieldError("assessment") ? (
            <span className="text-red-400">
              {getFieldError("assessment")}
            </span>
          ) : (
            <span></span>
          )}
          <span
            className={`${
              assessment.length > ASSESSMENT_MAX_CHARS * 0.9
                ? "text-amber-400"
                : "text-slate-400"
            }`}
          >
            {assessment.length}/{ASSESSMENT_MAX_CHARS}
          </span>
        </div>
      </div>

      {/* Plan */}
      <div>
        <label
          htmlFor="plan"
          className="mb-2 block text-sm font-medium text-slate-300"
        >
          Plan *
        </label>
        <textarea
          id="plan"
          value={plan}
          onChange={(e) => {
            setPlan(e.target.value);
            validateField("plan", e.target.value);
          }}
          placeholder="Treatment plan and next steps..."
          className={`w-full rounded-lg border px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 ${
            getFieldError("plan")
              ? "border-red-500 bg-red-500/10 focus:border-red-500 focus:ring-red-500"
              : "border-slate-600 bg-slate-700 focus:border-blue-500 focus:ring-blue-500"
          }`}
          rows={4}
          maxLength={PLAN_MAX_CHARS}
          disabled={isSubmitting}
          required
        />
        <div className="mt-1 flex justify-between text-xs">
          {getFieldError("plan") ? (
            <span className="text-red-400">
              {getFieldError("plan")}
            </span>
          ) : (
            <span></span>
          )}
          <span
            className={`${
              plan.length > PLAN_MAX_CHARS * 0.9
                ? "text-amber-400"
                : "text-slate-400"
            }`}
          >
            {plan.length}/{PLAN_MAX_CHARS}
          </span>
        </div>
      </div>

      {/* Disposition */}
      <div>
        <fieldset>
          <legend className="mb-3 text-sm font-medium text-slate-300">
            Disposition *
          </legend>
          <div className="space-y-2">
            {dispositionOptions.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-3 cursor-pointer"
              >
                <input
                  type="radio"
                  name="disposition"
                  value={option.value}
                  checked={disposition === option.value}
                  onChange={(e) => {
                    setDisposition(e.target.value as Disposition);
                    validateField("disposition", e.target.value);
                  }}
                  disabled={isSubmitting}
                  className="h-4 w-4 border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-800"
                />
                <span className="text-sm text-slate-200">{option.label}</span>
              </label>
            ))}
          </div>
          {getFieldError("disposition") && (
            <p className="mt-2 text-xs text-red-400">
              {getFieldError("disposition")}
            </p>
          )}
        </fieldset>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-blue-600"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              Submitting Report...
            </span>
          ) : (
            "Submit Report"
          )}
        </button>
      </div>
    </form>
  );
}