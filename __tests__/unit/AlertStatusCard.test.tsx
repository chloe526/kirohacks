import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { AlertStatusCard } from "@/components/session/AlertStatusCard";

describe("AlertStatusCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("IDLE status", () => {
    it("renders neutral styling with no urgency indicators", () => {
      render(<AlertStatusCard status="IDLE" helpTriggeredAt={null} />);

      expect(screen.getByText("No Active Alert")).toBeInTheDocument();
      expect(screen.getByText("Patient status is normal")).toBeInTheDocument();
    });

    it("applies neutral border and background", () => {
      const { container } = render(
        <AlertStatusCard status="IDLE" helpTriggeredAt={null} />
      );

      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain("border-slate-700");
      expect(card.className).toContain("bg-slate-800/50");
      expect(card.className).not.toContain("animate-pulse");
    });
  });

  describe("HELP_TRIGGERED status", () => {
    it("renders amber border with pulse animation", () => {
      const triggeredAt = new Date(Date.now() - 120_000).toISOString(); // 2 minutes ago

      const { container } = render(
        <AlertStatusCard status="HELP_TRIGGERED" helpTriggeredAt={triggeredAt} />
      );

      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain("border-amber-500");
      expect(card.className).toContain("animate-pulse");
    });

    it("displays help request pending message", () => {
      const triggeredAt = new Date(Date.now() - 120_000).toISOString();

      render(
        <AlertStatusCard status="HELP_TRIGGERED" helpTriggeredAt={triggeredAt} />
      );

      expect(screen.getByText("Help Request Pending")).toBeInTheDocument();
    });

    it("displays live counter showing time since help was triggered", () => {
      const triggeredAt = new Date(Date.now() - 120_000).toISOString(); // 2 minutes ago

      render(
        <AlertStatusCard status="HELP_TRIGGERED" helpTriggeredAt={triggeredAt} />
      );

      expect(screen.getByText(/Help triggered 2 minutes ago/)).toBeInTheDocument();
    });

    it("updates the counter every second", () => {
      const triggeredAt = new Date(Date.now() - 45_000).toISOString(); // 45 seconds ago

      render(
        <AlertStatusCard status="HELP_TRIGGERED" helpTriggeredAt={triggeredAt} />
      );

      expect(screen.getByText(/Help triggered 45 seconds ago/)).toBeInTheDocument();

      // Advance time by 1 second wrapped in act
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByText(/Help triggered 46 seconds ago/)).toBeInTheDocument();
    });

    it("handles null helpTriggeredAt gracefully", () => {
      render(<AlertStatusCard status="HELP_TRIGGERED" helpTriggeredAt={null} />);

      expect(screen.getByText("Help Request Pending")).toBeInTheDocument();
      expect(screen.queryByText(/Help triggered/)).not.toBeInTheDocument();
    });
  });

  describe("IN_SESSION status", () => {
    it("renders green border without pulse animation", () => {
      const { container } = render(
        <AlertStatusCard status="IN_SESSION" helpTriggeredAt={null} />
      );

      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain("border-green-500");
      expect(card.className).not.toContain("animate-pulse");
    });

    it("displays session in progress message", () => {
      render(<AlertStatusCard status="IN_SESSION" helpTriggeredAt={null} />);

      expect(screen.getByText("Session in Progress")).toBeInTheDocument();
      expect(
        screen.getByText("Clinician is actively monitoring this patient")
      ).toBeInTheDocument();
    });
  });

  describe("ESCALATED status", () => {
    it("renders red border with pulse animation and glow", () => {
      const { container } = render(
        <AlertStatusCard status="ESCALATED" helpTriggeredAt={null} />
      );

      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain("border-red-500");
      expect(card.className).toContain("animate-pulse");
      expect(card.className).toContain("shadow-");
    });

    it("displays escalated emergency message", () => {
      render(<AlertStatusCard status="ESCALATED" helpTriggeredAt={null} />);

      expect(screen.getByText("ESCALATED")).toBeInTheDocument();
      expect(
        screen.getByText("Emergency services have been dispatched")
      ).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("has role=status for screen readers", () => {
      const { container } = render(
        <AlertStatusCard status="IN_SESSION" helpTriggeredAt={null} />
      );

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveAttribute("role", "status");
    });

    it("has aria-live=polite for dynamic updates", () => {
      const { container } = render(
        <AlertStatusCard status="HELP_TRIGGERED" helpTriggeredAt={new Date().toISOString()} />
      );

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveAttribute("aria-live", "polite");
    });

    it("has aria-atomic=true for complete announcements", () => {
      const { container } = render(
        <AlertStatusCard status="ESCALATED" helpTriggeredAt={null} />
      );

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveAttribute("aria-atomic", "true");
    });
  });
});
