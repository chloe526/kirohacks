import { create } from "zustand";
import type { PatientRecord, PatientStore } from "@/types";

/**
 * Unified patient store — replaces the previous separate sessionStore,
 * patientStore, and robotStore.
 *
 * This store manages:
 * - Dashboard patient list (patients map)
 * - Active session patient (activePatient)
 * - Modal/dialog visibility state
 */
export const usePatientStore = create<PatientStore>((set) => ({
  // ─────────────────────────────────────────────────────────────────────────
  // Dashboard: keyed map of all patients
  // ─────────────────────────────────────────────────────────────────────────
  patients: {},
  isLoadingList: false,
  listError: null,

  setPatients: (records: PatientRecord[]) => {
    const patientsMap = records.reduce(
      (acc, record) => {
        acc[record.patient_id] = record;
        return acc;
      },
      {} as Record<string, PatientRecord>
    );
    set({ patients: patientsMap, isLoadingList: false, listError: null });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Session page: single active patient
  // ─────────────────────────────────────────────────────────────────────────
  activePatient: null,
  isLoadingActive: false,
  activeError: null,

  setActivePatient: (record: PatientRecord) => {
    set({
      activePatient: record,
      isLoadingActive: false,
      activeError: null,
    });
  },

  /**
   * Shallow-merge a partial update into activePatient.
   * Used for optimistic updates (e.g., after sending a command or dispatching EMS).
   */
  patchActivePatient: (patch: Partial<PatientRecord>) => {
    set((state) => {
      if (!state.activePatient) return state;
      return {
        activePatient: {
          ...state.activePatient,
          ...patch,
          // Deep merge nested objects if they exist in the patch
          address:
            patch.address !== undefined
              ? { ...state.activePatient.address, ...patch.address }
              : state.activePatient.address,
          help_event:
            patch.help_event !== undefined
              ? { ...state.activePatient.help_event, ...patch.help_event }
              : state.activePatient.help_event,
          robot:
            patch.robot !== undefined
              ? { ...state.activePatient.robot, ...patch.robot }
              : state.activePatient.robot,
          session:
            patch.session !== undefined
              ? { ...state.activePatient.session, ...patch.session }
              : state.activePatient.session,
        },
      };
    });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Modal / dialog visibility
  // ─────────────────────────────────────────────────────────────────────────
  isReportModalOpen: false,
  isDispatchDialogOpen: false,

  openReportModal: () => set({ isReportModalOpen: true }),
  closeReportModal: () => set({ isReportModalOpen: false }),
  openDispatchDialog: () => set({ isDispatchDialogOpen: true }),
  closeDispatchDialog: () => set({ isDispatchDialogOpen: false }),
}));
