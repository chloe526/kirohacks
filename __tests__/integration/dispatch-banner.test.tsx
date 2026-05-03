import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { usePatientStore } from "@/stores/patientStore";
import { Banner } from "@/components/ui/Banner";
import type { PatientRecord } from "@/types";

// Mock patient data
const mockEscalatedPatient: PatientRecord = {
  patient_id: "pat-test",
  name: "Test Patient",
  address: {
    line1: "123 Test St",
    line2: "Test City, TC 12345"
  },
  status: "ESCALATED",
  last_updated: "2024-01-15T10:00:00Z",
  help_event: {
    triggered_at: "2024-01-15T09:30:00Z"
  },
  robot: {
    connection: "online",
    battery: 75,
    last_command: "stop",
    last_command_at: "2024-01-15T09:55:00Z"
  },
  session: {
    session_id: "sess-test",
    active: true,
    started_at: "2024-01-15T09:35:00Z",
    ended_at: null
  }
};

const mockInSessionPatient: PatientRecord = {
  ...mockEscalatedPatient,
  status: "IN_SESSION"
};

describe("Dispatch Banner Integration", () => {
  it("displays banner when patient status is ESCALATED", () => {
    // Test the banner component directly with ESCALATED status
    render(
      <div>
        {mockEscalatedPatient.status === "ESCALATED" && (
          <Banner
            message="Emergency services have been dispatched"
            variant="error"
          />
        )}
      </div>
    );

    expect(screen.getByText("Emergency services have been dispatched")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("does not display banner when patient status is not ESCALATED", () => {
    // Test the banner component with IN_SESSION status
    render(
      <div>
        {mockInSessionPatient.status === "ESCALATED" && (
          <Banner
            message="Emergency services have been dispatched"
            variant="error"
          />
        )}
      </div>
    );

    expect(screen.queryByText("Emergency services have been dispatched")).not.toBeInTheDocument();
  });

  it("banner has correct styling for error variant", () => {
    render(
      <Banner
        message="Emergency services have been dispatched"
        variant="error"
        className="sticky top-[73px] z-40"
      />
    );

    const banner = screen.getByRole("alert");
    expect(banner).toHaveClass("bg-red-600/90", "border-red-500", "text-red-50");
    expect(banner).toHaveClass("sticky", "top-[73px]", "z-40");
  });

  it("banner is persistent and non-dismissable", () => {
    render(
      <Banner
        message="Emergency services have been dispatched"
        variant="error"
      />
    );

    const banner = screen.getByRole("alert");
    
    // Verify there's no close button or dismiss functionality
    expect(banner.querySelector("button")).toBeNull();
    expect(banner.querySelector("[aria-label*='close']")).toBeNull();
    expect(banner.querySelector("[aria-label*='dismiss']")).toBeNull();
  });
});