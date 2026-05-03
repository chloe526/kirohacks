import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { RobotStatusCard } from "@/components/session/RobotStatusCard";
import type { PatientRecord } from "@/types";

type Robot = PatientRecord["robot"];

const baseRobot: Robot = {
  connection: "online",
  battery: 80,
  last_command: "left",
  last_command_at: new Date(Date.now() - 30_000).toISOString(), // 30 seconds ago
};

describe("RobotStatusCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T10:00:00Z"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("connection status indicator", () => {
    it("shows green dot and 'Online' label when robot is online", () => {
      render(<RobotStatusCard robot={{ ...baseRobot, connection: "online" }} />);

      expect(screen.getByText("Online")).toBeInTheDocument();
      // The Circle icon should have green styling
      const onlineLabel = screen.getByText("Online");
      expect(onlineLabel.className).toContain("text-green-400");
    });

    it("shows red dot and 'Offline' label when robot is offline", () => {
      render(<RobotStatusCard robot={{ ...baseRobot, connection: "offline" }} />);

      expect(screen.getByText("Offline")).toBeInTheDocument();
      const offlineLabel = screen.getByText("Offline");
      expect(offlineLabel.className).toContain("text-red-400");
    });
  });

  describe("battery progress bar", () => {
    it("renders battery percentage label", () => {
      render(<RobotStatusCard robot={{ ...baseRobot, battery: 75 }} />);

      expect(screen.getByText("75%")).toBeInTheDocument();
    });

    it("renders battery progress bar with correct width", () => {
      const { container } = render(
        <RobotStatusCard robot={{ ...baseRobot, battery: 60 }} />
      );

      const progressBar = container.querySelector('[role="progressbar"]');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute("aria-valuenow", "60");
      expect(progressBar).toHaveAttribute("aria-valuemin", "0");
      expect(progressBar).toHaveAttribute("aria-valuemax", "100");
    });

    it("uses green bar when battery is above 20%", () => {
      const { container } = render(
        <RobotStatusCard robot={{ ...baseRobot, battery: 50 }} />
      );

      const progressBar = container.querySelector('[role="progressbar"]');
      expect(progressBar?.className).toContain("bg-green-500");
      expect(progressBar?.className).not.toContain("bg-red-500");
    });

    it("uses red bar when battery is exactly 20%", () => {
      const { container } = render(
        <RobotStatusCard robot={{ ...baseRobot, battery: 20 }} />
      );

      const progressBar = container.querySelector('[role="progressbar"]');
      expect(progressBar?.className).toContain("bg-red-500");
    });

    it("uses red bar when battery is below 20%", () => {
      const { container } = render(
        <RobotStatusCard robot={{ ...baseRobot, battery: 10 }} />
      );

      const progressBar = container.querySelector('[role="progressbar"]');
      expect(progressBar?.className).toContain("bg-red-500");
    });

    it("shows 'Low Battery' label when battery is exactly 20%", () => {
      render(<RobotStatusCard robot={{ ...baseRobot, battery: 20 }} />);

      expect(screen.getByText("Low Battery")).toBeInTheDocument();
    });

    it("shows 'Low Battery' label when battery is below 20%", () => {
      render(<RobotStatusCard robot={{ ...baseRobot, battery: 5 }} />);

      expect(screen.getByText("Low Battery")).toBeInTheDocument();
    });

    it("does NOT show 'Low Battery' label when battery is above 20%", () => {
      render(<RobotStatusCard robot={{ ...baseRobot, battery: 21 }} />);

      expect(screen.queryByText("Low Battery")).not.toBeInTheDocument();
    });

    it("does NOT show 'Low Battery' label when battery is 100%", () => {
      render(<RobotStatusCard robot={{ ...baseRobot, battery: 100 }} />);

      expect(screen.queryByText("Low Battery")).not.toBeInTheDocument();
    });
  });

  describe("last command display", () => {
    it("displays the last command label", () => {
      render(<RobotStatusCard robot={{ ...baseRobot, last_command: "right" }} />);

      expect(screen.getByText("right")).toBeInTheDocument();
    });

    it("displays 'None' when last_command is empty", () => {
      render(<RobotStatusCard robot={{ ...baseRobot, last_command: "" }} />);

      expect(screen.getByText("None")).toBeInTheDocument();
    });

    it("displays last command timestamp using formatLastCommand", () => {
      const thirtySecondsAgo = new Date(
        new Date("2024-01-15T10:00:00Z").getTime() - 30_000
      ).toISOString();

      render(
        <RobotStatusCard
          robot={{ ...baseRobot, last_command_at: thirtySecondsAgo }}
        />
      );

      expect(screen.getByText("Last command: 30 seconds ago")).toBeInTheDocument();
    });

    it("displays last command in minutes when older than 60 seconds", () => {
      const twoMinutesAgo = new Date(
        new Date("2024-01-15T10:00:00Z").getTime() - 120_000
      ).toISOString();

      render(
        <RobotStatusCard
          robot={{ ...baseRobot, last_command_at: twoMinutesAgo }}
        />
      );

      expect(screen.getByText("Last command: 2 minutes ago")).toBeInTheDocument();
    });
  });

  describe("offline banner", () => {
    it("shows amber offline banner when robot is offline", () => {
      render(<RobotStatusCard robot={{ ...baseRobot, connection: "offline" }} />);

      expect(
        screen.getByText("Robot offline — commands will not be delivered")
      ).toBeInTheDocument();
    });

    it("offline banner has role=alert", () => {
      render(<RobotStatusCard robot={{ ...baseRobot, connection: "offline" }} />);

      const banner = screen.getByRole("alert");
      expect(banner).toBeInTheDocument();
    });

    it("does NOT show offline banner when robot is online", () => {
      render(<RobotStatusCard robot={{ ...baseRobot, connection: "online" }} />);

      expect(
        screen.queryByText("Robot offline — commands will not be delivered")
      ).not.toBeInTheDocument();
    });

    it("does NOT render an alert role element when robot is online", () => {
      render(<RobotStatusCard robot={{ ...baseRobot, connection: "online" }} />);

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("styling", () => {
    it("renders with dark card background", () => {
      const { container } = render(<RobotStatusCard robot={baseRobot} />);

      const card = container.querySelector(".bg-slate-800");
      expect(card).toBeInTheDocument();
    });

    it("battery percentage text is red when battery is low", () => {
      render(<RobotStatusCard robot={{ ...baseRobot, battery: 15 }} />);

      const batteryPercent = screen.getByText("15%");
      expect(batteryPercent.className).toContain("text-red-400");
    });

    it("battery percentage text is normal when battery is above threshold", () => {
      render(<RobotStatusCard robot={{ ...baseRobot, battery: 50 }} />);

      const batteryPercent = screen.getByText("50%");
      expect(batteryPercent.className).not.toContain("text-red-400");
    });
  });

  describe("accessibility", () => {
    it("progress bar has accessible aria-label", () => {
      const { container } = render(
        <RobotStatusCard robot={{ ...baseRobot, battery: 75 }} />
      );

      const progressBar = container.querySelector('[role="progressbar"]');
      expect(progressBar).toHaveAttribute("aria-label", "Battery level: 75%");
    });
  });
});
