import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, beforeAll, afterEach, afterAll } from "vitest";
import { DispatchConfirmDialog } from "@/components/modals/DispatchConfirmDialog";
import { DISPATCH_REASON_MIN_CHARS } from "@/lib/constants";
import { server } from "@/mocks/server";
import { http, HttpResponse } from "msw";

describe("DispatchConfirmDialog", () => {
  const defaultProps = {
    isOpen: true,
    patientName: "John Doe",
    addressLine1: "1234 Imaginary Ave",
    addressLine2: "City State 12345",
    sessionId: "sess-xyz789",
    patientId: "pat-001",
    onSuccess: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders patient information correctly", () => {
    render(<DispatchConfirmDialog {...defaultProps} />);
    
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("1234 Imaginary Ave, City State 12345")).toBeInTheDocument();
  });

  it("disables confirm button when reason is too short", () => {
    render(<DispatchConfirmDialog {...defaultProps} />);
    
    const confirmButton = screen.getByText("Confirm Dispatch");
    const reasonTextarea = screen.getByLabelText(/reason for dispatch/i);
    
    // Initially disabled
    expect(confirmButton).toBeDisabled();
    
    // Still disabled with short reason
    fireEvent.change(reasonTextarea, { target: { value: "short" } });
    expect(confirmButton).toBeDisabled();
    
    // Shows minimum character requirement
    expect(screen.getByText(`Minimum ${DISPATCH_REASON_MIN_CHARS} characters required`)).toBeInTheDocument();
  });

  it("enables confirm button when reason meets minimum length", () => {
    render(<DispatchConfirmDialog {...defaultProps} />);
    
    const confirmButton = screen.getByText("Confirm Dispatch");
    const reasonTextarea = screen.getByLabelText(/reason for dispatch/i);
    
    // Enter valid reason
    const validReason = "Patient unresponsive, possible cardiac event requiring immediate attention";
    fireEvent.change(reasonTextarea, { target: { value: validReason } });
    
    expect(confirmButton).toBeEnabled();
    expect(screen.getByText("✓ Reason provided")).toBeInTheDocument();
  });

  it("calls onSuccess when dispatch is successful", async () => {
    const onSuccess = vi.fn();
    render(<DispatchConfirmDialog {...defaultProps} onSuccess={onSuccess} />);
    
    const confirmButton = screen.getByText("Confirm Dispatch");
    const reasonTextarea = screen.getByLabelText(/reason for dispatch/i);
    
    const validReason = "Patient unresponsive, possible cardiac event requiring immediate attention";
    fireEvent.change(reasonTextarea, { target: { value: validReason } });
    
    fireEvent.click(confirmButton);
    
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("calls onCancel when cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(<DispatchConfirmDialog {...defaultProps} onCancel={onCancel} />);
    
    const cancelButton = screen.getByText("Cancel");
    fireEvent.click(cancelButton);
    
    expect(onCancel).toHaveBeenCalled();
  });

  it("calls onCancel when escape key is pressed", () => {
    const onCancel = vi.fn();
    render(<DispatchConfirmDialog {...defaultProps} onCancel={onCancel} />);
    
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    
    expect(onCancel).toHaveBeenCalled();
  });

  it("does not render when isOpen is false", () => {
    render(<DispatchConfirmDialog {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByText("Dispatch Emergency Services")).not.toBeInTheDocument();
  });

  it("shows loading state during submission", async () => {
    const onConfirm = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    render(<DispatchConfirmDialog {...defaultProps} onConfirm={onConfirm} />);
    
    const confirmButton = screen.getByText("Confirm Dispatch");
    const reasonTextarea = screen.getByLabelText(/reason for dispatch/i);
    
    const validReason = "Patient unresponsive, possible cardiac event requiring immediate attention";
    fireEvent.change(reasonTextarea, { target: { value: validReason } });
    
    fireEvent.click(confirmButton);
    
    expect(screen.getByText("Dispatching...")).toBeInTheDocument();
    expect(confirmButton).toBeDisabled();
  });

  it("displays character count", () => {
    render(<DispatchConfirmDialog {...defaultProps} />);
    
    const reasonTextarea = screen.getByLabelText(/reason for dispatch/i);
    
    fireEvent.change(reasonTextarea, { target: { value: "test" } });
    
    expect(screen.getByText("4 characters")).toBeInTheDocument();
  });

  it("handles HTTP 409 duplicate dispatch error", async () => {
    // Mock a 409 response for duplicate dispatch
    server.use(
      http.post("/api/v1/dispatch", async () => {
        return HttpResponse.json(
          { error: "Emergency services were already dispatched for this session" },
          { status: 409 }
        );
      })
    );

    const onCancel = vi.fn();
    render(<DispatchConfirmDialog {...defaultProps} onCancel={onCancel} />);
    
    const confirmButton = screen.getByText("Confirm Dispatch");
    const reasonTextarea = screen.getByLabelText(/reason for dispatch/i);
    
    // Enter valid reason
    const validReason = "Patient unresponsive, possible cardiac event requiring immediate attention";
    fireEvent.change(reasonTextarea, { target: { value: validReason } });
    
    // Click confirm to trigger dispatch
    fireEvent.click(confirmButton);
    
    // Wait for error message to appear
    await waitFor(() => {
      expect(screen.getByText("Emergency services were already dispatched for this session")).toBeInTheDocument();
    });
    
    // Wait for auto-close after 2 seconds
    await waitFor(() => {
      expect(onCancel).toHaveBeenCalled();
    }, { timeout: 3000 });
  });
});