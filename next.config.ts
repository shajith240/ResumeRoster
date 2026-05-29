import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const shouldUploadErrorMonitoringSourceMaps = Boolean(
	process.env.ERROR_MONITORING_AUTH_TOKEN &&
		process.env.ERROR_MONITORING_ORG &&
		process.env.ERROR_MONITORING_PROJECT &&
		process.env.ERROR_MONITORING_URL,
);

function getOrigin(value: string | undefined) {
	if (!value) return "";

	try {
		return new URL(value).origin;
	} catch {
		return "";
	}
}

const supabaseOrigin = getOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
const errorMonitoringOrigin = getOrigin(process.env.ERROR_MONITORING_URL);
const scriptSources = [
	"'self'",
	"'unsafe-inline'",
	process.env.NODE_ENV !== "production" ? "'unsafe-eval'" : "",
].filter(Boolean);
const connectSources = [
	"'self'",
	supabaseOrigin,
	supabaseOrigin ? supabaseOrigin.replace("https://", "wss://") : "",
	errorMonitoringOrigin,
	"https://*.ingest.sentry.io",
].filter(Boolean);
const fontSources = ["'self'", "data:", "https://fonts.gstatic.com"];
const styleSources = ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"];

const contentSecurityPolicy = [
	"default-src 'self'",
	"base-uri 'self'",
	"object-src 'none'",
	"frame-ancestors 'none'",
	"form-action 'self'",
	"img-src 'self' data: blob: https:",
	`font-src ${fontSources.join(" ")}`,
	`style-src ${styleSources.join(" ")}`,
	`script-src ${scriptSources.join(" ")}`,
	"worker-src 'self' blob:",
	`connect-src ${connectSources.join(" ")}`,
	"frame-src 'self'",
	"upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
	{
		key: "Content-Security-Policy",
		value: contentSecurityPolicy,
	},
	{
		key: "Referrer-Policy",
		value: "strict-origin-when-cross-origin",
	},
	{
		key: "X-Content-Type-Options",
		value: "nosniff",
	},
	{
		key: "X-Frame-Options",
		value: "DENY",
	},
	{
		key: "Permissions-Policy",
		value:
			"camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
	},
	{
		key: "Strict-Transport-Security",
		value: "max-age=31536000; includeSubDomains; preload",
	},
];

const nextConfig: NextConfig = {
	async headers() {
		return [
			{
				source: "/(.*)",
				headers: securityHeaders,
			},
		];
	},
	outputFileTracingRoot: join(projectRoot),
	poweredByHeader: false,
	serverExternalPackages: ["mupdf"],
};

export default shouldUploadErrorMonitoringSourceMaps
	? withSentryConfig(nextConfig, {
			org: process.env.ERROR_MONITORING_ORG,
			project: process.env.ERROR_MONITORING_PROJECT,
			authToken: process.env.ERROR_MONITORING_AUTH_TOKEN,
			sentryUrl: process.env.ERROR_MONITORING_URL,
			silent: !process.env.CI,
			widenClientFileUpload: true,
			disableLogger: true,
		})
	: nextConfig;
