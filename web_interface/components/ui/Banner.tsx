"use client";

import React from "react";

interface BannerProps {
  message: string;
  variant?: "info" | "warning" | "error" | "success";
  className?: string;
}

/**
 * Banner
 *
 * A persistent, non-dismissable banner component for displaying important
 * system messages. Used for critical notifications like EMS dispatch status.
 *
 * Design:
 * - Full-width banner with appropriate color coding
 * - Non-dismissable (no close button)
 * - Accessible with proper ARIA attributes
 * - Supports different variants for different message types
 */
export function Banner({
  message,
  variant = "info",
  className = "",
}: BannerProps) {
  // Note: test suite asserts these exact Tailwind classes — keep them stable.
  const variantStyles: Record<string, string> = {
    info:    "bg-blue-600/90 border-blue-500 text-blue-50",
    warning: "bg-amber-600/90 border-amber-500 text-amber-50",
    error:   "bg-red-600/90 border-red-500 text-red-50",
    success: "bg-green-600/90 border-green-500 text-green-50",
  };

  return (
    <div
      className={`w-full border-l-4 px-5 py-3 shadow-sm ${variantStyles[variant]} ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center justify-center">
        <p className="text-sm font-medium text-center">{message}</p>
      </div>
    </div>
  );
}
