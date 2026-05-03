import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PatientStatusPage from '@/components/patient/PatientStatusPage';
import { PatientRecord } from '@/types';
import * as apiClient from '@/lib/apiClient';

// Mock the API client
vi.mock('@/lib/apiClient');
const mockGet = vi.mocked(apiClient.get);

// Mock patient data for different statuses
const createMockPatient = (status: PatientRecord['status']): PatientRecord => ({
  patient_id: 'pat-001',
  name: 'John Doe',
  address: {
    line1: '123 Main St',
    line2: 'City, State 12345'
  },
  status,
  last_updated: '2024-01-01T12:00:00Z',
  help_event: {
    triggered_at: status === 'HELP_TRIGGERED' ? '2024-01-01T11:55:00Z' : null
  },
  robot: {
    connection: 'online',
    battery: 85,
    last_command: 'stop',
    last_command_at: '2024-01-01T11:50:00Z'
  },
  session: {
    session_id: status === 'IN_SESSION' ? 'sess-123' : null,
    active: status === 'IN_SESSION',
    started_at: status === 'IN_SESSION' ? '2024-01-01T11:58:00Z' : null,
    ended_at: null
  }
});

describe('PatientStatusPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays correct status message for IDLE status', async () => {
    const mockPatient = createMockPatient('IDLE');
    mockGet.mockResolvedValue(mockPatient);

    render(<PatientStatusPage patientId="pat-001" />);

    await waitFor(() => {
      expect(screen.getByText('Hello, John')).toBeInTheDocument();
      expect(screen.getByText('No active session')).toBeInTheDocument();
    });
  });

  it('displays correct status message for HELP_TRIGGERED status', async () => {
    const mockPatient = createMockPatient('HELP_TRIGGERED');
    mockGet.mockResolvedValue(mockPatient);

    render(<PatientStatusPage patientId="pat-001" />);

    await waitFor(() => {
      expect(screen.getByText('Hello, John')).toBeInTheDocument();
      expect(screen.getByText('Help request received — connecting you to a clinician…')).toBeInTheDocument();
    });
  });

  it('displays correct status message for IN_SESSION status', async () => {
    const mockPatient = createMockPatient('IN_SESSION');
    mockGet.mockResolvedValue(mockPatient);

    render(<PatientStatusPage patientId="pat-001" />);

    await waitFor(() => {
      expect(screen.getByText('Hello, John')).toBeInTheDocument();
      expect(screen.getByText('A clinician is with you now')).toBeInTheDocument();
    });
  });

  it('displays correct status message for ESCALATED status', async () => {
    const mockPatient = createMockPatient('ESCALATED');
    mockGet.mockResolvedValue(mockPatient);

    render(<PatientStatusPage patientId="pat-001" />);

    await waitFor(() => {
      expect(screen.getByText('Hello, John')).toBeInTheDocument();
      expect(screen.getByText('Emergency services have been contacted')).toBeInTheDocument();
    });
  });

  it('extracts first name correctly from full name', async () => {
    const mockPatient = createMockPatient('IDLE');
    mockPatient.name = 'Jane Mary Smith';
    mockGet.mockResolvedValue(mockPatient);

    render(<PatientStatusPage patientId="pat-001" />);

    await waitFor(() => {
      expect(screen.getByText('Hello, Jane')).toBeInTheDocument();
    });
  });

  it('uses minimum 24px font size for status message', async () => {
    const mockPatient = createMockPatient('IDLE');
    mockGet.mockResolvedValue(mockPatient);

    render(<PatientStatusPage patientId="pat-001" />);

    await waitFor(() => {
      const statusMessage = screen.getByText('No active session');
      expect(statusMessage).toHaveClass('text-3xl'); // text-3xl is 30px, which is >= 24px
    });
  });
});