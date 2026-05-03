import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SessionHeader } from "@/components/session/SessionHeader";
import type { PatientRecord } from "@/types";

describe("SessionHeader", () => {
  const mockPatient: PatientRecord = {
    patient_id: "pat-001",
    name: "John Doe",
    address: {
      line1: "1234 Imaginary Ave",
      line2: "City State 12345",
    },
    status: "IN_SESSION",
    last_updated: "2024-01-15T10:30:00Z",
    help_event: {
      triggered_at: null,
    },
    robot: {
      connection: "online",
      battery: 82,
      last_command: "move forward",
      last_command_at: "2024-01-15T10:25:00Z",
    },
    session: {
      session_id: "sess-xyz789",
      active: true,
      started_at: "2024-01-15T10:20:00Z",
      ended_at: null,
    },
  };

  it("renders patient name", () => {
    render(
      <SessionHeader
        patient={mockPatient}
        onEndSession={vi.fn()}
        onDispatch={vi.fn()}
      />
    );

    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("renders session ID", () => {
    render(
      <SessionHeader
        patient={mockPatient}
        onEndSession={vi.fn()}
        onDispatch={vi.fn()}
      />
    );

    expect(screen.getByText("sess-xyz789")).toBeInTheDocument();
  });

  it("renders End Session button enabled when status is IN_SESSION", () => {
    render(
      <SessionHeader
        patient={mockPatient}
        onEndSession={vi.fn()}
        onDispatch={vi.fn()}
      />
    );

    const endButton = screen.getByRole("button", { name: /end session/i });
    expect(endButton).toBeEnabled();
  });

  it("renders Dispatch button enabled when status is IN_SESSION", () => {
    render(
      <SessionHeader
        patient={mockPatient}
        onEndSession={vi.fn()}
        onDispatch={vi.fn()}
      />
    );

    const dispatchButton = screen.getByRole("button", {
      name: /dispatch emergency services/i,
    });
    expect(dispatchButton).toBeEnabled();
  });

  it("disables and relabels Dispatch button when status is ESCALATED", () => {
    const escalatedPatient: PatientRecord = {
      ...mockPatient,
      status: "ESCALATED",
    };

    render(
      <SessionHeader
        patient={escalatedPatient}
        onEndSession={vi.fn()}
        onDispatch={vi.fn()}
      />
    );

    const dispatchButton = screen.getByRole("button", {
      name: /emergency services already dispatched/i,
    });
    expect(dispatchButton).toBeDisabled();
    expect(dispatchButton).toHaveTextContent("Dispatched");
  });

  it("disables End Session button when status is not IN_SESSION", () => {
    const idlePatient: PatientRecord = {
      ...mockPatient,
      status: "IDLE",
    };

    render(
      <SessionHeader
        patient={idlePatient}
        onEndSession={vi.fn()}
        onDispatch={vi.fn()}
      />
    );

    const endButton = screen.getByRole("button", { name: /end session/i });
    expect(endButton).toBeDisabled();
  });

  it("shows online indicator when robot is online", () => {
    render(
      <SessionHeader
        patient={mockPatient}
        onEndSession={vi.fn()}
        onDispatch={vi.fn()}
      />
    );

    const indicator = screen.getByLabelText("Robot online");
    expect(indicator).toBeInTheDocument();
  });

  it("shows offline indicator when robot is offline", () => {
    const offlinePatient: PatientRecord = {
      ...mockPatient,
      robot: {
        ...mockPatient.robot,
        connection: "offline",
      },
    };

    render(
      <SessionHeader
        patient={offlinePatient}
        onEndSession={vi.fn()}
        onDispatch={vi.fn()}
      />
    );

    const indicator = screen.getByLabelText("Robot offline");
    expect(indicator).toBeInTheDocument();
  });
});
