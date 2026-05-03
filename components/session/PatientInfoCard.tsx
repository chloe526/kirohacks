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
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      {/* Avatar placeholder */}
      <div className="mb-4 flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-700">
          <User className="h-8 w-8 text-slate-400" aria-hidden="true" />
        </div>
      </div>

      {/* Patient Name */}
      <h2 className="mb-1 text-center text-xl font-semibold text-slate-100">
        {name}
      </h2>

      {/* Divider */}
      <div className="my-3 border-t border-slate-700" />

      {/* Address */}
      <div className="space-y-0.5 text-center">
        <p className="text-sm text-slate-300">{addressLine1}</p>
        <p className="text-sm text-slate-400">{addressLine2}</p>
      </div>
    </div>
  );
}
