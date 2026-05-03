import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Toast } from "@/components/ui/Toast";

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("renders success toast with correct styling and icon", () => {
    render(
      <Toast 
        message="Operation completed successfully" 
        variant="success" 
      />
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Operation completed successfully")).toBeInTheDocument();
    
    // Check for success styling classes
    const toast = screen.getByRole("alert");
    expect(toast).toHaveClass("bg-green-600/95", "border-green-500", "text-green-50");
    
    // Check for CheckCircle icon (success variant)
    expect(toast.querySelector("svg")).toBeInTheDocument();
  });

  it("renders error toast with correct styling and icon", () => {
    render(
      <Toast 
        message="An error occurred" 
        variant="error" 
      />
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("An error occurred")).toBeInTheDocument();
    
    // Check for error styling classes
    const toast = screen.getByRole("alert");
    expect(toast).toHaveClass("bg-red-600/95", "border-red-500", "text-red-50");
  });

  it("auto-dismisses after 3 seconds", () => {
    const onDismiss = vi.fn();
    
    render(
      <Toast 
        message="Test message" 
        variant="success" 
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    
    // Fast-forward 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    
    // Wait for animation to complete (300ms)
    act(() => {
      vi.advanceTimersByTime(300);
    });
    
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("can be manually dismissed with close button", () => {
    const onDismiss = vi.fn();
    
    render(
      <Toast 
        message="Test message" 
        variant="success" 
        onDismiss={onDismiss}
      />
    );

    const closeButton = screen.getByRole("button", { name: /dismiss notification/i });
    expect(closeButton).toBeInTheDocument();
    
    act(() => {
      fireEvent.click(closeButton);
    });
    
    // Wait for animation to complete
    act(() => {
      vi.advanceTimersByTime(300);
    });
    
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("has proper accessibility attributes", () => {
    render(
      <Toast 
        message="Accessible toast" 
        variant="success" 
      />
    );

    const toast = screen.getByRole("alert");
    expect(toast).toHaveAttribute("aria-live", "polite");
    expect(toast).toHaveAttribute("aria-atomic", "true");
    
    const closeButton = screen.getByRole("button", { name: /dismiss notification/i });
    expect(closeButton).toHaveAttribute("aria-label", "Dismiss notification");
  });

  it("handles long messages with proper text wrapping", () => {
    const longMessage = "This is a very long message that should wrap properly within the toast container without breaking the layout or causing overflow issues.";
    
    render(
      <Toast 
        message={longMessage} 
        variant="error" 
      />
    );

    expect(screen.getByText(longMessage)).toBeInTheDocument();
    
    const messageElement = screen.getByText(longMessage);
    expect(messageElement).toHaveClass("break-words");
  });

  it("is positioned at top-right with proper z-index", () => {
    render(
      <Toast 
        message="Positioned toast" 
        variant="success" 
      />
    );

    const toast = screen.getByRole("alert");
    expect(toast).toHaveClass("fixed", "top-4", "right-4", "z-50");
  });
});