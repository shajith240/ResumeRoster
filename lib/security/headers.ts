import { THEME_BOOTSTRAP_CSP_HASH } from "./theme-bootstrap";

export type SecurityHeader = {
	key: string;
	value: string;
};

type HeaderEnvironment = Record<string, string | undefined>;

type SecurityHeaderOptions = {
	env?: HeaderEnvironment;
	isDevelopment?: boolean;
	nonce?: string;
};

const HSTS_TWO_YEARS_SECONDS = 63_072_000;

function unique(values: string[]) {
	return Array.from(new Set(values.filter(Boolean)));
}

function getOrigin(value: string | undefined) {
	if (!value) return null;

	try {
		return new URL(value).origin;
	} catch {
		return null;
	}
}

function getWebSocketOrigin(origin: string | null) {
	if (!origin) return null;

	try {
		const url = new URL(origin);

		if (url.protocol === "https:") {
			return `wss://${url.host}`;
		}

		if (url.protocol === "http:") {
			return `ws://${url.host}`;
		}
	} catch {
		return null;
	}

	return null;
}

function getErrorMonitoringOrigin(env: HeaderEnvironment) {
	return getOrigin(
		env.NEXT_PUBLIC_ERROR_MONITORING_DSN ??
			env.NEXT_PUBLIC_GLITCHTIP_DSN ??
			env.NEXT_PUBLIC_SENTRY_DSN ??
			env.SENTRY_DSN,
	);
}

function serializeDirectives(directives: Array<[string, string[]]>) {
	return directives
		.map(([directive, values]) => {
			const serializedValues = unique(values).join(" ");
			return serializedValues
				? `${directive} ${serializedValues}`
				: directive;
		})
		.join("; ");
}

export function getThemeBootstrapCspHash() {
	return THEME_BOOTSTRAP_CSP_HASH;
}

export function buildContentSecurityPolicy(options: SecurityHeaderOptions = {}) {
	const env = options.env ?? process.env;
	const isDevelopment =
		options.isDevelopment ?? process.env.NODE_ENV !== "production";
	const supabaseOrigin = getOrigin(env.NEXT_PUBLIC_SUPABASE_URL);
	const supabaseRealtimeOrigin = getWebSocketOrigin(supabaseOrigin);
	const errorMonitoringOrigin = getErrorMonitoringOrigin(env);
	const developmentScriptSources = isDevelopment ? ["'unsafe-eval'"] : [];
	const developmentConnectSources = isDevelopment
		? ["http:", "ws:", "http://localhost:*", "ws://localhost:*"]
		: [];
	const webAssemblyScriptSources = ["'wasm-unsafe-eval'"];
	const nonceSource = options.nonce ? [`'nonce-${options.nonce}'`] : [];
	const strictDynamicSource = options.nonce ? ["'strict-dynamic'"] : [];
	const productionOnlyDirectives = isDevelopment
		? []
		: ([["upgrade-insecure-requests", []]] as Array<[string, string[]]>);

	return serializeDirectives([
		["default-src", ["'self'"]],
		[
			"script-src",
			[
				"'self'",
				...nonceSource,
				`'${getThemeBootstrapCspHash()}'`,
				...strictDynamicSource,
				...webAssemblyScriptSources,
				...developmentScriptSources,
			],
		],
		[
			"style-src",
			["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
		],
		["img-src", ["'self'", "data:", "blob:", "https:"]],
		["font-src", ["'self'", "data:", "https://fonts.gstatic.com"]],
		[
			"connect-src",
			[
				"'self'",
				"https://*.supabase.co",
				"wss://*.supabase.co",
				"https://*.ingest.sentry.io",
				"https://*.sentry.io",
				supabaseOrigin ?? "",
				supabaseRealtimeOrigin ?? "",
				errorMonitoringOrigin ?? "",
				...developmentConnectSources,
			],
		],
		["media-src", ["'self'", "data:", "blob:", "https:"]],
		["worker-src", ["'self'", "blob:"]],
		["manifest-src", ["'self'"]],
		["frame-src", ["'none'"]],
		["object-src", ["'none'"]],
		["base-uri", ["'self'"]],
		["form-action", ["'self'"]],
		["frame-ancestors", ["'none'"]],
		...productionOnlyDirectives,
	]);
}

export function buildStaticSecurityHeaders(): SecurityHeader[] {
	return [
		{
			key: "Strict-Transport-Security",
			value: `max-age=${HSTS_TWO_YEARS_SECONDS}; includeSubDomains`,
		},
		{ key: "X-Frame-Options", value: "DENY" },
		{ key: "X-Content-Type-Options", value: "nosniff" },
		{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
		{
			key: "Permissions-Policy",
			value:
				"accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), usb=(), fullscreen=(self), publickey-credentials-get=(self), web-share=(self), browsing-topics=()",
		},
		{ key: "X-DNS-Prefetch-Control", value: "on" },
		{ key: "X-Permitted-Cross-Domain-Policies", value: "none" },
	];
}

export function buildSecurityHeaders(
	options: SecurityHeaderOptions = {},
): SecurityHeader[] {
	return [
		{
			key: "Content-Security-Policy",
			value: buildContentSecurityPolicy(options),
		},
		...buildStaticSecurityHeaders(),
	];
}
