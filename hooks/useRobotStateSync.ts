"use client";

import { useEffect, useRef } from "react";
import { usePatientStore } from "@/stores/patientStore";
import type { PatientRecord } from "@/types";

const ROBOT_STATE_URL = "http://10.40.98.25:8081/state";
const SYNC_INTERVAL_MS = 5000; // 5 seconds

interface RobotStateResponse {
  patient_id: string;
  name: string;
  address: {
    line1: string;
    line2: string;
  };
  status: string;
  last_update?: string;
  last_updated?: string;
  help_event: {
    triggered_at?: string;
    triggered?: string;
  };
  robot: {
    connection: string;
    battery: number;
    last_command: string;
    last_command_at: string;
  };
  session: {
    session_id: string | null;
    active: boolean;
    started_at: string | null;
    ended_at: string | null;
  };
}

/**
 * useRobotStateSync
 *
 * Periodically fetches the robot's live state from http://10.40.98.25:8081/state
 * and updates the patient store with the current patient data.
 *
 * This ensures the dashboard always shows the robot's current state without
 * requiring manual refreshes.
 */
export function useRobotStateSync() {
  const { setPatients, patchActivePatient } = usePatientStore();
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const transformRobotState = (
    robotState: RobotStateResponse,
  ): PatientRecord => {
    return {
      patient_id: robotState.patient_id,
      name: robotState.name,
      address: robotState.address,
      status: (robotState.status as any) || "IDLE",
      last_updated:
        robotState.last_updated ||
        robotState.last_update ||
        new Date().toISOString(),
      help_event: {
        triggered_at:
          robotState.help_event.triggered_at ||
          (robotState.help_event.triggered
            ? robotState.help_event.triggered
            : null),
      },
      robot: {
        connection:
          robotState.robot.connection === "online" ? "online" : "offline",
        battery: robotState.robot.battery || 0,
        last_command: robotState.robot.last_command || "",
        last_command_at: robotState.robot.last_command_at || "",
      },
      session: {
        session_id: robotState.session.session_id || null,
        active: robotState.session.active || false,
        started_at: robotState.session.started_at || null,
        ended_at: robotState.session.ended_at || null,
      },
    };
  };

  const fetchAndSync = async () => {
    try {
      const response = await fetch(ROBOT_STATE_URL);
      if (!response.ok) {
        console.warn(
          `[robot-sync] Failed to fetch robot state: ${response.status}`,
        );
        return;
      }

      const robotState = (await response.json()) as RobotStateResponse;
      const patientRecord = transformRobotState(robotState);

      // Update the patient list with the synced state
      setPatients([patientRecord]);

      // Also patch the active patient if it matches
      patchActivePatient(patientRecord);
    } catch (err) {
      console.warn(
        `[robot-sync] Error fetching robot state from ${ROBOT_STATE_URL}:`,
        err instanceof Error ? err.message : err,
      );
    }
  };

  useEffect(() => {
    // Fetch immediately on mount
    fetchAndSync();

    // Set up periodic sync
    syncIntervalRef.current = setInterval(() => {
      fetchAndSync();
    }, SYNC_INTERVAL_MS);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, []);
}
