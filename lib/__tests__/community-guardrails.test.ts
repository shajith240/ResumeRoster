import { describe, expect, it } from "vitest";
import {
	getCommunityCommentReactionBlockReason,
	getCommunityCommentReplyBlockReason,
	getCommunityPollVoteBlockReason,
	getCommunityPostReactionBlockReason,
} from "@/lib/community-guardrails";
import { COMMUNITY_COMMENT_MAX_DEPTH } from "@/lib/community-threading";

const activeUser = { id: "user-1" };

describe("community guardrails", () => {
	it("blocks users from voting on their own posts", () => {
		expect(
			getCommunityPostReactionBlockReason(activeUser, {
				author_id: "user-1",
				status: "active",
			}),
		).toBe("You cannot vote on your own post.");
	});

	it("blocks post votes on unavailable targets", () => {
		expect(
			getCommunityPostReactionBlockReason(activeUser, {
				author_id: "user-2",
				status: "locked",
			}),
		).toBe("This post is not open for voting.");
	});

	it("allows post votes from other users on active posts", () => {
		expect(
			getCommunityPostReactionBlockReason(activeUser, {
				author_id: "user-2",
				status: "active",
			}),
		).toBeNull();
	});

	it("blocks users from voting on their own comments", () => {
		expect(
			getCommunityCommentReactionBlockReason(activeUser, {
				author_id: "user-1",
				status: "active",
			}),
		).toBe("You cannot vote on your own comment.");
	});

	it("blocks comment votes on deleted, removed, or held comments", () => {
		for (const status of ["deleted", "removed", "held"] as const) {
			expect(
				getCommunityCommentReactionBlockReason(activeUser, {
					author_id: "user-2",
					status,
				}),
			).toBe("This comment is not open for voting.");
		}
	});

	it("blocks replies to own comments and locked post comments", () => {
		expect(
			getCommunityCommentReplyBlockReason({
				activeUser,
				comment: {
					author_id: "user-1",
					depth: 0,
					status: "active",
				},
				postStatus: "active",
			}),
		).toBe("You cannot reply to your own comment.");

		expect(
			getCommunityCommentReplyBlockReason({
				activeUser,
				comment: {
					author_id: "user-2",
					depth: 0,
					status: "active",
				},
				postStatus: "locked",
			}),
		).toBe("This post is closed for new replies.");
	});

	it("blocks reply depth and allows valid comment replies", () => {
		expect(
			getCommunityCommentReplyBlockReason({
				activeUser,
				comment: {
					author_id: "user-2",
					depth: COMMUNITY_COMMENT_MAX_DEPTH,
					status: "active",
				},
				postStatus: "active",
			}),
		).toBe("This thread is at the reply limit.");

		expect(
			getCommunityCommentReplyBlockReason({
				activeUser,
				comment: {
					author_id: "user-2",
					depth: COMMUNITY_COMMENT_MAX_DEPTH - 1,
					status: "active",
				},
				postStatus: "active",
			}),
		).toBeNull();
	});

	it("blocks closed or busy poll voting and allows active polls", () => {
		expect(
			getCommunityPollVoteBlockReason({
				activeUser,
				isClosed: true,
				isVoting: false,
				postStatus: "active",
			}),
		).toBe("This poll is closed.");

		expect(
			getCommunityPollVoteBlockReason({
				activeUser,
				isClosed: false,
				isVoting: false,
				postStatus: "active",
			}),
		).toBeNull();
	});
});
