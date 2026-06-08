import { POST as voteOnPost } from "@/app/api/community/posts/[id]/vote/route";
import { POST as voteOnComment } from "@/app/api/community/comments/[id]/vote/route";
import { POST as voteOnPoll } from "@/app/api/community/polls/[id]/vote/route";
import { POST as savePost } from "@/app/api/community/posts/[id]/save/route";
import {
	DELETE as deletePost,
	PATCH as editPost,
} from "@/app/api/community/posts/[id]/route";
import { DELETE as deleteComment } from "@/app/api/community/comments/[id]/route";
import { POST as lockPost } from "@/app/api/community/posts/[id]/lock/route";
import { requireAdmin } from "@/lib/admin";
import { enforceApiRateLimit } from "@/lib/server/rate-limit";
import { requireSignedInUser } from "@/lib/server-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-auth", () => ({
	requireSignedInUser: vi.fn(),
	serverAuthErrorResponse: vi.fn((error: unknown) =>
		Response.json(
			{ message: error instanceof Error ? error.message : "Auth failed." },
			{ status: 401 },
		),
	),
}));

vi.mock("@/lib/admin", () => ({
	adminErrorResponse: vi.fn((error: unknown) =>
		Response.json(
			{ message: error instanceof Error ? error.message : "Admin failed." },
			{ status: 403 },
		),
	),
	requireAdmin: vi.fn(),
}));

vi.mock("@/lib/server/rate-limit", () => ({
	enforceApiRateLimit: vi.fn(),
}));

const ADMIN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COMMENT_ID = "33333333-3333-4333-8333-333333333333";
const OPTION_ID = "44444444-4444-4444-8444-444444444444";
const POLL_ID = "55555555-5555-4555-8555-555555555555";
const POST_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "11111111-1111-4111-8111-111111111111";

function routeContext(id = POST_ID) {
	return {
		params: Promise.resolve({ id }),
	};
}

function jsonRequest(path: string, body: Record<string, unknown>, method = "POST") {
	return new Request(`https://linted.test${path}`, {
		body: JSON.stringify(body),
		headers: {
			Authorization: "Bearer session-token",
			"Content-Type": "application/json",
		},
		method,
	});
}

function request(path: string, method: string) {
	return new Request(`https://linted.test${path}`, {
		headers: {
			Authorization: "Bearer session-token",
		},
		method,
	});
}

function mockSignedInRpc(rpcResult: unknown) {
	const rpc = vi.fn(async () => rpcResult);

	vi.mocked(requireSignedInUser).mockResolvedValue({
		admin: { rpc },
		user: { id: USER_ID },
	} as never);

	return rpc;
}

function mockAdminRpc(rpcResult: unknown) {
	const rpc = vi.fn(async () => rpcResult);

	vi.mocked(requireAdmin).mockResolvedValue({
		admin: { rpc },
		user: { id: ADMIN_ID },
	} as never);

	return rpc;
}

