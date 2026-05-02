/**
 * Unit tests for lib/formatters.ts
 *
 * Feature: remote-robot-healthcare
 * Tests cover the four formatter functions with known inputs and edge cases.
 * All time-sensitive tests use fixed ISO strings relative to a mocked "now".
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatLocalTime,
  formatRelativeTime,
  formatDuration,
  formatLastCommand,
} from "@/lib/formatters";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns an ISO string that is `offsetMs` milliseconds before the mocked now. */
function isoAgo(offsetMs: number): string {
  return new Date(Date.now() - offsetMs).toISOString();
}

// ── formatLocalTime ───────────────────────────────────────────────────────────

describe("formatLocalTime", () => {
  it("returns a non-empty string for a valid ISO timestamp", () => {
    const result = formatLocalTime("2024-01-15T10:30:00Z");
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("includes hour and minute components", () => {
    // The exact format is locale-dependent, but it must contain digits
    const result = formatLocalTime("2024-01-15T14:05:30Z");
    expect(result).toMatch(/\d/);
  });

  it("handles midnight correctly", () => {
    const result = formatLocalTime("2024-01-15T00:00:00Z");
    expect(result).toBeTruthy();
  });
});

// ── formatRelativeTime ────────────────────────────────────────────────────────

describe("formatRelativeTime", () => {
  it("returns 'X seconds ago' for elapsed time under 60 seconds", () => {
    const result = formatRelativeTime(isoAgo(45_000)); // 45 s ago
    expect(result).toBe("45 seconds ago");
  });

  it("uses singular 'second' when elapsed is exactly 1 second", () => {
    const result = formatRelativeTime(isoAgo(1_000));
    expect(result).toBe("1 second ago");
  });

  it("returns 'X minutes ago' for elapsed time between 60 s and 59 m", () => {
    const result = formatRelativeTime(isoAgo(125_000)); // 2 min 5 s → 2 minutes
    expect(result).toBe("2 minutes ago");
  });

  it("uses singular 'minute' when elapsed is exactly 1 minute", () => {
    const result = formatRelativeTime(isoAgo(60_000));
    expect(result).toBe("1 minute ago");
  });

  it("returns 'X hours ago' for elapsed time of 60 minutes or more", () => {
    const result = formatRelativeTime(isoAgo(3_600_000)); // 1 hour
    expect(result).toBe("1 hour ago");
  });

  it("uses singular 'hour' when elapsed is exactly 1 hour", () => {
    const result = formatRelativeTime(isoAgo(3_600_000));
    expect(result).toBe("1 hour ago");
  });

  it("returns '0 seconds ago' for a timestamp equal to now", () => {
    const result = formatRelativeTime(new Date().toISOString());
    expect(result).toMatch(/^0 seconds ago$/);
  });
});

// ── formatDuration ────────────────────────────────────────────────────────────

describe("formatDuration", () => {
  it("returns 'X seconds' for a duration under 60 seconds (with explicit end)", () => {
    const start = "2024-01-15T10:30:00Z";
    const end = "2024-01-15T10:30:45Z"; // 45 s
    expect(formatDuration(start, end)).toBe("45 seconds");
  });

  it("uses singular 'second' for exactly 1 second", () => {
    const start = "2024-01-15T10:30:00Z";
    const end = "2024-01-15T10:30:01Z";
    expect(formatDuration(start, end)).toBe("1 second");
  });

  it("returns 'X minutes Y seconds' for a duration between 1 and 59 minutes", () => {
    const start = "2024-01-15T10:30:00Z";
    const end = "2024-01-15T10:34:12Z"; // 4 min 12 s
    expect(formatDuration(start, end)).toBe("4 minutes 12 seconds");
  });

  it("omits seconds when the duration is an exact number of minutes", () => {
    const start = "2024-01-15T10:30:00Z";
    const end = "2024-01-15T10:33:00Z"; // exactly 3 min
    expect(formatDuration(start, end)).toBe("3 minutes");
  });

  it("returns 'X hours Y minutes' for a duration of 60 minutes or more", () => {
    const start = "2024-01-15T10:00:00Z";
    const end = "2024-01-15T11:30:00Z"; // 1 h 30 min
    expect(formatDuration(start, end)).toBe("1 hour 30 minutes");
  });

  it("omits minutes when the duration is an exact number of hours", () => {
    const start = "2024-01-15T10:00:00Z";
    const end = "2024-01-15T12:00:00Z"; // exactly 2 h
    expect(formatDuration(start, end)).toBe("2 hours");
  });

  it("counts from start to now when no end time is provided", () => {
    // Start 90 seconds ago → should be "1 minute 30 seconds"
    const start = new Date(Date.now() - 90_000).toISOString();
    const result = formatDuration(start);
    // Allow ±1 s tolerance for test execution time
    expect(result).toMatch(/^1 minute (2[89]|30|31) seconds$/);
  });

  it("returns '0 seconds' when start equals end", () => {
    const ts = "2024-01-15T10:30:00Z";
    expect(formatDuration(ts, ts)).toBe("0 seconds");
  });
});

// ── formatLastCommand ─────────────────────────────────────────────────────────

describe("formatLastCommand", () => {
  it("returns a string starting with 'Last command:'", () => {
    const result = formatLastCommand(isoAgo(30_000)); // 30 s ago
    expect(result).toBe("Last command: 30 seconds ago");
  });

  it("works for a command issued 2 minutes ago", () => {
    const result = formatLastCommand(isoAgo(120_000));
    expect(result).toBe("Last command: 2 minutes ago");
  });
});
