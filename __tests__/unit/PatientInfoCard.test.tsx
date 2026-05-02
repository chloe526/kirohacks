import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PatientInfoCard } from "@/components/session/PatientInfoCard";

describe("PatientInfoCard", () => {
  it("renders patient name and address when all props are provided", () => {
    render(
      <PatientInfoCard
        name="John Doe"
        addressLine1="1234 Imaginary Ave"
        addressLine2="City State 12345"
      />
    );

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("1234 Imaginary Ave")).toBeInTheDocument();
    expect(screen.getByText("City State 12345")).toBeInTheDocument();
  });

  it("renders placeholder avatar icon", () => {
    const { container } = render(
      <PatientInfoCard
        name="John Doe"
        addressLine1="1234 Imaginary Ave"
        addressLine2="City State 12345"
      />
    );

    // Check for the User icon (lucide-react renders as svg)
    const avatar = container.querySelector('svg');
    expect(avatar).toBeInTheDocument();
  });

  it('shows "Patient profile unavailable" when name is missing', () => {
    render(
      <PatientInfoCard
        name=""
        addressLine1="1234 Imaginary Ave"
        addressLine2="City State 12345"
      />
    );

    expect(screen.getByText("Patient profile unavailable")).toBeInTheDocument();
    expect(screen.queryByText("1234 Imaginary Ave")).not.toBeInTheDocument();
  });

  it('shows "Patient profile unavailable" when addressLine1 is missing', () => {
    render(
      <PatientInfoCard
        name="John Doe"
        addressLine1=""
        addressLine2="City State 12345"
      />
    );

    expect(screen.getByText("Patient profile unavailable")).toBeInTheDocument();
    expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
  });

  it('shows "Patient profile unavailable" when addressLine2 is missing', () => {
    render(
      <PatientInfoCard
        name="John Doe"
        addressLine1="1234 Imaginary Ave"
        addressLine2=""
      />
    );

    expect(screen.getByText("Patient profile unavailable")).toBeInTheDocument();
    expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
  });

  it('shows "Patient profile unavailable" when all props are empty', () => {
    render(
      <PatientInfoCard
        name=""
        addressLine1=""
        addressLine2=""
      />
    );

    expect(screen.getByText("Patient profile unavailable")).toBeInTheDocument();
  });

  it("applies correct styling classes", () => {
    const { container } = render(
      <PatientInfoCard
        name="John Doe"
        addressLine1="1234 Imaginary Ave"
        addressLine2="City State 12345"
      />
    );

    // Check for card container with dark background
    const card = container.querySelector('.bg-slate-800');
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass('rounded-lg', 'border', 'border-slate-700');
  });

  it("does not block rendering when showing unavailable message", () => {
    const { container } = render(
      <PatientInfoCard
        name=""
        addressLine1=""
        addressLine2=""
      />
    );

    // Component should still render a card structure
    const card = container.querySelector('.bg-slate-800');
    expect(card).toBeInTheDocument();
  });
});
