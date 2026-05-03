/**
 * EmptyState component displayed when no patients are on record.
 *
 * Requirement 1.8: "WHEN the patient list is empty, THE Doctor_Interface
 * SHALL display a message reading 'No patients on record' in place of the
 * patient list."
 */
export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      {/* Icon placeholder */}
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
        <svg
          className="h-7 w-7 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </div>
      <p className="text-base font-medium text-slate-600">
        No patients on record
      </p>
      <p className="mt-1 text-sm text-slate-400">
        Patient cards will appear here when available
      </p>
    </div>
  );
}
