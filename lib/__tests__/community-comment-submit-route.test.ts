import { createClient } from "@supabase/supabase-js";
import { POST } from "@/app/api/community/comments/submit/route";
import { enforceApiRateLimit } from "@/lib/server/rate-limit";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@supabase/supabase-js", () => ({
	createClient: vi.fn(),
}));

vi.mock("@/lib/server/rate-limit", () => ({
	enforceApiRateLimit: vi.fn(),
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const POST_ID = "22222222-2222-4222-8222-222222222222";
const ATTACHMENT_ID = "44444444-4444-4444-8444-444444444444";

function communityCommentRequest(body: Record<string, unknown>) {
	return new Request("https://linted.test/api/community/comments/submit", {
		body: JSON.stringify(body),
		headers: {
			Authorization: "Bearer session-token",
			"Content-Type": "application/json",
		},
		method: "POST",
	});
}

function mockAdmin(
	rpcResult: {
		data: Array<{ id: string; status?: string }>;
		error: { message: string } | null;
	} = { data: [{ id: "comment-1" }], error: null },
) {
	const rpc = vi.fn(async () => rpcResult);
	const admin = {
		auth: {
			getUser: vi.fn(async () => ({
				data: {
					user: {
						id: USER_ID,
					},
				},
				error: null,
			})),
		},
		rpc,
	};

	vi.mocked(createClient).mockReturnValue(admin as never);

	return { admin, rpc };
}

describe("community comment submit route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.NEXT_PUBLIC_COMMUNITY_POSTS_ENABLED = "true";
		process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
		process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
		vi.mocked(enforceApiRateLimit).mockResolvedValue(null);
	});

	it("keeps the endpoint closed when the feature flag is off", async () => {
		process.env.NEXT_PUBLIC_COMMUNITY_POSTS_ENABLED = "false";

		const response = await POST(
			communityCommentRequest({
				body: "This is how I would prepare.",
				postId: POST_ID,
			}),
		);

		expect(response.status).toBe(404);
		expect(createClient).not.toHaveBeenCalled();
	});

	it("creates comments through the service-role RPC", async () => {
		const { admin, rpc } = mockAdmin({
			data: [{ id: "33333333-3333-4333-8333-333333333333" }],
			error: null,
		});

		const response = await POST(
			communityCommentRequest({
				body: "This is how I would prepare.",
				postId: POST_ID,
			}),
		);

		expect(response.status).toBe(200);
		expect(enforceApiRateLimit).toHaveBeenCalledWith(
			admin,
			USER_ID,
			"communityCommentSubmit",
		);
		expect(rpc).toHaveBeenCalledWith("submit_community_comment", {
			comment_attachment_id: null,
			comment_body: "This is how I would prepare.",
			parent_comment_id: null,
			target_post_id: POST_ID,
			target_user_id: USER_ID,
		});
		await expect(response.json()).resolves.toEqual({
			id: "33333333-3333-4333-8333-333333333333",
			status: "active",
		});
	});

	it("passes a valid uploaded media attachment to the RPC", async () => {
		const { rpc } = mockAdmin({
			data: [{ id: "33333333-3333-4333-8333-333333333333", status: "held" }],
			error: null,
		});

		const response = await POST(
			communityCommentRequest({
				attachmentId: ATTACHMENT_ID,
				body: "This image shows the exact issue.",
				postId: POST_ID,
			}),
		);

		expect(response.status).toBe(200);
		expect(rpc).toHaveBeenCalledWith("submit_community_comment", {
			comment_attachment_id: ATTACHMENT_ID,
			comment_body: "This image shows the exact issue.",
			parent_comment_id: null,
			target_post_id: POST_ID,
			target_user_id: USER_ID,
		});
		await expect(response.json()).resolves.toEqual({
			id: "33333333-3333-4333-8333-333333333333",
			status: "held",
		});
	});

	it("rejects malformed attachment ids before rate limiting or RPC calls", async () => {
		const { rpc } = mockAdmin();

		const response = await POST(
			communityCommentRequest({
				attachmentId: "not-a-valid-id",
				body: "This has an invalid attachment.",
				postId: POST_ID,
			}),
		);

		expect(response.status).toBe(400);
		expect(enforceApiRateLimit).not.toHaveBeenCalled();
		expect(rpc).not.toHaveBeenCalled();
		await expect(response.json()).resolves.toEqual({
			message: "Choose a valid image.",
		});
	});
});
