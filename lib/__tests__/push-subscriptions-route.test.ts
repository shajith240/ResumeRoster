import {
	DELETE,
	POST,
} from "@/app/api/push/subscriptions/route";
import { internalErrorResponse } from "@/lib/api-errors";
import { requireSignedInUser } from "@/lib/server-auth";
import { enforceApiRateLimit } from "@/lib/server/rate-limit";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-errors", () => ({
	internalErrorResponse: vi.fn(
		(_error: unknown, options: { publicMessage: string }) =>
			Response.json({ message: options.publicMessage }, { status: 500 }),
	),
}));

vi.mock("@/lib/server-auth", () => ({
	requireSignedInUser: vi.fn(),
	serverAuthErrorResponse: vi.fn(() =>
		Response.json({ message: "Request failed." }, { status: 500 }),
	),
}));

vi.mock("@/lib/server/rate-limit", () => ({
	enforceApiRateLimit: vi.fn(),
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";

function jsonRequest(method: "DELETE" | "POST", body: unknown) {
	return new Request("https://linted.test/api/push/subscriptions", {
		body: JSON.stringify(body),
		headers: {
			"Content-Type": "application/json",
			"User-Agent": "Vitest Browser",
		},
		method,
	});
}

function pushPayload() {
	return {
		endpoint: "https://push.example.com/subscription/abc",
		expirationTime: null,
		keys: {
			auth: "auth-token-long-enough",
			p256dh: "p256dh-token-long-enough-for-validation",
		},
	};
}

function mockSignedInUser({
	activeSubscriptionCount = 0,
	activeSubscriptionCountError = null,
	notificationPreferenceError = null,
	pushSubscriptionRevokeError = null,
	pushSubscriptionUpsertError = null,
}: {
	activeSubscriptionCount?: number;
	activeSubscriptionCountError?: unknown;
	notificationPreferenceError?: unknown;
	pushSubscriptionRevokeError?: unknown;
	pushSubscriptionUpsertError?: unknown;
} = {}) {
	const notificationPreferenceUpsert = vi.fn(async () => ({
		data: null,
		error: notificationPreferenceError,
	}));
	const pushSubscriptionUpsert = vi.fn(async () => ({
		data: null,
		error: pushSubscriptionUpsertError,
	}));
	const pushSubscriptionUpdate = vi.fn(() => ({
		eq: vi.fn(() => ({
			is: vi.fn(() => ({
				eq: vi.fn(async () => ({
					data: null,
					error: pushSubscriptionRevokeError,
				})),
				error: pushSubscriptionRevokeError,
			})),
		})),
	}));
	const pushSubscriptionSelect = vi.fn(() => ({
		eq: vi.fn(() => ({
			is: vi.fn(async () => ({
				count: activeSubscriptionCount,
				data: null,
				error: activeSubscriptionCountError,
			})),
		})),
	}));
	const from = vi.fn((table: string) => {
		if (table === "notification_preferences") {
			return { upsert: notificationPreferenceUpsert };
		}

		return {
			select: pushSubscriptionSelect,
			update: pushSubscriptionUpdate,
			upsert: pushSubscriptionUpsert,
		};
	});

	vi.mocked(requireSignedInUser).mockResolvedValue({
		admin: { from } as never,
		user: { id: USER_ID } as never,
	});

	return {
		from,
		notificationPreferenceUpsert,
		pushSubscriptionSelect,
		pushSubscriptionUpdate,
		pushSubscriptionUpsert,
	};
}

describe("push subscription route rate limits", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(enforceApiRateLimit).mockResolvedValue(null);
	});

	it("checks the DB-backed churn limit before saving a push subscription", async () => {
		const { pushSubscriptionUpsert } = mockSignedInUser();

		const response = await POST(jsonRequest("POST", pushPayload()));

		expect(response.status).toBe(200);
		expect(enforceApiRateLimit).toHaveBeenCalledWith(
			expect.anything(),
			USER_ID,
			"pushSubscriptionWrite",
		);
		expect(pushSubscriptionUpsert).toHaveBeenCalledTimes(1);
	});

	it("fails enable when push preference upsert fails", async () => {
		const { notificationPreferenceUpsert, pushSubscriptionUpsert } =
			mockSignedInUser({
				notificationPreferenceError: {
					message: "insert violates notification_preferences_user_id_fkey",
				},
			});

		const response = await POST(jsonRequest("POST", pushPayload()));

		expect(response.status).toBe(500);
		expect(pushSubscriptionUpsert).toHaveBeenCalledTimes(1);
		expect(notificationPreferenceUpsert).toHaveBeenCalledWith(
			expect.objectContaining({
				push_enabled: true,
				user_id: USER_ID,
			}),
			{ onConflict: "user_id" },
		);
		expect(internalErrorResponse).toHaveBeenCalledWith(
			expect.objectContaining({
				message: "insert violates notification_preferences_user_id_fkey",
			}),
			expect.objectContaining({
				publicMessage: "Could not enable push notifications.",
			}),
		);
		await expect(response.json()).resolves.toEqual({
			message: "Could not enable push notifications.",
		});
	});

	it("stops over-quota push subscription writes before DB upserts", async () => {
		const { pushSubscriptionUpsert } = mockSignedInUser();
		vi.mocked(enforceApiRateLimit).mockResolvedValue(
			Response.json(
				{ message: "Too many device alert changes. Try again soon." },
				{ status: 429 },
			),
		);

		const response = await POST(jsonRequest("POST", pushPayload()));

		expect(response.status).toBe(429);
		expect(pushSubscriptionUpsert).not.toHaveBeenCalled();
		await expect(response.json()).resolves.toEqual({
			message: "Too many device alert changes. Try again soon.",
		});
	});

	it("rate limits unsubscribe churn before updating subscriptions", async () => {
		const from = vi.fn();
		vi.mocked(requireSignedInUser).mockResolvedValue({
			admin: { from } as never,
			user: { id: USER_ID } as never,
		});
		vi.mocked(enforceApiRateLimit).mockResolvedValue(
			Response.json(
				{ message: "Too many device alert changes. Try again soon." },
				{ status: 429 },
			),
		);

		const response = await DELETE(jsonRequest("DELETE", {}));

		expect(response.status).toBe(429);
		expect(enforceApiRateLimit).toHaveBeenCalledWith(
			expect.anything(),
			USER_ID,
			"pushSubscriptionWrite",
		);
		expect(from).not.toHaveBeenCalled();
	});

	it("fails disable when active subscription count cannot be verified", async () => {
		const { notificationPreferenceUpsert, pushSubscriptionUpdate } =
			mockSignedInUser({
				activeSubscriptionCountError: {
					message: "permission denied for table push_subscriptions",
				},
			});

		const response = await DELETE(jsonRequest("DELETE", {}));

		expect(response.status).toBe(500);
		expect(pushSubscriptionUpdate).toHaveBeenCalledTimes(1);
		expect(notificationPreferenceUpsert).not.toHaveBeenCalled();
		await expect(response.json()).resolves.toEqual({
			message: "Could not verify push notification settings.",
		});
	});

	it("fails disable when final push preference upsert fails", async () => {
		const { notificationPreferenceUpsert, pushSubscriptionUpdate } =
			mockSignedInUser({
				activeSubscriptionCount: 0,
				notificationPreferenceError: {
					message: "duplicate key value violates unique constraint",
				},
			});

		const response = await DELETE(jsonRequest("DELETE", {}));

		expect(response.status).toBe(500);
		expect(pushSubscriptionUpdate).toHaveBeenCalledTimes(1);
		expect(notificationPreferenceUpsert).toHaveBeenCalledWith(
			expect.objectContaining({
				push_enabled: false,
				user_id: USER_ID,
			}),
			{ onConflict: "user_id" },
		);
		await expect(response.json()).resolves.toEqual({
			message: "Could not disable push notifications.",
		});
	});
});
