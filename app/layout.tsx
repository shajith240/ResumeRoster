import type { Metadata, Viewport } from "next";
import { Suspense, type ReactNode } from "react";
import RouteTransitionLoader from "@/components/RouteTransitionLoader";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import "./feed-canvas.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://linted.space"),
  title: {
    default: "Linted",
    template: "%s | Linted",
  },
  description:
    "Linted is a human-powered career linter for resumes. Post anonymously, catch structural bugs before recruiters do, and ship a cleaner version.",
  icons: {
    apple: "/assets/Linted-favicon.png",
    icon: "/assets/Linted-favicon.png",
    shortcut: "/assets/Linted-favicon.png",
  },
  openGraph: {
    title: "Linted",
    description:
      "Human-powered resume linting before the recruiter/compiler rejects it.",
    siteName: "Linted",
    type: "website",
    url: "https://linted.space",
  },
  twitter: {
    card: "summary_large_image",
    title: "Linted",
    description:
      "Human-powered resume linting before the recruiter/compiler rejects it.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const themeBootstrapScript = `
try {
  var theme = window.localStorage.getItem("linted-theme") === "light" ? "light" : "dark";
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
