"use client";

import React from "react";
import { Toast } from "./Toast";
import { useToastStore } from "@/stores/toastStore";

/**
 * ToastContainer component that renders all active toasts.
 *
 * This component should be placed at the root level of the application
 * to ensure toasts are displayed above all other content.
 */
export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          variant={toast.variant}
          onDismiss={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}
