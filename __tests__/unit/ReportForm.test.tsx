import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ReportForm } from "@/components/modals/ReportForm";

describe("ReportForm", () => {
  const defaultProps = {
    sessionId: "sess-123",
    patientName: "John Doe",
    sessionStartedAt: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
    onSubmit: vi.fn(),
  };

  it("renders all required fields", () => {
    render(<ReportForm {...defaultProps} />);

    // Check header information
    expect(screen.getByText("Session Report")).toBeInTheDocument();
    expect(screen.getByText("sess-123")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText(/5 minutes/)).toBeInTheDocument();

    // Check form fields
    expect(screen.getByLabelText(/Chief Complaint/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Assessment/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Plan/)).toBeInTheDocument();
    expect(screen.getByText("Disposition *")).toBeInTheDocument();

    // Check disposition options
    expect(screen.getByLabelText("Resolved")).toBeInTheDocument();
    expect(screen.getByLabelText("Follow-up Required")).toBeInTheDocument();
    expect(screen.getByLabelText("Escalate to Emergency Services")).toBeInTheDocument();

    // Check submit button
    expect(screen.getByRole("button", { name: "Submit Report" })).toBeInTheDocument();
  });

  it("shows character counters for text areas", () => {
    render(<ReportForm {...defaultProps} />);

    // Check initial character counters
    expect(screen.getByText("0/500")).toBeInTheDocument(); // Chief complaint
    expect(screen.getAllByText("0/1000")).toHaveLength(2); // Assessment and Plan both have 1000 char limit
  });

  it("updates character counters when typing", () => {
    render(<ReportForm {...defaultProps} />);

    const chiefComplaintField = screen.getByLabelText(/Chief Complaint/);
    fireEvent.change(chiefComplaintField, { target: { value: "Test complaint" } });

    expect(screen.getByText("14/500")).toBeInTheDocument();
  });

  it("shows validation errors for empty required fields", () => {
    const onSubmit = vi.fn();
    render(<ReportForm {...defaultProps} onSubmit={onSubmit} />);

    const form = document.querySelector("form")!;
    
    // Submit the form without filling any fields
    fireEvent.submit(form);

    // Check that onSubmit was not called due to validation errors
    expect(onSubmit).not.toHaveBeenCalled();
    
    // Check that validation errors appear
    expect(screen.getByText("Chief complaint is required")).toBeInTheDocument();
    expect(screen.getByText("Assessment is required")).toBeInTheDocument();
    expect(screen.getByText("Plan is required")).toBeInTheDocument();
    expect(screen.getByText("Disposition is required")).toBeInTheDocument();
  });

  it("submits form with valid data", async () => {
    const onSubmit = vi.fn();
    render(<ReportForm {...defaultProps} onSubmit={onSubmit} />);

    // Fill in all required fields
    fireEvent.change(screen.getByLabelText(/Chief Complaint/), {
      target: { value: "Patient reported dizziness" },
    });
    fireEvent.change(screen.getByLabelText(/Assessment/), {
      target: { value: "Likely orthostatic hypotension" },
    });
    fireEvent.change(screen.getByLabelText(/Plan/), {
      target: { value: "Advised patient to sit and hydrate" },
    });
    fireEvent.click(screen.getByLabelText("Resolved"));

    // Submit the form
    fireEvent.click(screen.getByRole("button", { name: "Submit Report" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        chief_complaint: "Patient reported dizziness",
        assessment: "Likely orthostatic hypotension",
        plan: "Advised patient to sit and hydrate",
        disposition: "resolved",
      });
    });
  });

  it("displays server validation errors", () => {
    const validationErrors = {
      chief_complaint: "Chief complaint is too short",
      assessment: "Assessment is required",
    };

    render(
      <ReportForm {...defaultProps} validationErrors={validationErrors} />
    );

    expect(screen.getByText("Chief complaint is too short")).toBeInTheDocument();
    expect(screen.getByText("Assessment is required")).toBeInTheDocument();
  });

  it("shows loading state when submitting", () => {
    render(<ReportForm {...defaultProps} isSubmitting={true} />);

    expect(screen.getByText("Submitting Report...")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("enforces character limits", () => {
    render(<ReportForm {...defaultProps} />);

    const chiefComplaintField = screen.getByLabelText(/Chief Complaint/) as HTMLTextAreaElement;
    
    // Try to enter more than 500 characters - but maxLength attribute should prevent this
    const longText = "a".repeat(600);
    fireEvent.change(chiefComplaintField, { target: { value: longText } });

    // The maxLength attribute should prevent entering more than 500 characters
    // But in jsdom, maxLength might not be enforced, so we check that our component handles it
    expect(chiefComplaintField.getAttribute('maxlength')).toBe('500');
  });
});