import type { Metadata } from "next";
import type { ReactNode } from "react";
import ToastProvider from "@/components/ToastProvider";
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
        <ToastProvider>
          <div className="app-root">{children}</div>
        </ToastProvider>
      </body>
    </html>
  );
}
