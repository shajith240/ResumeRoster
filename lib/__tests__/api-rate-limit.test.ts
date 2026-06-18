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

	it("uses the community post submit policy for text posts", async () => {
		const rpc = vi.fn(async () => ({
			data: [{ allowed: true, remaining: 11, retry_after_seconds: 0 }],
			error: null,
		}));

		const response = await enforceApiRateLimit(
			adminWithRpc(rpc),
			USER_ID,
			"communityPostSubmit",
		);

		expect(response).toBeNull();
		expect(rpc).toHaveBeenCalledWith("check_authenticated_action_rate_limit", {
			max_requests: 12,
			target_action: "community_post_submit",
			target_user_id: USER_ID,
			window_seconds: 600,
		});
	});

	it("uses separate policies for community images and comments", async () => {
		const rpc = vi.fn(async () => ({
			data: [{ allowed: true, remaining: 19, retry_after_seconds: 0 }],
			error: null,
		}));

		await expect(
			enforceApiRateLimit(
				adminWithRpc(rpc),
				USER_ID,
				"communityPostMediaUpload",
			),
		).resolves.toBeNull();
		await expect(
			enforceApiRateLimit(
				adminWithRpc(rpc),
				USER_ID,
				"communityCommentSubmit",
			),
		).resolves.toBeNull();

		expect(rpc).toHaveBeenCalledWith("check_authenticated_action_rate_limit", {
			max_requests: 20,
			target_action: "community_post_media_upload",
			target_user_id: USER_ID,
			window_seconds: 600,
		});
		expect(rpc).toHaveBeenCalledWith("check_authenticated_action_rate_limit", {
			max_requests: 30,
			target_action: "community_comment_submit",
			target_user_id: USER_ID,
			window_seconds: 600,
		});
	});

	it("uses the community vote write policy for post and comment votes", async () => {
		const rpc = vi.fn(async () => ({
			data: [{ allowed: true, remaining: 159, retry_after_seconds: 0 }],
			error: null,
		}));

		const response = await enforceApiRateLimit(
			adminWithRpc(rpc),
			USER_ID,
			"communityVoteWrite",
		);

		expect(response).toBeNull();
		expect(rpc).toHaveBeenCalledWith("check_authenticated_action_rate_limit", {
			max_requests: 160,
			target_action: "community_vote_write",
			target_user_id: USER_ID,
			window_seconds: 300,
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
