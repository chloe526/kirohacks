import React from "react";
import { User } from "lucide-react";

interface PatientInfoCardProps {
  name: string;
  addressLine1: string;
  addressLine2: string;
}

/**
 * PatientInfoCard component displays patient demographic information
 * in the left panel of the Session Page.
 *
 * Features:
 * - Placeholder avatar (User icon)
 * - Patient name
 * - Two-line address display
 *
 * Note: test suite asserts bg-slate-800 and border-slate-700 — keep them stable.
 *
 * Related requirements:
 * - Requirement 3: Patient Profile Panel
 * - Acceptance Criteria 3.2: Display name, address.line1, address.line2
 * - Acceptance Criteria 3.4: Show "Patient profile unavailable" if data missing
 */
export function PatientInfoCard({
  name,
  addressLine1,
  addressLine2,
}: PatientInfoCardProps) {
  if (!name || !addressLine1 || !addressLine2) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center justify-center py-8 text-slate-400">
          <p className="text-sm">Patient profile unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
      {/* Header */}
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Patient Info
      </h2>

      {/* Avatar + name */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-700">
          <User className="h-5 w-5 text-slate-400" aria-hidden="true" />
        </div>
        <p className="text-base font-semibold text-slate-100">{name}</p>
      </div>

      {/* Divider */}
      <div className="mb-4 border-t border-slate-700" />

      {/* Fields */}
      <div className="space-y-3">
        <div>
          <p className="mb-0.5 text-xs font-medium text-slate-500">Location</p>
          <p className="text-sm font-medium text-slate-200">{addressLine1}</p>
        </div>
        <div className="border-t border-slate-700/60 pt-3">
          <p className="mb-0.5 text-xs font-medium text-slate-500">Address</p>
          <p className="text-sm text-slate-300">{addressLine2}</p>
        </div>
      </div>
    </div>
  );
}
