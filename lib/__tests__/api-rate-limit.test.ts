import { enforceApiRateLimit } from "@/lib/server/rate-limit";
import { capturePrivateError } from "@/lib/monitoring/capture-errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/monitoring/capture-errors", () => ({
	capturePrivateError: vi.fn(),
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";

function adminWithRpc(rpc: ReturnType<typeof vi.fn>) {
	return { rpc } as never;
}

describe("API rate limit guard", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("allows requests when the DB quota has capacity", async () => {
		const rpc = vi.fn(async () => ({
			data: [{ allowed: true, remaining: 7, retry_after_seconds: 0 }],
			error: null,
		}));

		const response = await enforceApiRateLimit(
			adminWithRpc(rpc),
			USER_ID,
			"resumeSubmit",
		);

		expect(response).toBeNull();
		expect(rpc).toHaveBeenCalledWith("check_authenticated_action_rate_limit", {
			max_requests: 8,
			target_action: "resume_pdf_submit",
			target_user_id: USER_ID,
			window_seconds: 3600,
		});
	});

	it("returns 429 with Retry-After when the DB quota is exhausted", async () => {
		const rpc = vi.fn(async () => ({
			data: [{ allowed: false, remaining: 0, retry_after_seconds: 90 }],
			error: null,
		}));

		const response = await enforceApiRateLimit(
			adminWithRpc(rpc),
			USER_ID,
			"commentMediaUpload",
		);

		expect(response?.status).toBe(429);
		expect(response?.headers.get("Retry-After")).toBe("90");
		await expect(response?.json()).resolves.toEqual({
			message: "Too many image uploads. Try again soon.",
		});
	});

	it("fails closed with a stable message when the limiter RPC fails", async () => {
		const rpc = vi.fn(async () => ({
			data: null,
			error: { message: "function does not exist" },
		}));

		const response = await enforceApiRateLimit(
			adminWithRpc(rpc),
			USER_ID,
			"pushSubscriptionWrite",
		);

		expect(response?.status).toBe(503);
		expect(capturePrivateError).toHaveBeenCalledWith(
			expect.objectContaining({ message: "function does not exist" }),
			expect.objectContaining({
				area: "abuse_controls",
				operation: "check_api_rate_limit",
				route: "push_subscription_write",
			}),
		);
		await expect(response?.json()).resolves.toEqual({
			message: "Request temporarily unavailable. Please try again.",
		});
	});
});
