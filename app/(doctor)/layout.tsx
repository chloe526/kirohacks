import "../globals.css";
import { ToastContainer } from "@/components/ui/ToastContainer";

export const metadata = {
  title: "Remote Robot Healthcare",
  description: "Clinical remote monitoring and robot control interface",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
        <ToastContainer />
      </body>
    </html>
  );
}