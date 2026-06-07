import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Suspense, type ReactNode } from "react";
import RouteTransitionLoader from "@/components/RouteTransitionLoader";
import { Toaster } from "@/components/ui/sonner";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/security/theme-bootstrap";
import "./globals.css";
import "./notifications.css";
import "./feed.css";
import "./admin.css";

const lintyFaviconPath = "/assets/linty-favicon.png";

export const metadata: Metadata = {
  metadataBase: new URL("https://linted.space"),
  manifest: "/manifest.webmanifest",
  title: {
    default: "Linted",
    template: "%s | Linted",
  },
  description:
    "Linted is a human-powered career linter for resumes. Post anonymously, catch structural bugs before recruiters do, and ship a cleaner version.",
  icons: {
    apple: [
      {
        url: lintyFaviconPath,
        sizes: "750x750",
        type: "image/png",
      },
    ],
    icon: [
      {
        url: lintyFaviconPath,
        sizes: "750x750",
        type: "image/png",
      },
    ],
    shortcut: [
      {
        url: lintyFaviconPath,
        sizes: "750x750",
        type: "image/png",
      },
    ],
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  // Keep the layout dynamic so middleware-generated CSP nonces are available
  // to Next-managed scripts. The manual theme bootstrap is allowed by hash.
  await headers();

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }}
        />
        <div className="app-root">{children}</div>
        <Suspense fallback={null}>
          <RouteTransitionLoader />
        </Suspense>
        <Toaster />
      </body>
    </html>
  );
}
