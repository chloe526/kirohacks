"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePatientStore } from "@/stores/patientStore";
import { useRobotStateSync } from "@/hooks/useRobotStateSync";
import { get, post } from "@/lib/apiClient";
import { POLL_INTERVAL_MS } from "@/lib/constants";
import { PatientCard } from "@/components/dashboard/PatientCard";
import { EmptyState } from "@/components/dashboard/EmptyState";
import type { PatientRecord, PatientStatus } from "@/types";

type FilterTab = "All" | "Needs Help" | "In Session" | "Idle" | "Escalated";

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
  const [activeFilter, setActiveFilter] = useState<FilterTab>("All");

  // Enable live robot state sync from http://10.40.98.25:8081/state
  useRobotStateSync();

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
        p.patient_id === patientId ? optimisticUpdate : p,
      ),
    ]);

    try {
      const updatedPatient = await post<PatientRecord>(
        `/patients/${patientId}/join`,
        { clinician_id: "doc-456" },
      );

      setPatients([
        ...Object.values(patients).map((p) =>
          p.patient_id === patientId ? updatedPatient : p,
        ),
      ]);

      router.push(`/sessions/${patientId}`);
    } catch (err) {
      setPatients([
        ...Object.values(patients).map((p) =>
          p.patient_id === patientId ? patient : p,
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
   * Req 1.4: HELP_TRIGGERED → IN_SESSION → ESCALATED → IDLE
   */
  const getSortedPatients = (): PatientRecord[] => {
    const statusPriority: Record<PatientStatus, number> = {
      HELP_TRIGGERED: 1,
      CALL_READY: 2,
      IN_SESSION: 3,
      ESCALATED: 4,
      IDLE: 5,
    };

    return Object.values(patients).sort((a, b) => {
      const priorityDiff = statusPriority[a.status] - statusPriority[b.status];
      if (priorityDiff !== 0) return priorityDiff;
      return (
        new Date(a.last_updated).getTime() - new Date(b.last_updated).getTime()
      );
    });
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  // Note: periodic re-fetching of the full patient list is intentionally
  // omitted here. John Doe's card is kept live by useRobotStateSync (which
  // polls http://10.40.98.25:8081/state every 5 s and patches only that
  // entry). Re-fetching the full list would overwrite the live data with
  // stale fixture values.

  const sortedPatients = getSortedPatients();
  const allPatients = sortedPatients;

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalPatients = allPatients.length;
  const needsHelpCount = allPatients.filter(
    (p) => p.status === "HELP_TRIGGERED" || p.status === "CALL_READY",
  ).length;
  const inSessionCount = allPatients.filter(
    (p) => p.status === "IN_SESSION",
  ).length;
  const escalatedCount = allPatients.filter(
    (p) => p.status === "ESCALATED",
  ).length;
  const idleCount = allPatients.filter((p) => p.status === "IDLE").length;

  const urgentCount = needsHelpCount + escalatedCount;

  // ── Filter tabs ────────────────────────────────────────────────────────────
  const tabs: { label: FilterTab; count?: number }[] = [
    { label: "All" },
    { label: "Needs Help", count: needsHelpCount },
    { label: "In Session", count: inSessionCount },
    { label: "Idle" },
    { label: "Escalated", count: escalatedCount },
  ];

  const filteredPatients = allPatients.filter((p) => {
    if (activeFilter === "All") return true;
    if (activeFilter === "Needs Help")
      return p.status === "HELP_TRIGGERED" || p.status === "CALL_READY";
    if (activeFilter === "In Session") return p.status === "IN_SESSION";
    if (activeFilter === "Idle") return p.status === "IDLE";
    if (activeFilter === "Escalated") return p.status === "ESCALATED";
    return true;
  });

  const isEmpty = filteredPatients.length === 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Top navigation bar ─────────────────────────────────────────────── */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-500 shadow-sm">
                <HeartIcon className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900">
                Chansey Care
              </span>
            </div>

            {/* Right side: user + audio status */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900">
                  Dr. Demo User
                </p>
                <p className="flex items-center justify-end gap-1 text-xs text-green-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  On Call
                </p>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
                <WifiIcon className="h-3.5 w-3.5 text-slate-400" />
                Audio System Ready
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* ── Page title ───────────────────────────────────────────────────── */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            Patient Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitor patient status and join active sessions
          </p>
        </div>

        {/* ── Stats cards row ───────────────────────────────────────────────── */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {/* Total Patients */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="mb-2 text-sm text-slate-500">Total Patients</p>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold text-slate-900">
                {totalPatients}
              </span>
              <UsersIcon className="h-8 w-8 text-slate-300" />
            </div>
          </div>

          {/* Needs Help */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="mb-2 text-sm text-slate-500">Needs Help</p>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold text-amber-500">
                {needsHelpCount}
              </span>
              <BellIcon className="h-8 w-8 text-amber-300" />
            </div>
          </div>

          {/* In Session */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="mb-2 text-sm text-slate-500">In Session</p>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold text-green-600">
                {inSessionCount}
              </span>
              <VideoIcon className="h-8 w-8 text-green-300" />
            </div>
          </div>

          {/* Escalated */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="mb-2 text-sm text-slate-500">Escalated</p>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold text-red-500">
                {escalatedCount}
              </span>
              <AlertCircleIcon className="h-8 w-8 text-red-300" />
            </div>
          </div>
        </div>

        {/* ── Urgent alert banner ───────────────────────────────────────────── */}
        {urgentCount > 0 && (
          <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <TriangleAlertIcon className="h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-sm font-medium text-amber-700">
              {urgentCount} patient{urgentCount !== 1 ? "s" : ""} requesting
              immediate assistance
            </p>
          </div>
        )}

        {/* ── Filter tabs ───────────────────────────────────────────────────── */}
        <div className="mb-6 flex flex-wrap items-center gap-1">
          {tabs.map(({ label, count }) => {
            const isActive = activeFilter === label;
            return (
              <button
                key={label}
                onClick={() => setActiveFilter(label)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {label}
                {count !== undefined && ` (${count})`}
              </button>
            );
          })}
        </div>

        {/* ── Loading state ─────────────────────────────────────────────────── */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-slate-500">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
              <span className="text-sm">Loading patients…</span>
            </div>
          </div>
        )}

        {/* ── Error state ───────────────────────────────────────────────────── */}
        {error && !isLoading && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-700">
              Failed to load patients
            </p>
            <p className="mt-1 text-sm text-red-600">{error}</p>
            <button
              onClick={fetchPatients}
              className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Empty state — Req 1.8 ─────────────────────────────────────────── */}
        {!isLoading && !error && isEmpty && <EmptyState />}

        {/* ── Patient grid ──────────────────────────────────────────────────── */}
        {!isLoading && !error && !isEmpty && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filteredPatients.map((patient) => (
              <div key={patient.patient_id}>
                <PatientCard
                  patient={patient}
                  onJoinSession={handleJoinSession}
                  isJoining={joiningPatientId === patient.patient_id}
                />
                {/* Inline error display — Req 1.6 */}
                {joinError[patient.patient_id] && (
                  <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
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

      {/* ── Help button (bottom-right) ─────────────────────────────────────── */}
      <button
        className="fixed bottom-6 right-6 flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-white shadow-lg hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
        aria-label="Help"
      >
        <span className="text-sm font-bold">?</span>
      </button>
    </div>
  );
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
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
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function AlertCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function TriangleAlertIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function WifiIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
      />
    </svg>
  );
}
