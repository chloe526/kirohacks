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
    // Fetch on mount
    fetchPatient();

    // Set up polling interval
    const interval = setInterval(fetchPatient, PATIENT_STATUS_POLL_MS);

    // Cleanup interval on unmount
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading patient status...</p>
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg mb-4">
            {error || 'Patient not found'}
          </p>
          <button
            onClick={fetchPatient}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${getBackgroundClass(patient.status)} p-8`}>
      <div className="max-w-2xl mx-auto text-center">
        {/* Greeting with first name */}
        <h1 className="text-3xl font-semibold text-slate-800 mb-8">
          Hello, {getFirstName(patient.name)}
        </h1>

        {/* Status message based on patient.status */}
        <div className="bg-white rounded-lg shadow-sm p-8">
          <p className="text-3xl font-medium text-slate-800 leading-relaxed">
            {getStatusMessage(patient.status)}
          </p>
          {patient.status === 'HELP_TRIGGERED' && patient.help_event.triggered_at != null && (
            <p className="text-lg text-slate-500 mt-3">
              Help requested {formatRelativeTime(patient.help_event.triggered_at)}
            </p>
          )}
          {patient.status === 'IN_SESSION' && patient.session.started_at != null && (
            <p className="text-lg text-slate-500 mt-3">
              Session in progress for {formatDuration(patient.session.started_at)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}