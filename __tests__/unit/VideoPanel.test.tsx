import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VideoPanel } from "@/components/session/VideoPanel";

describe("VideoPanel", () => {
  it("renders placeholder text and patient name", () => {
    render(
      <VideoPanel patientName="John Doe" robotConnection="online" />
    );

    expect(
      screen.getByText("Live video feed — not yet connected")
    ).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("shows 'Live' badge when robot is online", () => {
    render(
      <VideoPanel patientName="Jane Smith" robotConnection="online" />
    );

    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("shows 'Disconnected' badge when robot is offline", () => {
    render(
      <VideoPanel patientName="Jane Smith" robotConnection="offline" />
    );

    expect(screen.getByText("Disconnected")).toBeInTheDocument();
  });

  it("renders camera icon", () => {
    const { container } = render(
      <VideoPanel patientName="John Doe" robotConnection="online" />
    );

    // Lucide icons render as SVG elements
    const cameraIcon = container.querySelector('svg');
    expect(cameraIcon).toBeInTheDocument();
  });

  it("applies correct styling for online connection", () => {
    render(
      <VideoPanel patientName="John Doe" robotConnection="online" />
    );

    const badge = screen.getByText("Live").closest("div");
    expect(badge).toHaveClass("bg-green-500/20", "text-green-400");
  });

  it("applies correct styling for offline connection", () => {
    render(
      <VideoPanel patientName="John Doe" robotConnection="offline" />
    );

    const badge = screen.getByText("Disconnected").closest("div");
    expect(badge).toHaveClass("bg-red-500/20", "text-red-400");
  });
});
