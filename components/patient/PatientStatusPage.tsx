'use client';

import React from 'react';
import { useEffect, useState } from 'react';
import { PatientRecord } from '@/types';
import { get } from '@/lib/apiClient';
import { PATIENT_STATUS_POLL_MS } from '@/lib/constants';
import { formatRelativeTime, formatDuration } from '@/lib/formatters';

interface PatientStatusPageProps {
  patientId: string;
}

export default function PatientStatusPage({ patientId }: PatientStatusPageProps) {
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Tick counter to force a re-render every second when help timer is active
  const [, setTick] = useState(0);

  const fetchPatient = async () => {
    try {
      const patientRecord = await get<PatientRecord>(`/patients/${patientId}`);
      setPatient(patientRecord);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch patient:', err);
      setError(err instanceof Error ? err.message : 'Failed to load patient data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPatient();

    const interval = setInterval(fetchPatient, PATIENT_STATUS_POLL_MS);
    return () => clearInterval(interval);
  }, [patientId]);

  // 1-second tick to keep the "Help requested X ago" and "Session in progress for X" counters current
  useEffect(() => {
    const isHelpActive =
      patient?.status === 'HELP_TRIGGERED' &&
      patient?.help_event?.triggered_at != null;

    const isSessionActive =
      patient?.status === 'IN_SESSION' &&
      patient?.session?.started_at != null;

    if (!isHelpActive && !isSessionActive) return;

    const tickInterval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => clearInterval(tickInterval);
  }, [patient?.status, patient?.help_event?.triggered_at, patient?.session?.started_at]);

  // Extract first name from full name
  const getFirstName = (fullName: string): string => {
    return fullName.split(' ')[0];
  };

  // Get full-page background colour class based on patient status (Req 8.5)
  // Note: test suite asserts these exact class names — keep them stable.
  const getBackgroundClass = (status: PatientRecord['status']): string => {
    switch (status) {
      case 'IDLE':
        return 'bg-slate-900';
      case 'HELP_TRIGGERED':
        return 'bg-amber-950';
      case 'IN_SESSION':
        return 'bg-green-950';
      case 'ESCALATED':
        return 'bg-red-950';
      default:
        return 'bg-slate-900';
    }
  };

  // Get status message based on patient status
  const getStatusMessage = (status: PatientRecord['status']): string => {
    switch (status) {
      case 'IDLE':
        return 'No active session';
      case 'HELP_TRIGGERED':
        return 'Help request received — connecting you to a clinician…';
      case 'IN_SESSION':
        return 'A clinician is with you now';
      case 'ESCALATED':
        return 'Emergency services have been contacted';
      default:
        return 'Status unknown';
    }
  };

  // Get accent color for the status card border
  const getStatusAccent = (status: PatientRecord['status']): string => {
    switch (status) {
      case 'IDLE':
        return 'border-slate-200';
      case 'HELP_TRIGGERED':
        return 'border-amber-300';
      case 'IN_SESSION':
        return 'border-green-300';
      case 'ESCALATED':
        return 'border-red-300';
      default:
        return 'border-slate-200';
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
          <p className="text-sm text-slate-500">Loading patient status…</p>
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-lg border border-red-200 bg-white p-8 text-center shadow-sm">
          <p className="mb-4 text-base font-medium text-red-600">
            {error || 'Patient not found'}
          </p>
          <button
            onClick={fetchPatient}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${getBackgroundClass(patient.status)} px-4 py-12`}>
      <div className="mx-auto max-w-lg text-center">
        {/* Greeting with first name */}
        <h1 className="mb-8 text-3xl font-semibold text-slate-100">
          Hello, {getFirstName(patient.name)}
        </h1>

        {/* Status card */}
        <div
          className={`rounded-xl border-2 bg-white px-8 py-10 shadow-sm ${getStatusAccent(
            patient.status
          )}`}
        >
          <p className="text-3xl font-medium leading-snug text-slate-800">
            {getStatusMessage(patient.status)}
          </p>

          {patient.status === 'HELP_TRIGGERED' &&
            patient.help_event.triggered_at != null && (
              <p className="mt-4 text-base text-slate-500">
                Help requested{' '}
                {formatRelativeTime(patient.help_event.triggered_at)}
              </p>
            )}

          {patient.status === 'IN_SESSION' &&
            patient.session.started_at != null && (
              <p className="mt-4 text-base text-slate-500">
                Session in progress for{' '}
                {formatDuration(patient.session.started_at)}
              </p>
            )}
        </div>
      </div>
    </div>
  );
}
