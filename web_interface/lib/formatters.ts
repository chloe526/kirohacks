/**
 * lib/formatters.ts
 *
 * Pure utility functions for displaying timestamps and durations in the UI.
 * All functions accept ISO 8601 strings and return human-readable strings.
 * No side effects — safe to call in tests without mocking.
 */

/**
 * Format an ISO 8601 timestamp as a locale-aware local time string.
 *
 * @example
 * formatLocalTime("2024-01-15T10:30:00Z") // → "10:30:00 AM" (locale-dependent)
 */
export function formatLocalTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Format the elapsed time between an ISO 8601 timestamp and now as a
 * human-readable relative string.
 *
 * - Under 60 s  → "X seconds ago"
 * - 60 s – 59 m → "X minutes ago"
 * - 60 m+       → "X hours ago"
 *
 * @example
 * formatRelativeTime(new Date(Date.now() - 45_000).toISOString()) // → "45 seconds ago"
 * formatRelativeTime(new Date(Date.now() - 125_000).toISOString()) // → "2 minutes ago"
 */
export function formatRelativeTime(iso: string): string {
  const elapsedMs = Date.now() - new Date(iso).getTime();
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));

  if (totalSeconds < 60) {
    return `${totalSeconds} second${totalSeconds === 1 ? "" : "s"} ago`;
  }

  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"} ago`;
  }

  const totalHours = Math.floor(totalMinutes / 60);
  return `${totalHours} hour${totalHours === 1 ? "" : "s"} ago`;
}

/**
 * Format the duration between a start ISO 8601 timestamp and an optional end
 * timestamp (defaults to now) as a human-readable string.
 *
 * - Under 60 s  → "X seconds"
 * - 60 s – 59 m → "X minutes Y seconds"
 * - 60 m+       → "X hours Y minutes"
 *
 * @example
 * formatDuration("2024-01-15T10:30:00Z", "2024-01-15T10:34:12Z")
 * // → "4 minutes 12 seconds"
 *
 * formatDuration("2024-01-15T10:30:00Z")
 * // → elapsed from start to now
 */
export function formatDuration(startIso: string, endIso?: string): string {
  const endMs = endIso ? new Date(endIso).getTime() : Date.now();
  const elapsedMs = Math.max(0, endMs - new Date(startIso).getTime());
  const totalSeconds = Math.floor(elapsedMs / 1000);

  if (totalSeconds < 60) {
    return `${totalSeconds} second${totalSeconds === 1 ? "" : "s"}`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes < 60) {
    if (seconds === 0) {
      return `${minutes} minute${minutes === 1 ? "" : "s"}`;
    }
    return `${minutes} minute${minutes === 1 ? "" : "s"} ${seconds} second${seconds === 1 ? "" : "s"}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${hours} hour${hours === 1 ? "" : "s"} ${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"}`;
}

/**
 * Format the time since the last robot command as a labelled string.
 *
 * @example
 * formatLastCommand(new Date(Date.now() - 30_000).toISOString())
 * // → "Last command: 30 seconds ago"
 */
export function formatLastCommand(iso: string): string {
  return `Last command: ${formatRelativeTime(iso)}`;
}
