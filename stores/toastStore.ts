import { create } from "zustand";

export interface ToastItem {
  id: string;
  message: string;
  variant: "success" | "error";
}

interface ToastStore {
  toasts: ToastItem[];
  addToast: (message: string, variant: "success" | "error") => void;
  removeToast: (id: string) => void;
}

/**
 * Toast store for managing global toast notifications.
 * 
 * Provides a simple API to show and dismiss toast messages
 * throughout the application.
 */
export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  addToast: (message: string, variant: "success" | "error") => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message, variant }],
    }));
  },

  removeToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },
}));