import { create } from "zustand";
import type { RobotCommand, CommandStore } from "@/types";
import { COMMAND_LOG_MAX } from "@/lib/constants";

/**
 * Command store — manages robot command state and history.
 *
 * This store tracks:
 * - The most recently sent command (lastCommand)
 * - The status of the last command (idle | acknowledged | failed)
 * - A rolling log of the last N commands (capped at COMMAND_LOG_MAX)
 */
export const useCommandStore = create<CommandStore>((set) => ({
  // ─────────────────────────────────────────────────────────────────────────
  // Command state
  // ─────────────────────────────────────────────────────────────────────────
  lastCommand: null,
  commandStatus: "idle",
  log: [],

  /**
   * Add a command to the log and update lastCommand.
   *
   * @param cmd - The RobotCommand that was sent
   * @param success - Whether the command was acknowledged by the API
   */
  addCommand: (cmd: RobotCommand, success: boolean) => {
    set((state) => ({
      lastCommand: cmd,
      commandStatus: success ? "acknowledged" : "failed",
      // Prepend the new command and cap at COMMAND_LOG_MAX (newest first)
      log: [cmd, ...state.log].slice(0, COMMAND_LOG_MAX),
    }));
  },

  /**
   * Update the command status.
   * Typically used to reset to 'idle' after a timeout.
   */
  setCommandStatus: (s: "idle" | "acknowledged" | "failed") => {
    set({ commandStatus: s });
  },
}));
