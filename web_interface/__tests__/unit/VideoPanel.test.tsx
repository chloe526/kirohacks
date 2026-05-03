import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VideoPanel } from "@/components/session/VideoPanel";
import type { MicConnectionState } from "@/hooks/useMicCapture";

// ── Mock hooks ──────────────────────────────────────────────────────────────

const mockToggleIncoming = vi.fn();
const mockToggleOutgoing = vi.fn();

let mockIncomingState = "connected";
let mockOutgoingState: MicConnectionState = "connected";
let mockOutgoingMuted = true;
let mockIncomingMuted = false;

vi.mock("@/hooks/useAudioSocket", () => ({
  useAudioSocket: vi.fn(() => ({
    connectionState: mockIncomingState,
    isMuted: mockIncomingMuted,
    toggleMute: mockToggleIncoming,
    reconnectCount: 0,
  })),
}));

vi.mock("@/hooks/useMicCapture", () => ({
  useMicCapture: vi.fn(() => ({
    connectionState: mockOutgoingState,
    isMuted: mockOutgoingMuted,
    toggleMute: mockToggleOutgoing,
    reconnectCount: 0,
  })),
}));

// ── Tests ───────────────────────────────────────────────────────────────────

describe("VideoPanel", () => {
  const defaultProps = {
    patientName: "John Doe",
    robotConnection: "online" as const,
    sessionId: "sess-123",
    sessionActive: true,
  };

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_USE_MOCK_API;
    mockIncomingState = "connected";
    mockOutgoingState = "connected";
    mockOutgoingMuted = true;
    mockIncomingMuted = false;
    vi.clearAllMocks();
  });

  // ── Existing tests ────────────────────────────────────────────────────────

  it("renders patient name", () => {
    render(<VideoPanel {...defaultProps} />);
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

  it("shows incoming audio connected status", () => {
    render(<VideoPanel {...defaultProps} />);
    expect(screen.getByText("Audio connected")).toBeInTheDocument();
  });

  it("shows mock audio badge in mock mode", () => {
    process.env.NEXT_PUBLIC_USE_MOCK_API = "true";
    render(<VideoPanel {...defaultProps} />);
    expect(screen.getByText("Audio (mocked)")).toBeInTheDocument();
  });

  // ── Two distinct mute buttons ─────────────────────────────────────────────

  it("renders two distinct mute buttons", () => {
    render(<VideoPanel {...defaultProps} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it("incoming mute button has aria-label 'Mute audio' when unmuted", () => {
    mockIncomingMuted = false;
    render(<VideoPanel {...defaultProps} />);
    expect(screen.getByRole("button", { name: /mute audio/i })).toBeInTheDocument();
  });

  it("incoming mute button has aria-label 'Unmute audio' when muted", () => {
    mockIncomingMuted = true;
    render(<VideoPanel {...defaultProps} />);
    expect(screen.getByRole("button", { name: /unmute audio/i })).toBeInTheDocument();
  });

  // ── Outgoing mute button labels ───────────────────────────────────────────

  it("outgoing mute button shows 'Speak' when isMuted=true", () => {
    mockOutgoingMuted = true;
    mockOutgoingState = "connected";
    render(<VideoPanel {...defaultProps} />);
    expect(screen.getByText("Speak")).toBeInTheDocument();
  });

  it("outgoing mute button shows 'Mute Mic' when isMuted=false", () => {
    mockOutgoingMuted = false;
    mockOutgoingState = "connected";
    render(<VideoPanel {...defaultProps} />);
    expect(screen.getByText("Mute Mic")).toBeInTheDocument();
  });

  // ── Outgoing mute button disabled states ──────────────────────────────────

  it("outgoing mute button is disabled when connectionState=idle", () => {
    mockOutgoingState = "idle";
    render(<VideoPanel {...defaultProps} />);
    const btn = screen.getByTestId("outgoing-mute-toggle");
    expect(btn).toBeDisabled();
  });

  it("outgoing mute button is disabled when connectionState=connecting", () => {
    mockOutgoingState = "connecting";
    render(<VideoPanel {...defaultProps} />);
    expect(screen.getByTestId("outgoing-mute-toggle")).toBeDisabled();
  });

  it("outgoing mute button is disabled when connectionState=disconnected", () => {
    mockOutgoingState = "disconnected";
    render(<VideoPanel {...defaultProps} />);
    expect(screen.getByTestId("outgoing-mute-toggle")).toBeDisabled();
  });

  it("outgoing mute button is disabled when connectionState=permission-denied", () => {
    mockOutgoingState = "permission-denied";
    render(<VideoPanel {...defaultProps} />);
    expect(screen.getByTestId("outgoing-mute-toggle")).toBeDisabled();
  });

  it("outgoing mute button is enabled when connectionState=connected", () => {
    mockOutgoingState = "connected";
    render(<VideoPanel {...defaultProps} />);
    expect(screen.getByTestId("outgoing-mute-toggle")).not.toBeDisabled();
  });

  // ── Outgoing status indicator labels ─────────────────────────────────────

  it("shows 'Connecting mic…' when outgoing state=connecting", () => {
    mockOutgoingState = "connecting";
    render(<VideoPanel {...defaultProps} />);
    expect(screen.getByText("Connecting mic…")).toBeInTheDocument();
  });

  it("shows 'Mic connected' when outgoing state=connected", () => {
    mockOutgoingState = "connected";
    render(<VideoPanel {...defaultProps} />);
    expect(screen.getByText("Mic connected")).toBeInTheDocument();
  });

  it("shows 'Mic disconnected' when outgoing state=disconnected", () => {
    mockOutgoingState = "disconnected";
    render(<VideoPanel {...defaultProps} />);
    expect(screen.getByText("Mic disconnected")).toBeInTheDocument();
  });

  it("shows 'Mic permission denied' when outgoing state=permission-denied", () => {
    mockOutgoingState = "permission-denied";
    render(<VideoPanel {...defaultProps} />);
    expect(screen.getByText("Mic permission denied")).toBeInTheDocument();
  });

  it("shows 'Mic idle' when outgoing state=idle", () => {
    mockOutgoingState = "idle";
    render(<VideoPanel {...defaultProps} />);
    expect(screen.getByText("Mic idle")).toBeInTheDocument();
  });
});
