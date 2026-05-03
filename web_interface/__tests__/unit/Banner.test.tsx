import React from "react";
import { render, screen } from "@testing-library/react";
import { Banner } from "@/components/ui/Banner";

describe("Banner", () => {
  it("renders message correctly", () => {
    render(<Banner message="Test message" />);
    expect(screen.getByText("Test message")).toBeInTheDocument();
  });

  it("has role=alert for accessibility", () => {
    render(<Banner message="Test message" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("applies error variant styles correctly", () => {
    render(<Banner message="Emergency services have been dispatched" variant="error" />);
    const banner = screen.getByRole("alert");
    expect(banner).toHaveClass("bg-red-600/90", "border-red-500", "text-red-50");
  });

  it("applies info variant styles by default", () => {
    render(<Banner message="Info message" />);
    const banner = screen.getByRole("alert");
    expect(banner).toHaveClass("bg-blue-600/90", "border-blue-500", "text-blue-50");
  });

  it("applies custom className", () => {
    render(<Banner message="Test" className="custom-class" />);
    const banner = screen.getByRole("alert");
    expect(banner).toHaveClass("custom-class");
  });

  it("renders EMS dispatch message correctly", () => {
    render(
      <Banner 
        message="Emergency services have been dispatched" 
        variant="error" 
      />
    );
    expect(screen.getByText("Emergency services have been dispatched")).toBeInTheDocument();
  });
});