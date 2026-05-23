const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN =
	/(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g;
const SENSITIVE_KEYS = [
	"authorization",
	"cookie",
	"password",
	"refresh_token",
	"service_role",
	"supabase_service_role_key",
	"token",
];

type MutableRecord = Record<string, unknown>;

function isRecord(value: unknown): value is MutableRecord {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function redactString(value: string) {
	return value
		.replace(EMAIL_PATTERN, "[redacted-email]")
		.replace(PHONE_PATTERN, "[redacted-phone]");
}

function shouldDropKey(key: string) {
	const normalized = key.toLowerCase();
	return SENSITIVE_KEYS.some((sensitiveKey) => normalized.includes(sensitiveKey));
}

function scrubValue(value: unknown, depth = 0): unknown {
	if (depth > 5) return value;

	if (typeof value === "string") {
		return redactString(value);
	}

	if (Array.isArray(value)) {
		return value.map((item) => scrubValue(item, depth + 1));
	}

	if (!isRecord(value)) return value;

	for (const [key, nestedValue] of Object.entries(value)) {
		if (shouldDropKey(key)) {
			value[key] = "[redacted]";
			continue;
		}

		value[key] = scrubValue(nestedValue, depth + 1);
	}

	return value;
}

export function getErrorMonitoringDsn() {
	return (
		process.env.NEXT_PUBLIC_ERROR_MONITORING_DSN ||
		process.env.NEXT_PUBLIC_GLITCHTIP_DSN ||
		process.env.NEXT_PUBLIC_SENTRY_DSN ||
		process.env.SENTRY_DSN ||
		""
	);
}

export function getErrorMonitoringEnvironment() {
	return (
		process.env.NEXT_PUBLIC_ERROR_MONITORING_ENVIRONMENT ||
		process.env.NEXT_PUBLIC_GLITCHTIP_ENVIRONMENT ||
		process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
		process.env.VERCEL_ENV ||
		process.env.NODE_ENV ||
		"development"
	);
}

export function getErrorMonitoringTracesSampleRate(fallback = 0.01) {
	const raw =
		process.env.NEXT_PUBLIC_ERROR_MONITORING_TRACES_SAMPLE_RATE ||
		process.env.NEXT_PUBLIC_GLITCHTIP_TRACES_SAMPLE_RATE ||
		process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ||
		process.env.SENTRY_TRACES_SAMPLE_RATE;
	const parsed = raw ? Number(raw) : fallback;

	if (!Number.isFinite(parsed)) return fallback;
	return Math.min(1, Math.max(0, parsed));
}

export function scrubErrorMonitoringEvent<T>(event: T): T {
	return scrubValue(event) as T;
}
