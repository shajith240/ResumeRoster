import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import "./feed-canvas.css";

export const metadata: Metadata = {
  title: "ResumeRoster",
  description:
    "Post your resume anonymously, get public community roasts, and improve before recruiters see it.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <div className="app-root">{children}</div>
        <Toaster />
      </body>
    </html>
  );
}
