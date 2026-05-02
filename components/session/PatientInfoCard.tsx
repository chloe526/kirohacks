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
 * Design notes:
 * - Renders as a card with dark background (slate-800)
 * - Uses consistent spacing and typography with other session components
 * - Gracefully handles null/undefined values by showing fallback message
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
  // If any required field is missing, show unavailable message
  if (!name || !addressLine1 || !addressLine2) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center justify-center text-slate-400 py-8">
          <p className="text-sm">Patient profile unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      {/* Placeholder Avatar */}
      <div className="flex justify-center mb-4">
        <div className="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center">
          <User className="w-10 h-10 text-slate-400" aria-hidden="true" />
        </div>
      </div>

      {/* Patient Name */}
      <h2 className="text-xl font-semibold text-slate-100 text-center mb-4">
        {name}
      </h2>

      {/* Address */}
      <div className="space-y-1 text-center">
        <p className="text-sm text-slate-300">{addressLine1}</p>
        <p className="text-sm text-slate-300">{addressLine2}</p>
      </div>
    </div>
  );
}
