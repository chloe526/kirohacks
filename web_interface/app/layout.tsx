import type { Metadata } from "next";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Chansey Care - Remote Robot Healthcare",
  description:
    "Real-time patient monitoring and clinician control interface for remote robot healthcare",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
