import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReportModal } from "@/components/modals/ReportModal";
import * as apiClient from "@/lib/apiClient";

// Mock the API client
vi.mock("@/lib/apiClient", () => ({
  post: vi.fn(),
}));

// Mock the patient store
const mockPatchActivePatient = vi.fn();
vi.mock("@/stores/patientStore", () => ({
  usePatientStore: () => ({
    activePatient: {
      patient_id: "pat-001",
      session: {
        session_id: "sess-123",
        active: true,
        started_at: "2024-01-15T10:30:00Z",
        ended_at: null,
      },
    },
    patchActivePatient: mockPatchActivePatient,
  }),
}));

// Mock the toast store
const mockAddToast = vi.fn();
vi.mock("@/stores/toastStore", () => ({
  useToastStore: () => ({
    addToast: mockAddToast,
  }),
}));

describe("ReportModal", () => {
  const defaultProps = {
    isOpen: true,
    sessionId: "sess-123",
    patientName: "John Doe",
    durationSeconds: 420,
    clinicianId: "doc-456",
    onSuccess: vi.fn(),
    onDismiss: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders modal when open", () => {
    render(<ReportModal {...defaultProps} />);
    
    expect(screen.getByText("End Session Report")).toBeInTheDocument();
    expect(screen.getByText("Session Report")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("sess-123")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(<ReportModal {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByText("End Session Report")).not.toBeInTheDocument();
  });

  it("shows confirmation dialog when close button is clicked", () => {
    const onDismiss = vi.fn();
    render(<ReportModal {...defaultProps} onDismiss={onDismiss} />);
    
    const closeButton = screen.getByLabelText("Close modal");
    fireEvent.click(closeButton);
    
    // Should show confirmation dialog instead of calling onDismiss directly
    expect(screen.getByText("Are you sure? The session will remain open until a report is submitted.")).toBeInTheDocument();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("shows confirmation dialog when backdrop is clicked", () => {
    const onDismiss = vi.fn();
    render(<ReportModal {...defaultProps} onDismiss={onDismiss} />);
    
    // Click on the backdrop (the outer div with the backdrop click handler)
    const backdrop = screen.getByText("End Session Report").closest('[class*="fixed inset-0"]');
    fireEvent.click(backdrop!);
    
    // Should show confirmation dialog instead of calling onDismiss directly
    expect(screen.getByText("Are you sure? The session will remain open until a report is submitted.")).toBeInTheDocument();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("submits report successfully", async () => {
    const mockPost = vi.mocked(apiClient.post);
    mockPost.mockResolvedValue({ report_id: "rep-001" });
    
    const onSuccess = vi.fn();
    render(<ReportModal {...defaultProps} onSuccess={onSuccess} />);
    
    // Fill out the form
    fireEvent.change(screen.getByLabelText(/chief complaint/i), {
      target: { value: "Patient reported dizziness" },
    });
    fireEvent.change(screen.getByLabelText(/assessment/i), {
      target: { value: "Likely orthostatic hypotension" },
    });
    fireEvent.change(screen.getByLabelText(/plan/i), {
      target: { value: "Advised patient to sit and hydrate" },
    });
    fireEvent.click(screen.getByLabelText("Resolved"));
    
    // Submit the form
    fireEvent.click(screen.getByText("Submit Report"));
    
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/reports", {
        session_id: "sess-123",
        clinician_id: "doc-456",
        chief_complaint: "Patient reported dizziness",
        assessment: "Likely orthostatic hypotension",
        plan: "Advised patient to sit and hydrate",
        disposition: "resolved",
        duration_seconds: 420,
        submitted_at: expect.any(String),
      });
    });
    
    await waitFor(() => {
      expect(mockPatchActivePatient).toHaveBeenCalledWith({
        status: "IDLE",
        session: {
          session_id: "sess-123",
          active: false,
          started_at: "2024-01-15T10:30:00Z",
          ended_at: expect.any(String),
        },
      });
    });
    
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });

    // Should show success toast
    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith("Report submitted successfully", "success");
    });
  });

  it("handles API errors gracefully", async () => {
    const mockPost = vi.mocked(apiClient.post);
    mockPost.mockRejectedValue(new Error("API request failed with status 500"));
    
    render(<ReportModal {...defaultProps} />);
    
    // Fill out and submit the form
    fireEvent.change(screen.getByLabelText(/chief complaint/i), {
      target: { value: "Test complaint" },
    });
    fireEvent.change(screen.getByLabelText(/assessment/i), {
      target: { value: "Test assessment" },
    });
    fireEvent.change(screen.getByLabelText(/plan/i), {
      target: { value: "Test plan" },
    });
    fireEvent.click(screen.getByLabelText("Resolved"));
    fireEvent.click(screen.getByText("Submit Report"));
    
    // Should not call onSuccess on error
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalled();
    });
    
    // Modal should remain open
    expect(screen.getByText("End Session Report")).toBeInTheDocument();
  });

  it("shows loading state during submission", async () => {
    const mockPost = vi.mocked(apiClient.post);
    mockPost.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<ReportModal {...defaultProps} />);
    
    // Fill out and submit the form
    fireEvent.change(screen.getByLabelText(/chief complaint/i), {
      target: { value: "Test complaint" },
    });
    fireEvent.change(screen.getByLabelText(/assessment/i), {
      target: { value: "Test assessment" },
    });
    fireEvent.change(screen.getByLabelText(/plan/i), {
      target: { value: "Test plan" },
    });
    fireEvent.click(screen.getByLabelText("Resolved"));
    fireEvent.click(screen.getByText("Submit Report"));
    
    // Should show loading state
    expect(screen.getByText("Submitting Report...")).toBeInTheDocument();
  });
});