"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePatientStore } from "@/stores/patientStore";
import { get, post } from "@/lib/apiClient";
import { POLL_INTERVAL_MS } from "@/lib/constants";
import { PatientCard } from "@/components/dashboard/PatientCard";
import { EmptyState } from "@/components/dashboard/EmptyState";
import type { PatientRecord, PatientStatus } from "@/types";

/**
 * Dashboard page — main landing page for the Doctor Interface.
 *
 * Requirements:
 * - Req 1.2: Fetch and display list of PatientRecord objects from GET /api/v1/patients
 * - Req 1.4: Sort patients by status priority (HELP_TRIGGERED → IN_SESSION → ESCALATED → IDLE)
 * - Req 1.5: Join session on button click via POST /api/v1/patients/{id}/join
 * - Req 1.6: Display inline error on join failure
 * - Req 1.7: Refresh patient list every 10 seconds
 * - Req 1.8: Show "No patients on record" when list is empty
 */
export default function DashboardPage() {
  const router = useRouter();
  const { patients, setPatients } = usePatientStore();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joiningPatientId, setJoiningPatientId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<Record<string, string>>({});

  /**
   * Fetch the patient list from the API and update the store.
   */
  const fetchPatients = async () => {
    try {
      const patientList = await get<PatientRecord[]>("/patients");
      setPatients(patientList);
      setError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch patients";
      setError(message);
      console.error("Error fetching patients:", err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle "Join Session" button click.
   *
   * Task 2.6: Optimistically patch patientStore with status: IN_SESSION,
   * call POST /api/v1/patients/:id/join, then navigate to session page.
   *
   * Req 1.5: POST /api/v1/patients/{patient_id}/join with clinician_id
   * Req 1.6: Display inline error on failure
   */
  const handleJoinSession = async (patientId: string) => {
    setJoiningPatientId(patientId);
    setJoinError((prev) => {
      const updated = { ...prev };
      delete updated[patientId];
      return updated;
    });

    const patient = patients[patientId];
    if (!patient) {
      setJoinError((prev) => ({ ...prev, [patientId]: "Patient not found" }));
      setJoiningPatientId(null);
      return;
    }

    // Optimistic update: immediately update status to IN_SESSION
    const optimisticUpdate: PatientRecord = {
      ...patient,
      status: "IN_SESSION",
      session: {
        ...patient.session,
        active: true,
        started_at: new Date().toISOString(),
      },
      last_updated: new Date().toISOString(),
    };

    setPatients([
      ...Object.values(patients).map((p) =>
        p.patient_id === patientId ? optimisticUpdate : p
      ),
    ]);

    try {
      // POST to join endpoint
      const updatedPatient = await post<PatientRecord>(
        `/patients/${patientId}/join`,
        { clinician_id: "doc-456" } // TODO: Replace with actual clinician ID from auth context
      );

      // Update with server response
      setPatients([
        ...Object.values(patients).map((p) =>
          p.patient_id === patientId ? updatedPatient : p
        ),
      ]);

      // Navigate to session page
      router.push(`/sessions/${patientId}`);
    } catch (err) {
      // Revert optimistic update on error
      setPatients([
        ...Object.values(patients).map((p) =>
          p.patient_id === patientId ? patient : p
        ),
      ]);

      const message =
        err instanceof Error ? err.message : "Failed to join session";
      setJoinError((prev) => ({ ...prev, [patientId]: message }));
      console.error("Error joining session:", err);
    } finally {
      setJoiningPatientId(null);
    }
  };

  /**
   * Sort patients by status priority.
   *
   * Req 1.4: HELP_TRIGGERED → IN_SESSION → ESCALATED → IDLE,
   * ordered by last_updated ascending within each group.
   */
  const getSortedPatients = (): PatientRecord[] => {
    const statusPriority: Record<PatientStatus, number> = {
      HELP_TRIGGERED: 1,
      IN_SESSION: 2,
      ESCALATED: 3,
      IDLE: 4,
    };

    return Object.values(patients).sort((a, b) => {
      // First, sort by status priority
      const priorityDiff =
        statusPriority[a.status] - statusPriority[b.status];
      if (priorityDiff !== 0) return priorityDiff;

      // Within same status, sort by last_updated ascending (oldest first)
      return (
        new Date(a.last_updated).getTime() -
        new Date(b.last_updated).getTime()
      );
    });
  };

  // Initial fetch on mount
  useEffect(() => {
    fetchPatients();
  }, []);

  // Polling: refresh every POLL_INTERVAL_MS (10 seconds)
  // Req 1.7: Refresh without full page reload
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchPatients();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, []);

  const sortedPatients = getSortedPatients();
  const isEmpty = sortedPatients.length === 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top navigation bar */}
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                Patient Dashboard
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Monitor patient status and join active sessions
              </p>
            </div>
            {/* Live indicator */}
            <div className="flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 ring-1 ring-green-200">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Live
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-slate-500">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
              <span className="text-sm">Loading patients…</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-700">
              Failed to load patients
            </p>
            <p className="mt-1 text-sm text-red-600">{error}</p>
            <button
              onClick={fetchPatients}
              className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State — Req 1.8 */}
        {!isLoading && !error && isEmpty && <EmptyState />}

        {/* Patient Grid */}
        {!isLoading && !error && !isEmpty && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {sortedPatients.map((patient) => (
              <div key={patient.patient_id}>
                <PatientCard
                  patient={patient}
                  onJoinSession={handleJoinSession}
                  isJoining={joiningPatientId === patient.patient_id}
                />
                {/* Inline error display — Req 1.6 */}
                {joinError[patient.patient_id] && (
                  <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                    <p className="text-sm text-red-600">
                      {joinError[patient.patient_id]}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
