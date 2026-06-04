import type { SupabaseClient } from "@supabase/supabase-js";
import { capturePrivateError } from "@/lib/monitoring/capture-errors";

export const API_RATE_LIMIT_POLICIES = {
	avatarUpload: {
		action: "avatar_upload",
		maxRequests: 20,
		publicMessage: "Too many profile image uploads. Try again later.",
		windowSeconds: 3600,
	},
	commentMediaUpload: {
		action: "comment_media_upload",
		maxRequests: 20,
		publicMessage: "Too many image uploads. Try again soon.",
		windowSeconds: 600,
	},
	pushSubscriptionWrite: {
		action: "push_subscription_write",
		maxRequests: 60,
		publicMessage: "Too many device alert changes. Try again soon.",
		windowSeconds: 3600,
	},
	resumeSubmit: {
		action: "resume_pdf_submit",
		maxRequests: 8,
		publicMessage: "Too many resume uploads. Try again later.",
		windowSeconds: 3600,
	},
	reviewerApplicationSubmit: {
		action: "reviewer_application_submit",
		maxRequests: 8,
		publicMessage: "Too many reviewer applications. Try again later.",
		windowSeconds: 3600,
	},
} as const;

export type ApiRateLimitPolicyName = keyof typeof API_RATE_LIMIT_POLICIES;

type RateLimitRow = {
	allowed: boolean | null;
	remaining: number | null;
	retry_after_seconds: number | null;
};

function firstRateLimitRow(data: RateLimitRow | RateLimitRow[] | null) {
	if (Array.isArray(data)) return data[0] ?? null;
	return data;
}

function positiveInteger(value: unknown, fallback: number) {
	const parsed = typeof value === "number" ? value : Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? Math.ceil(parsed) : fallback;
}

function rateLimiterUnavailableResponse() {
	return Response.json(
		{ message: "Request temporarily unavailable. Please try again." },
		{ status: 503 },
	);
}

function rateLimitedResponse(
	policy: (typeof API_RATE_LIMIT_POLICIES)[ApiRateLimitPolicyName],
	row: RateLimitRow,
) {
	const retryAfterSeconds = positiveInteger(
		row.retry_after_seconds,
		policy.windowSeconds,
	);
	const headers = new Headers({
		"Retry-After": String(retryAfterSeconds),
		"X-RateLimit-Remaining": "0",
	});

	return Response.json({ message: policy.publicMessage }, { headers, status: 429 });
}

export async function enforceApiRateLimit(
	admin: SupabaseClient,
	userId: string,
	policyName: ApiRateLimitPolicyName,
) {
	const policy = API_RATE_LIMIT_POLICIES[policyName];
	const { data, error } = await admin.rpc("check_authenticated_action_rate_limit", {
		max_requests: policy.maxRequests,
		target_action: policy.action,
		target_user_id: userId,
		window_seconds: policy.windowSeconds,
	});

	if (error) {
		capturePrivateError(error, {
			area: "abuse_controls",
			operation: "check_api_rate_limit",
			route: policy.action,
		});
		return rateLimiterUnavailableResponse();
	}

	const row = firstRateLimitRow(data as RateLimitRow | RateLimitRow[] | null);
	if (!row) {
		capturePrivateError(new Error("Rate limit RPC returned no result."), {
			area: "abuse_controls",
			operation: "check_api_rate_limit",
			route: policy.action,
		});
		return rateLimiterUnavailableResponse();
	}

	if (!row.allowed) {
		return rateLimitedResponse(policy, row);
	}

	return null;
}
