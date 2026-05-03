"use client";

import { useEffect } from "react";
import { usePatientStore } from "@/stores/patientStore";
import type { PatientRecord } from "@/types";

/**
 * Same-origin proxy route — the browser fetches this, Next.js fetches the
 * robot on the server side (no CORS issues for the client).
 */
const PROXY_URL = "/api/v1/robot-state";
const SYNC_INTERVAL_MS = 2000; // 2 seconds

/**
 * useRobotStateSync
 *
 * Runs entirely in the browser. Every SYNC_INTERVAL_MS milliseconds it
 * fetches /api/v1/robot-state (a same-origin Next.js route that proxies the
 * robot endpoint) and patches John Doe's card in the Zustand store.
 *
 * All other patient cards are left untouched — they are static placeholders.
 *
 * Store actions are read via getState() inside the async callback so there
 * is no stale-closure risk with setInterval.
 */
export function useRobotStateSync() {
  useEffect(() => {
    let cancelled = false;

    async function fetchAndSync() {
      if (cancelled) return;
      try {
        const response = await fetch(PROXY_URL, {
          // Instruct the browser not to serve a cached response
          cache: "no-store",
        });

        if (!response.ok) {
          console.warn(`[robot-sync] HTTP ${response.status} from ${PROXY_URL}`);
          return;
        }

        const patientRecord = (await response.json()) as PatientRecord;

        if (cancelled) return;

        // Read store actions at call-time — avoids stale closure
        const { patchPatient, patchActivePatient } =
          usePatientStore.getState();

        // Only update John Doe; all other cards stay static
        patchPatient(patientRecord.patient_id, patientRecord);
        // Keep the active session page in sync too
        patchActivePatient(patientRecord);
      } catch (err) {
        if (!cancelled) {
          console.warn(
            `[robot-sync] Fetch error:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }

    // Fire immediately on mount, then on every tick
    fetchAndSync();
    const intervalId = setInterval(fetchAndSync, SYNC_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []); // runs once on mount, cleans up on unmount
}
