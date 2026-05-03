import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { CommandButton } from "@/components/session/CommandButton";
import type { RobotCommand } from "@/types";

// ─── Mock stores ─────────────────────────────────────────────────────────────

const mockAddCommand = vi.fn();
const mockPatchActivePatient = vi.fn();

vi.mock("@/stores/commandStore", () => ({
  useCommandStore: (selector: (s: unknown) => unknown) =>
    selector({ addCommand: mockAddCommand, setCommandStatus: vi.fn() }),
}));

vi.mock("@/stores/patientStore", () => ({
  usePatientStore: (selector: (s: unknown) => unknown) =>
    selector({ patchActivePatient: mockPatchActivePatient }),
}));

// ─── Mock apiClient ───────────────────────────────────────────────────────────

const mockPost = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  post: (...args: unknown[]) => mockPost(...args),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SESSION_ID = "session-abc-123";

function renderButton(overrides: Partial<React.ComponentProps<typeof CommandButton>> = {}) {
  return render(
    <CommandButton
      sessionId={SESSION_ID}
      action="left"
      label="Move Left"
      {...overrides}
    />
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("CommandButton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockPost.mockResolvedValue({});
    mockAddCommand.mockClear();
    mockPatchActivePatient.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders the label text", () => {
      renderButton({ label: "Move Left" });
      expect(screen.getByText("Move Left")).toBeInTheDocument();
    });

    it("renders an optional icon", () => {
      renderButton({ icon: <span data-testid="icon">←</span> });
      expect(screen.getByTestId("icon")).toBeInTheDocument();
    });

    it("renders without an icon when none is provided", () => {
      renderButton();
      // No icon container rendered — just the label
      expect(screen.getByText("Move Left")).toBeInTheDocument();
    });

    it("is enabled by default", () => {
      renderButton();
      expect(screen.getByRole("button")).not.toBeDisabled();
    });

    it("is disabled when disabled prop is true", () => {
      renderButton({ disabled: true });
      expect(screen.getByRole("button")).toBeDisabled();
    });

    it("does not show a status indicator initially", () => {
      renderButton();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("has an aria-label matching the label prop", () => {
      renderButton({ label: "Stop Robot" });
      expect(screen.getByRole("button", { name: "Stop Robot" })).toBeInTheDocument();
    });
  });

  // ── Successful command ─────────────────────────────────────────────────────

  describe("on successful command", () => {
    it("POSTs to the correct endpoint", async () => {
      renderButton({ sessionId: "sess-999", action: "right" });

      await act(async () => {
        fireEvent.click(screen.getByRole("button"));
        await Promise.resolve();
      });

      expect(mockPost).toHaveBeenCalledWith(
        `/sessions/sess-999/commands`,
        expect.objectContaining({ session_id: "sess-999", action: "right" })
      );
    });

    it("includes issued_at as an ISO 8601 string in the command", async () => {
      renderButton();

      await act(async () => {
        fireEvent.click(screen.getByRole("button"));
        await Promise.resolve();
      });

      const [, body] = mockPost.mock.calls[0] as [string, RobotCommand];
      expect(body.issued_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it("calls commandStore.addCommand with success=true", async () => {
      renderButton();

      await act(async () => {
        fireEvent.click(screen.getByRole("button"));
        await Promise.resolve();
      });

      expect(mockAddCommand).toHaveBeenCalledWith(
        expect.objectContaining({ action: "left", session_id: SESSION_ID }),
        true
      );
    });

    it("calls patchActivePatient with last_command and last_command_at", async () => {
      renderButton({ action: "up" });

      await act(async () => {
        fireEvent.click(screen.getByRole("button"));
        await Promise.resolve();
      });

      expect(mockPatchActivePatient).toHaveBeenCalledWith(
        expect.objectContaining({
          robot: expect.objectContaining({ last_command: "up" }),
        })
      );
    });

    it("shows 'Command sent' green indicator after success", async () => {
      renderButton();

      await act(async () => {
        fireEvent.click(screen.getByRole("button"));
        await Promise.resolve();
      });

      expect(screen.getByRole("status")).toHaveTextContent("Command sent");
      expect(screen.getByRole("status").className).toContain("text-green-400");
    });

    it("clears the status indicator after 3 seconds", async () => {
      renderButton();

      await act(async () => {
        fireEvent.click(screen.getByRole("button"));
        await Promise.resolve();
      });

      expect(screen.getByRole("status")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("calls onCommandSent callback with the command", async () => {
      const onCommandSent = vi.fn();
      renderButton({ onCommandSent });

      await act(async () => {
        fireEvent.click(screen.getByRole("button"));
        await Promise.resolve();
      });

      expect(onCommandSent).toHaveBeenCalledWith(
        expect.objectContaining({ action: "left", session_id: SESSION_ID })
      );
    });
  });

  // ── Failed command ─────────────────────────────────────────────────────────

  describe("on failed command", () => {
    beforeEach(() => {
      mockPost.mockRejectedValue(new Error("API request failed with status 500"));
    });

    it("calls commandStore.addCommand with success=false", async () => {
      renderButton();

      await act(async () => {
        fireEvent.click(screen.getByRole("button"));
        await Promise.resolve();
      });

      expect(mockAddCommand).toHaveBeenCalledWith(
        expect.objectContaining({ action: "left" }),
        false
      );
    });

    it("shows 'Command failed' red indicator after failure", async () => {
      renderButton();

      await act(async () => {
        fireEvent.click(screen.getByRole("button"));
        await Promise.resolve();
      });

      expect(screen.getByRole("status")).toHaveTextContent("Command failed");
      expect(screen.getByRole("status").className).toContain("text-red-400");
    });

    it("does NOT call patchActivePatient on failure", async () => {
      renderButton();

      await act(async () => {
        fireEvent.click(screen.getByRole("button"));
        await Promise.resolve();
      });

      expect(mockPatchActivePatient).not.toHaveBeenCalled();
    });

    it("clears the failure indicator after 3 seconds", async () => {
      renderButton();

      await act(async () => {
        fireEvent.click(screen.getByRole("button"));
        await Promise.resolve();
      });

      expect(screen.getByRole("status")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("still calls onCommandSent on failure", async () => {
      const onCommandSent = vi.fn();
      renderButton({ onCommandSent });

      await act(async () => {
        fireEvent.click(screen.getByRole("button"));
        await Promise.resolve();
      });

      expect(onCommandSent).toHaveBeenCalled();
    });
  });

  // ── In-flight guard ────────────────────────────────────────────────────────

  describe("in-flight guard (prevents double-clicks)", () => {
    it("disables the button while a command is in-flight", async () => {
      // Never resolves during this test
      mockPost.mockReturnValue(new Promise(() => {}));
      renderButton();

      act(() => {
        fireEvent.click(screen.getByRole("button"));
      });

      expect(screen.getByRole("button")).toBeDisabled();
    });

    it("does not POST a second time if clicked while in-flight", async () => {
      mockPost.mockReturnValue(new Promise(() => {}));
      renderButton();

      act(() => {
        fireEvent.click(screen.getByRole("button"));
        fireEvent.click(screen.getByRole("button"));
        fireEvent.click(screen.getByRole("button"));
      });

      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it("re-enables the button after the command resolves", async () => {
      renderButton();

      await act(async () => {
        fireEvent.click(screen.getByRole("button"));
        await Promise.resolve();
      });

      expect(screen.getByRole("button")).not.toBeDisabled();
    });
  });

  // ── Disabled prop ──────────────────────────────────────────────────────────

  describe("disabled prop", () => {
    it("does not POST when disabled prop is true", async () => {
      renderButton({ disabled: true });

      await act(async () => {
        fireEvent.click(screen.getByRole("button"));
        await Promise.resolve();
      });

      expect(mockPost).not.toHaveBeenCalled();
    });

    it("applies disabled cursor styling when disabled", () => {
      renderButton({ disabled: true });
      const btn = screen.getByRole("button");
      expect(btn.className).toContain("cursor-not-allowed");
    });
  });

  // ── Accessibility ──────────────────────────────────────────────────────────

  describe("accessibility", () => {
    it("status indicator has aria-live=polite", async () => {
      renderButton();

      await act(async () => {
        fireEvent.click(screen.getByRole("button"));
        await Promise.resolve();
      });

      const status = screen.getByRole("status");
      expect(status).toHaveAttribute("aria-live", "polite");
    });

    it("button has aria-busy=true while in-flight", async () => {
      mockPost.mockReturnValue(new Promise(() => {}));
      renderButton();

      act(() => {
        fireEvent.click(screen.getByRole("button"));
      });

      expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
    });
  });
});
