import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VideoPanel } from "@/components/session/VideoPanel";

// Mock the useAudioSocket hook
vi.mock("@/hooks/useAudioSocket", () => ({
  useAudioSocket: vi.fn(() => ({
    connectionState: "connected",
    isMuted: false,
    toggleMute: vi.fn(),
    reconnectCount: 0,
  })),
}));

describe("VideoPanel", () => {
  const defaultProps = {
    patientName: "John Doe",
    robotConnection: "online" as const,
    sessionId: "sess-123",
    sessionActive: true,
  };

  beforeEach(() => {
    // Reset environment variable for each test
    delete process.env.NEXT_PUBLIC_USE_MOCK_API;
  });

  it("renders placeholder text and patient name", () => {
    render(<VideoPanel {...defaultProps} />);

    expect(
      screen.getByText("Live video feed — not yet connected")
    ).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("shows 'Live' badge when robot is online", () => {
    render(<VideoPanel {...defaultProps} />);

    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("shows 'Disconnected' badge when robot is offline", () => {
    render(<VideoPanel {...defaultProps} robotConnection="offline" />);

    expect(screen.getByText("Disconnected")).toBeInTheDocument();
  });

  it("renders camera icon", () => {
    const { container } = render(<VideoPanel {...defaultProps} />);

    // Lucide icons render as SVG elements
    const cameraIcon = container.querySelector('svg');
    expect(cameraIcon).toBeInTheDocument();
  });

  it("applies correct styling for online connection", () => {
    render(<VideoPanel {...defaultProps} />);

    const badge = screen.getByText("Live").closest("div");
    expect(badge).toHaveClass("bg-green-500/20", "text-green-400");
  });

  it("applies correct styling for offline connection", () => {
    render(<VideoPanel {...defaultProps} robotConnection="offline" />);

    const badge = screen.getByText("Disconnected").closest("div");
    expect(badge).toHaveClass("bg-red-500/20", "text-red-400");
  });

  it("shows audio connected status when connected", () => {
    render(<VideoPanel {...defaultProps} />);

    expect(screen.getByText("Audio connected")).toBeInTheDocument();
  });

  it("shows mute toggle button", () => {
    render(<VideoPanel {...defaultProps} />);

    expect(screen.getByRole("button", { name: /mute audio/i })).toBeInTheDocument();
  });

  it("shows mock audio badge in mock mode", () => {
    process.env.NEXT_PUBLIC_USE_MOCK_API = "true";
    
    render(<VideoPanel {...defaultProps} />);

    expect(screen.getByText("Audio (mocked)")).toBeInTheDocument();
  });
});
