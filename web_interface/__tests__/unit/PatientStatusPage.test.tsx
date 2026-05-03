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

  it('displays "Help requested X ago" beneath status message when HELP_TRIGGERED and triggered_at is set', async () => {
    const mockPatient = createMockPatient('HELP_TRIGGERED');
    mockGet.mockResolvedValue(mockPatient);

    render(<PatientStatusPage patientId="pat-001" />);

    await waitFor(() => {
      // The secondary line should contain "Help requested" and a relative time
      const helpLine = screen.getByText(/^Help requested .+ ago$/);
      expect(helpLine).toBeInTheDocument();
    });
  });

  it('does not display "Help requested" line when status is not HELP_TRIGGERED', async () => {
    const mockPatient = createMockPatient('IDLE');
    mockGet.mockResolvedValue(mockPatient);

    render(<PatientStatusPage patientId="pat-001" />);

    await waitFor(() => {
      expect(screen.queryByText(/Help requested/)).not.toBeInTheDocument();
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

  // ── Background colour tests (Task 8.5) ──────────────────────────────────────

  it('applies neutral bg-slate-900 background for IDLE status', async () => {
    const mockPatient = createMockPatient('IDLE');
    mockGet.mockResolvedValue(mockPatient);

    const { container } = render(<PatientStatusPage patientId="pat-001" />);

    await waitFor(() => {
      expect(screen.getByText('No active session')).toBeInTheDocument();
    });

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('bg-slate-900');
  });

  it('applies amber bg-amber-950 background for HELP_TRIGGERED status', async () => {
    const mockPatient = createMockPatient('HELP_TRIGGERED');
    mockGet.mockResolvedValue(mockPatient);

    const { container } = render(<PatientStatusPage patientId="pat-001" />);

    await waitFor(() => {
      expect(screen.getByText('Help request received — connecting you to a clinician…')).toBeInTheDocument();
    });

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('bg-amber-950');
  });

  it('applies green bg-green-950 background for IN_SESSION status', async () => {
    const mockPatient = createMockPatient('IN_SESSION');
    mockGet.mockResolvedValue(mockPatient);

    const { container } = render(<PatientStatusPage patientId="pat-001" />);

    await waitFor(() => {
      expect(screen.getByText('A clinician is with you now')).toBeInTheDocument();
    });

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('bg-green-950');
  });

  it('applies red bg-red-950 background for ESCALATED status', async () => {
    const mockPatient = createMockPatient('ESCALATED');
    mockGet.mockResolvedValue(mockPatient);

    const { container } = render(<PatientStatusPage patientId="pat-001" />);

    await waitFor(() => {
      expect(screen.getByText('Emergency services have been contacted')).toBeInTheDocument();
    });

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('bg-red-950');
  });

  it('applies min-h-screen to the outermost wrapper so background covers full viewport', async () => {
    const mockPatient = createMockPatient('IDLE');
    mockGet.mockResolvedValue(mockPatient);

    const { container } = render(<PatientStatusPage patientId="pat-001" />);

    await waitFor(() => {
      expect(screen.getByText('No active session')).toBeInTheDocument();
    });

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('min-h-screen');
  });

  it('contains no robot controls, report form, or clinical data elements', async () => {
    const mockPatient = createMockPatient('IN_SESSION');
    mockGet.mockResolvedValue(mockPatient);

    render(<PatientStatusPage patientId="pat-001" />);

    await waitFor(() => {
      expect(screen.getByText('A clinician is with you now')).toBeInTheDocument();
    });

    // No robot control buttons
    expect(screen.queryByText(/left|right|up|down|stop/i)).not.toBeInTheDocument();
    // No report form fields
    expect(screen.queryByText(/chief complaint|assessment|plan|disposition/i)).not.toBeInTheDocument();
    // No clinical data labels
    expect(screen.queryByText(/battery|connection|session id/i)).not.toBeInTheDocument();
  });
});