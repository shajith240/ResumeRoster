import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import RouteTransitionLoader from "@/components/RouteTransitionLoader";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import "./feed-canvas.css";

export const metadata: Metadata = {
  title: "ResumeRoster",
  description:
    "Post your resume anonymously, get public community roasts, and improve before recruiters see it.",
};

const themeBootstrapScript = `
try {
  var theme = window.localStorage.getItem("resumeroster-theme") === "light" ? "light" : "dark";
  document.documentElement.dataset.appTheme = theme;
} catch (error) {
  document.documentElement.dataset.appTheme = "dark";
}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <div className="app-root">{children}</div>
        <Suspense fallback={null}>
          <RouteTransitionLoader />
        </Suspense>
        <Toaster />
      </body>
    </html>
  );
}
