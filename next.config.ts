import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildStaticSecurityHeaders } from "./lib/security/headers";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const shouldUploadErrorMonitoringSourceMaps = Boolean(
	process.env.ERROR_MONITORING_AUTH_TOKEN &&
		process.env.ERROR_MONITORING_ORG &&
		process.env.ERROR_MONITORING_PROJECT &&
		process.env.ERROR_MONITORING_URL,
);

// Supabase project URL — used to allowlist image and preconnect domains.
// Falls back gracefully if the env var is not set (e.g. during local dev without .env).
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
	? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
	: null;

const nextConfig: NextConfig = {
	eslint: {
		// CI runs `npm run lint` with the flat ESLint config. Skipping Next's
		// build-time lint avoids duplicate linting and its legacy plugin detector.
		ignoreDuringBuilds: true,
	},
	images: {
		// Allow Next.js <Image> to serve optimised (WebP/AVIF) avatars from Supabase Storage.
		remotePatterns: supabaseHostname
			? [{ protocol: "https", hostname: supabaseHostname }]
			: [],
		// Generate AVIF first (smaller), then WebP as fallback.
		formats: ["image/avif", "image/webp"],
	},
	async headers() {
		const securityHeaders = buildStaticSecurityHeaders();

		// Preconnect to Supabase so the TCP+TLS handshake is already done when
		// the first query fires. This shaves ~150-300 ms off cold-start loads.
		const preconnectHeaders = supabaseHostname
			? [
					{
						key: "Link",
						value: `<https://${supabaseHostname}>; rel=preconnect`,
					},
				]
			: [];

		return [
			{
				source: "/(.*)",
				headers: [...securityHeaders, ...preconnectHeaders],
			},
		];
	},
	outputFileTracingRoot: join(projectRoot),
	serverExternalPackages: ["mupdf"],
	webpack(config) {
		config.ignoreWarnings = [
			...(config.ignoreWarnings ?? []),
			{
				message:
					/Critical dependency: the request of a dependency is an expression/,
				module: /@opentelemetry[\\/]instrumentation/,
			},
		];
		return config;
	},
};

export default shouldUploadErrorMonitoringSourceMaps
	? withSentryConfig(nextConfig, {
			org: process.env.ERROR_MONITORING_ORG,
			project: process.env.ERROR_MONITORING_PROJECT,
			authToken: process.env.ERROR_MONITORING_AUTH_TOKEN,
			// sentryUrl is omitted — newer auth tokens embed the org URL automatically.
			silent: !process.env.CI,
			widenClientFileUpload: true,
			bundleSizeOptimizations: {
				excludeDebugStatements: true,
			},
		})
	: nextConfig;
