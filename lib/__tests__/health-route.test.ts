import { GET } from "@/app/api/health/route";
import { capturePrivateError } from "@/lib/monitoring/capture-errors";
import { createServiceSupabaseClient } from "@/lib/server-auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/monitoring/capture-errors", () => ({
	capturePrivateError: vi.fn(),
}));

vi.mock("@/lib/server-auth", () => ({
	createServiceSupabaseClient: vi.fn(),
}));

type AdminMockOptions = {
	cleanupData?: Record<string, unknown>;
	cleanupError?: unknown;
	databaseError?: unknown;
	storageErrors?: Record<string, unknown>;
};

const cleanCleanupData = {
	active: true,
	configured: true,
	healthy: true,
	last_run_status: "succeeded",
	last_run_started_at: "2026-06-05T00:00:00.000Z",
	last_success_started_at: "2026-06-05T00:00:00.000Z",
	message: "Temporary data cleanup cron job is scheduled.",
	run_history_available: true,
	schedule: "*/5 * * * *",
};

function setRequiredPushEnv() {
	vi.stubEnv("NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY", "public-key");
	vi.stubEnv("WEB_PUSH_PRIVATE_KEY", "private-key");
	vi.stubEnv("WEB_PUSH_SUBJECT", "mailto:ops@example.com");
	vi.stubEnv("PUSH_WEBHOOK_SECRET", "push-secret");
}

function createAdminMock({
	cleanupData = cleanCleanupData,
	cleanupError = null,
	databaseError = null,
	storageErrors = {},
}: AdminMockOptions = {}) {
	const databaseLimit = vi.fn(async () => ({ data: [], error: databaseError }));
	const databaseSelect = vi.fn(() => ({ limit: databaseLimit }));
	const from = vi.fn(() => ({ select: databaseSelect }));
	const getBucket = vi.fn(async (bucket: string) => ({
		data: storageErrors[bucket] ? null : { id: bucket, name: bucket },
		error: storageErrors[bucket] ?? null,
	}));
	const rpc = vi.fn(async () => ({
		data: cleanupData,
		error: cleanupError,
	}));
	const admin = {
		from,
		rpc,
		storage: { getBucket },
	};

	vi.mocked(createServiceSupabaseClient).mockReturnValue(admin as never);

	return {
		admin,
		databaseLimit,
		from,
		getBucket,
		rpc,
	};
}

describe("health route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setRequiredPushEnv();
		vi.stubEnv("NODE_ENV", "test");
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("returns ready when Supabase, storage, cleanup cron, and push config pass", async () => {
		const { getBucket, rpc } = createAdminMock();

		const response = await GET();

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(getBucket).toHaveBeenCalledTimes(4);
		expect(rpc).toHaveBeenCalledWith("get_temporary_data_cleanup_health", {
			max_success_age_seconds: 1800,
		});
		await expect(response.json()).resolves.toMatchObject({
			status: "ok",
			service: "linted",
			checks: {
				cleanup_cron: { status: "ok" },
				database: { status: "ok" },
				push_config: { status: "ok" },
				storage: { status: "ok", bucket_count: 4 },
			},
		});
	});

	it("fails readiness with a stable database message when Supabase query fails", async () => {
		createAdminMock({
			databaseError: { message: "permission denied for table profiles" },
		});

		const response = await GET();
		const payload = await response.json();

		expect(response.status).toBe(503);
		expect(payload).toMatchObject({
			status: "unhealthy",
			checks: {
				database: {
					message: "Supabase database query failed.",
					status: "fail",
				},
			},
		});
		expect(JSON.stringify(payload)).not.toContain("permission denied");
		expect(capturePrivateError).toHaveBeenCalledWith(
			expect.objectContaining({ message: "permission denied for table profiles" }),
			expect.objectContaining({ operation: "check_database" }),
		);
	});

	it("fails readiness when a required storage bucket is unavailable", async () => {
		createAdminMock({
			storageErrors: {
				"upload-quarantine": { message: "bucket not found" },
			},
		});

		const response = await GET();

		expect(response.status).toBe(503);
		await expect(response.json()).resolves.toMatchObject({
			status: "unhealthy",
			checks: {
				storage: {
					message:
						"One or more required Supabase Storage buckets are unavailable.",
					missing_bucket_count: 1,
					status: "fail",
				},
			},
		});
	});

	it("fails readiness when the cleanup cron RPC reports unhealthy state", async () => {
		createAdminMock({
			cleanupData: {
				active: true,
				configured: true,
				healthy: false,
				last_run_status: "failed",
				message: "Temporary data cleanup cron job last run failed.",
				run_history_available: true,
			},
		});

		const response = await GET();

		expect(response.status).toBe(503);
		await expect(response.json()).resolves.toMatchObject({
			checks: {
				cleanup_cron: {
					last_run_status: "failed",
					message: "Temporary data cleanup cron job last run failed.",
					status: "fail",
				},
			},
			status: "unhealthy",
		});
	});

	it("fails readiness when push delivery env is incomplete", async () => {
		vi.stubEnv("WEB_PUSH_PRIVATE_KEY", "");
		createAdminMock();

		const response = await GET();

		expect(response.status).toBe(503);
		await expect(response.json()).resolves.toMatchObject({
			checks: {
				push_config: {
					message: "Push notification delivery is not fully configured.",
					missing_count: 1,
					status: "fail",
				},
			},
			status: "unhealthy",
		});
	});

	it("fails readiness when the Supabase service client cannot be created", async () => {
		vi.mocked(createServiceSupabaseClient).mockImplementation(() => {
			throw new Error("missing service role key");
		});

		const response = await GET();
		const payload = await response.json();

		expect(response.status).toBe(503);
		expect(payload).toMatchObject({
			checks: {
				cleanup_cron: { status: "fail" },
				database: { status: "fail" },
				storage: { status: "fail" },
				push_config: { status: "ok" },
			},
			status: "unhealthy",
		});
		expect(JSON.stringify(payload)).not.toContain("missing service role key");
	});
});
