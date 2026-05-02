/**
 * EmptyState component displayed when no patients are on record.
 * 
 * Requirement 1.8: "WHEN the patient list is empty, THE Doctor_Interface
 * SHALL display a message reading 'No patients on record' in place of the
 * patient list."
 */
export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="text-center">
        <div className="text-slate-400 text-lg mb-2">
          No patients on record
        </div>
        <div className="text-slate-500 text-sm">
          Patient cards will appear here when available
        </div>
      </div>
    </div>
  );
}
