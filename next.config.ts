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

const nextConfig: NextConfig = {
	eslint: {
		// CI runs `npm run lint` with the flat ESLint config. Skipping Next's
		// build-time lint avoids duplicate linting and its legacy plugin detector.
		ignoreDuringBuilds: true,
	},
	async headers() {
		return [
			{
				source: "/(.*)",
				headers: buildStaticSecurityHeaders(),
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
			sentryUrl: process.env.ERROR_MONITORING_URL,
			silent: !process.env.CI,
			widenClientFileUpload: true,
			disableLogger: true,
		})
	: nextConfig;
