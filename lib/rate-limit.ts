import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ServerAuthError } from "@/lib/server-auth";

type RateLimitRow = {
	allowed: boolean;
	remaining: number;
	retry_after_seconds: number;
};

export type RateLimitOptions = {
	action: string;
	limit: number;
	request: Request;
	userId?: string | null;
	windowSeconds: number;
};

function getClientIp(request: Request) {
	const forwardedFor = request.headers.get("x-forwarded-for");
	const firstForwardedIp = forwardedFor?.split(",")[0]?.trim();

	return (
		request.headers.get("cf-connecting-ip")?.trim() ||
		request.headers.get("x-real-ip")?.trim() ||
		firstForwardedIp ||
		"unknown"
	);
}

function hashRateLimitSubject(value: string) {
	const salt =
		process.env.RATE_LIMIT_SALT ||
		process.env.SUPABASE_SERVICE_ROLE_KEY ||
		"linted-rate-limit";

	return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

function getRateLimitKey(request: Request, userId?: string | null) {
	const subject = userId ? `user:${userId}` : `ip:${getClientIp(request)}`;
	return hashRateLimitSubject(subject);
}

function getRateLimitRow(data: unknown): RateLimitRow | null {
	if (Array.isArray(data)) return (data[0] as RateLimitRow | undefined) ?? null;
	if (data && typeof data === "object") return data as RateLimitRow;
	return null;
}

export async function enforceRateLimit(
	admin: SupabaseClient,
	{ action, limit, request, userId, windowSeconds }: RateLimitOptions,
) {
	const { data, error } = await admin.rpc("check_rate_limit", {
		max_requests: limit,
		target_action: action,
		target_rate_key: getRateLimitKey(request, userId),
		window_seconds: windowSeconds,
	});

	if (error) {
		console.error("Rate limit check failed", {
			action,
			code: error.code,
			message: error.message,
		});
		throw new ServerAuthError(
			"Request protection is unavailable. Try again soon.",
			503,
		);
	}

	const row = getRateLimitRow(data);
	if (!row?.allowed) {
		throw new ServerAuthError("Too many requests. Try again soon.", 429);
	}

	return row;
}
