import type { SupabaseClient } from "@supabase/supabase-js";
import { capturePrivateError } from "@/lib/monitoring/capture-errors";
import { createServiceSupabaseClient } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CheckStatus = "fail" | "ok";

type HealthCheck = {
	duration_ms: number;
	message: string;
	status: CheckStatus;
	[key: string]: unknown;
};

type UntimedHealthCheck = {
	message: string;
	status: CheckStatus;
	[key: string]: unknown;
};

type CleanupHealth = {
	active?: boolean;
	configured?: boolean;
	healthy?: boolean;
	last_run_status?: string | null;
	last_run_started_at?: string | null;
	last_success_started_at?: string | null;
	message?: string;
	run_history_available?: boolean;
	schedule?: string | null;
};

const REQUIRED_STORAGE_BUCKETS = [
	"avatars",
	"comment-media",
	"resumes",
	"upload-quarantine",
] as const;

const REQUIRED_PUSH_ENV = [
	"NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY",
	"WEB_PUSH_PRIVATE_KEY",
	"WEB_PUSH_SUBJECT",
	"PUSH_WEBHOOK_SECRET",
] as const;

const HEALTH_CACHE_HEADERS = {
	"Cache-Control": "no-store",
};

function publicMetadata() {
	return {
		service: "linted",
		environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
		commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
		checked_at: new Date().toISOString(),
	};
}

function getElapsedMs(startedAt: number) {
	return Math.max(0, Math.round(performance.now() - startedAt));
}

async function timedCheck(
	run: () => Promise<UntimedHealthCheck>,
): Promise<HealthCheck> {
	const startedAt = performance.now();
	try {
		const result = await run();
		return {
			...result,
			duration_ms: getElapsedMs(startedAt),
		};
	} catch (error) {
		capturePrivateError(error, {
			area: "health",
			operation: "run_health_check",
			route: "GET /api/health",
		});

		return {
			duration_ms: getElapsedMs(startedAt),
			message: "Health check failed.",
			status: "fail" as const,
		};
	}
}

function getServiceClient() {
	try {
		return {
			admin: createServiceSupabaseClient(),
			error: null,
		};
	} catch (error) {
		capturePrivateError(error, {
			area: "health",
			operation: "create_service_supabase_client",
			route: "GET /api/health",
		});

		return {
			admin: null,
			error,
		};
	}
}

async function checkDatabase(admin: SupabaseClient): Promise<HealthCheck> {
	return timedCheck(async () => {
		const { error } = await admin.from("profiles").select("id").limit(1);

		if (error) {
			capturePrivateError(error, {
				area: "health",
				operation: "check_database",
				route: "GET /api/health",
			});

			return {
				message: "Supabase database query failed.",
				status: "fail",
			};
		}

		return {
			message: "Supabase database is reachable.",
			status: "ok",
		};
	});
}

async function checkStorage(admin: SupabaseClient): Promise<HealthCheck> {
	return timedCheck(async () => {
		const results = await Promise.all(
			REQUIRED_STORAGE_BUCKETS.map(async (bucket) => {
				const { error } = await admin.storage.getBucket(bucket);
				return { bucket, error };
			}),
		);
		const missingBuckets = results
			.filter((result) => result.error)
			.map((result) => result.bucket);

		if (missingBuckets.length) {
			for (const result of results) {
				if (!result.error) continue;
				capturePrivateError(result.error, {
					area: "health",
					bucket: result.bucket,
					operation: "check_storage_bucket",
					route: "GET /api/health",
				});
			}

			return {
				bucket_count: REQUIRED_STORAGE_BUCKETS.length,
				message: "One or more required Supabase Storage buckets are unavailable.",
				missing_bucket_count: missingBuckets.length,
				status: "fail",
			};
		}

		return {
			bucket_count: REQUIRED_STORAGE_BUCKETS.length,
			message: "Required Supabase Storage buckets are reachable.",
			status: "ok",
		};
	});
}

function firstCleanupHealth(data: CleanupHealth | CleanupHealth[] | null) {
	if (Array.isArray(data)) return data[0] ?? null;
	return data;
}

async function checkCleanupCron(admin: SupabaseClient): Promise<HealthCheck> {
	return timedCheck(async () => {
		const { data, error } = await admin.rpc(
			"get_temporary_data_cleanup_health",
			{
				max_success_age_seconds: 1800,
			},
		);

		if (error) {
			capturePrivateError(error, {
				area: "health",
				operation: "check_cleanup_cron",
				route: "GET /api/health",
			});

			return {
				message: "Temporary data cleanup health check failed.",
				status: "fail",
			};
		}

		const cleanup = firstCleanupHealth(data as CleanupHealth | CleanupHealth[] | null);
		if (!cleanup?.healthy) {
			return {
				active: Boolean(cleanup?.active),
				configured: Boolean(cleanup?.configured),
				last_run_status: cleanup?.last_run_status ?? null,
				message:
					cleanup?.message ??
					"Temporary data cleanup cron job is not healthy.",
				run_history_available: Boolean(cleanup?.run_history_available),
				status: "fail",
			};
		}

		return {
			active: Boolean(cleanup.active),
			configured: Boolean(cleanup.configured),
			last_run_status: cleanup.last_run_status ?? null,
			last_run_started_at: cleanup.last_run_started_at ?? null,
			last_success_started_at: cleanup.last_success_started_at ?? null,
			message: cleanup.message ?? "Temporary data cleanup cron job is healthy.",
			run_history_available: Boolean(cleanup.run_history_available),
			status: "ok",
		};
	});
}

async function checkPushConfig(): Promise<HealthCheck> {
	return timedCheck(async () => {
		const missingCount = REQUIRED_PUSH_ENV.filter(
			(key) => !process.env[key]?.trim(),
		).length;

		if (missingCount) {
			return {
				message: "Push notification delivery is not fully configured.",
				missing_count: missingCount,
				required_count: REQUIRED_PUSH_ENV.length,
				status: "fail",
			};
		}

		return {
			message: "Push notification delivery is configured.",
			required_count: REQUIRED_PUSH_ENV.length,
			status: "ok",
		};
	});
}

function skippedCheck(message: string): HealthCheck {
	return {
		duration_ms: 0,
		message,
		status: "fail",
	};
}

export async function GET() {
	const startedAt = performance.now();
	const { admin } = getServiceClient();

	const checks = admin
		? {
				database: await checkDatabase(admin),
				storage: await checkStorage(admin),
				cleanup_cron: await checkCleanupCron(admin),
				push_config: await checkPushConfig(),
			}
		: {
				database: skippedCheck("Supabase service client is not configured."),
				storage: skippedCheck("Supabase service client is not configured."),
				cleanup_cron: skippedCheck("Supabase service client is not configured."),
				push_config: await checkPushConfig(),
			};
	const healthy = Object.values(checks).every((check) => check.status === "ok");

	return Response.json(
		{
			status: healthy ? "ok" : "unhealthy",
			...publicMetadata(),
			duration_ms: getElapsedMs(startedAt),
			checks,
		},
		{
			headers: HEALTH_CACHE_HEADERS,
			status: healthy ? 200 : 503,
		},
	);
}
