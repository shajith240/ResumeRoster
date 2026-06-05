import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
	buildContentSecurityPolicy,
	buildSecurityHeaders,
	buildStaticSecurityHeaders,
	getThemeBootstrapCspHash,
} from "@/lib/security/headers";
import {
	THEME_BOOTSTRAP_CSP_HASH,
	THEME_BOOTSTRAP_SCRIPT,
} from "@/lib/security/theme-bootstrap";

function getCspDirective(policy: string, directive: string) {
	return (
		policy
			.split(";")
			.map((entry) => entry.trim())
			.find((entry) => entry.startsWith(`${directive} `)) ?? ""
	);
}

describe("security headers", () => {
	it("keeps the checked-in theme bootstrap hash in sync with the script", () => {
		const actualHash = `sha256-${createHash("sha256")
			.update(THEME_BOOTSTRAP_SCRIPT)
			.digest("base64")}`;

		expect(THEME_BOOTSTRAP_CSP_HASH).toBe(actualHash);
		expect(getThemeBootstrapCspHash()).toBe(actualHash);
	});

	it("uses a nonce for Next scripts without opening all inline scripts", () => {
		const policy = buildContentSecurityPolicy({
			env: {
				NEXT_PUBLIC_ERROR_MONITORING_DSN:
					"https://public@example.ingest.sentry.io/1",
				NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
			},
			isDevelopment: false,
			nonce: "test-nonce",
		});
		const scriptDirective = getCspDirective(policy, "script-src");

		expect(scriptDirective).toContain("'nonce-test-nonce'");
		expect(scriptDirective).toContain(`'${getThemeBootstrapCspHash()}'`);
		expect(scriptDirective).toContain("'strict-dynamic'");
		expect(scriptDirective).toContain("'wasm-unsafe-eval'");
		expect(scriptDirective).not.toContain("'unsafe-inline'");
		expect(scriptDirective).not.toContain("'unsafe-eval'");
		expect(policy).toContain("upgrade-insecure-requests");
	});

	it("keeps local development compatible with Next diagnostics", () => {
		const policy = buildContentSecurityPolicy({
			env: {},
			isDevelopment: true,
			nonce: "dev-nonce",
		});
		const scriptDirective = getCspDirective(policy, "script-src");

		expect(scriptDirective).toContain("'nonce-dev-nonce'");
		expect(scriptDirective).toContain("'unsafe-eval'");
		expect(scriptDirective).not.toContain("'unsafe-inline'");
		expect(policy).not.toContain("upgrade-insecure-requests");
	});

	it("emits the production security header set", () => {
		const headers = buildSecurityHeaders({
			env: {
				NEXT_PUBLIC_ERROR_MONITORING_DSN:
					"https://public@example.ingest.sentry.io/1",
				NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
			},
			isDevelopment: false,
			nonce: "test-nonce",
		});
		const values = new Map(headers.map((header) => [header.key, header.value]));

		expect(values.get("Content-Security-Policy")).toContain(
			"frame-ancestors 'none'",
		);
		expect(values.get("Strict-Transport-Security")).toBe(
			"max-age=63072000; includeSubDomains",
		);
		expect(values.get("X-Frame-Options")).toBe("DENY");
		expect(values.get("X-Content-Type-Options")).toBe("nosniff");
		expect(values.get("Referrer-Policy")).toBe(
			"strict-origin-when-cross-origin",
		);
		expect(values.get("Permissions-Policy")).toContain("camera=()");
	});

	it("keeps CSP out of the static header set used for assets and APIs", () => {
		const headers = buildStaticSecurityHeaders();

		expect(headers.some((header) => header.key === "Content-Security-Policy")).toBe(
			false,
		);
		expect(headers.some((header) => header.key === "Strict-Transport-Security")).toBe(
			true,
		);
	});
});
