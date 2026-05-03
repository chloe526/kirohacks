'use client';

import React from 'react';
import { useEffect, useState } from 'react';
import { PatientRecord } from '@/types';
import { get } from '@/lib/apiClient';
import { PATIENT_STATUS_POLL_MS } from '@/lib/constants';

interface PatientStatusPageProps {
  patientId: string;
}

export default function PatientStatusPage({ patientId }: PatientStatusPageProps) {
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Extract first name from full name
  const getFirstName = (fullName: string): string => {
    return fullName.split(' ')[0];
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
    <div className="min-h-screen bg-slate-50 p-8">
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
        </div>
      </div>
    </div>
  );
}