"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle, XCircle, X } from "lucide-react";

interface ToastProps {
  message: string;
  variant: "success" | "error";
  onDismiss?: () => void;
}

/**
 * Toast component for temporary notifications.
 *
 * Features:
 * - Auto-dismisses after 3 seconds
 * - Positioned at top-right of viewport
 * - Success (green) and error (red) variants
 * - Manual dismiss option with close button
 * - Slide-in animation from right
 * - Accessible with proper ARIA attributes
 *
 * Note: test suite asserts specific Tailwind classes — keep them stable.
 */
export function Toast({ message, variant, onDismiss }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleDismiss();
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      onDismiss?.();
    }, 300);
  };

  // Note: test suite asserts these exact class strings — keep them stable.
  const variantStyles = {
    success: {
      container: "bg-green-600/95 border-green-500 text-green-50",
      Icon: CheckCircle,
    },
    error: {
      container: "bg-red-600/95 border-red-500 text-red-50",
      Icon: XCircle,
    },
  };

  const styles = variantStyles[variant];
  const Icon = styles.Icon;

  return (
    <div
      className={`
        fixed top-4 right-4 z-50 min-w-80 max-w-md
        ${styles.container}
        border-l-4 rounded-lg shadow-lg backdrop-blur-sm
        transform transition-all duration-300 ease-in-out
        ${isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}
      `}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-start gap-3 p-4">
        {/* Icon */}
        <Icon className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />

        {/* Message */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium break-words">{message}</p>
        </div>

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 rounded p-1 transition-colors hover:bg-white/10 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