describe("community action routes", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.NEXT_PUBLIC_COMMUNITY_POSTS_ENABLED = "true";
		vi.mocked(enforceApiRateLimit).mockResolvedValue(null);
	});

	it("toggles a community post vote through the service-role RPC", async () => {
		const rpc = mockSignedInRpc({
			data: [
				{
					downvote_count: 1,
					post_id: POST_ID,
					reaction: "upvote",
					upvote_count: 4,
				},
			],
			error: null,
		});

		const response = await voteOnPost(
			jsonRequest(`/api/community/posts/${POST_ID}/vote`, {
				reaction: "upvote",
			}),
			routeContext(),
		);

		expect(response.status).toBe(200);
		expect(enforceApiRateLimit).toHaveBeenCalledWith(
			expect.objectContaining({ rpc }),
			USER_ID,
			"communityVoteWrite",
		);
		expect(rpc).toHaveBeenCalledWith("set_community_post_vote", {
			next_reaction: "upvote",
			target_post_id: POST_ID,
			target_user_id: USER_ID,
		});
		await expect(response.json()).resolves.toEqual({
			downvoteCount: 1,
			reaction: "upvote",
			upvoteCount: 4,
		});
	});

	it("rejects invalid vote reactions before auth work", async () => {
		const response = await voteOnComment(
			jsonRequest(`/api/community/comments/${COMMENT_ID}/vote`, {
				reaction: "boost",
			}),
			routeContext(COMMENT_ID),
		);

		expect(response.status).toBe(400);
		expect(requireSignedInUser).not.toHaveBeenCalled();
	});

	it("sends poll votes through the service-role RPC", async () => {
		const rpc = mockSignedInRpc({
			data: [
				{
					option_id: OPTION_ID,
					poll_id: POLL_ID,
				},
			],
			error: null,
		});

		const response = await voteOnPoll(
			jsonRequest(`/api/community/polls/${POLL_ID}/vote`, {
				optionId: OPTION_ID,
			}),
			routeContext(POLL_ID),
		);

		expect(response.status).toBe(200);
		expect(rpc).toHaveBeenCalledWith("vote_community_post_poll", {
			selected_option_id: OPTION_ID,
			target_poll_id: POLL_ID,
			target_user_id: USER_ID,
		});
		await expect(response.json()).resolves.toEqual({
			optionId: OPTION_ID,
			pollId: POLL_ID,
		});
	});

	it("saves community posts through the server route", async () => {
		const profileUpsert = vi.fn(async () => ({ error: null }));
		const upsert = vi.fn(async () => ({ error: null }));
		const postCountMaybeSingle = vi.fn(async () => ({
			data: { save_count: 8 },
			error: null,
		}));
		const postMaybeSingle = vi.fn(async () => ({
			data: { id: POST_ID, status: "active" },
			error: null,
		}));
		let postSelectCallCount = 0;
		const from = vi.fn((table: string) => {
			if (table === "profiles") {
				return { upsert: profileUpsert };
			}

			if (table === "community_posts") {
				const select = vi.fn(() => {
					postSelectCallCount += 1;
					return postSelectCallCount === 1
						? {
						eq: vi.fn(() => ({
							maybeSingle: postMaybeSingle,
						})),
					}
						: {
						eq: vi.fn(() => ({
							maybeSingle: postCountMaybeSingle,
						})),
					};
				});

				return { select };
			}

			if (table === "community_post_saves") {
				return { upsert };
			}

			throw new Error(`Unexpected table ${table}`);
		});

		vi.mocked(requireSignedInUser).mockResolvedValue({
			admin: { from, rpc: vi.fn() },
			user: { id: USER_ID },
		} as never);

		const response = await savePost(
			jsonRequest(`/api/community/posts/${POST_ID}/save`, {
				saved: true,
			}),
			routeContext(),
		);

		expect(response.status).toBe(200);
		expect(from).toHaveBeenCalledWith("community_post_saves");
		expect(upsert).toHaveBeenCalledWith(
			{ post_id: POST_ID, user_id: USER_ID },
			{ onConflict: "post_id,user_id" },
		);
		await expect(response.json()).resolves.toEqual({
			saveCount: 8,
			saved: true,
		});
	});

	it("edits a community post through the author RPC", async () => {
		const rpc = mockSignedInRpc({
			data: [
				{
					body: "Here is the updated placement preparation context.",
					id: POST_ID,
					status: "active",
					title: "Updated placement doubt",
					updated_at: "2026-01-01T00:00:00.000Z",
				},
			],
			error: null,
		});

		const response = await editPost(
			jsonRequest(
				`/api/community/posts/${POST_ID}`,
				{
					body: "Here is the updated placement preparation context.",
					title: "Updated placement doubt",
				},
				"PATCH",
			),
			routeContext(),
		);

		expect(response.status).toBe(200);
		expect(rpc).toHaveBeenCalledWith("update_community_post_content", {
			next_body: "Here is the updated placement preparation context.",
			next_title: "Updated placement doubt",
			target_post_id: POST_ID,
			target_user_id: USER_ID,
		});
	});

	it("soft deletes community comments without hard deleting the thread row", async () => {
		const rpc = mockSignedInRpc({
			data: [
				{
					deleted_at: "2026-01-01T00:00:00.000Z",
					id: COMMENT_ID,
					status: "deleted",
				},
			],
			error: null,
		});

		const response = await deleteComment(
			request(`/api/community/comments/${COMMENT_ID}`, "DELETE"),
			routeContext(COMMENT_ID),
		);

		expect(response.status).toBe(200);
		expect(rpc).toHaveBeenCalledWith("soft_delete_community_comment", {
			target_comment_id: COMMENT_ID,
			target_user_id: USER_ID,
		});
		await expect(response.json()).resolves.toEqual({
			comment: {
				deletedAt: "2026-01-01T00:00:00.000Z",
				id: COMMENT_ID,
				status: "deleted",
			},
		});
	});

	it("locks a post only through the admin route", async () => {
		const rpc = mockAdminRpc({
			data: [
				{
					id: POST_ID,
					status: "locked",
					updated_at: "2026-01-01T00:00:00.000Z",
				},
			],
			error: null,
		});

		const response = await lockPost(
			jsonRequest(`/api/community/posts/${POST_ID}/lock`, {
				locked: true,
			}),
			routeContext(),
		);

		expect(response.status).toBe(200);
		expect(rpc).toHaveBeenCalledWith("set_community_post_lock", {
			should_lock: true,
			target_admin_id: ADMIN_ID,
			target_post_id: POST_ID,
		});
	});

	it("keeps post deletes feature-flagged", async () => {
		process.env.NEXT_PUBLIC_COMMUNITY_POSTS_ENABLED = "false";

		const response = await deletePost(
			request(`/api/community/posts/${POST_ID}`, "DELETE"),
			routeContext(),
		);

		expect(response.status).toBe(404);
		expect(requireSignedInUser).not.toHaveBeenCalled();
	});
});
