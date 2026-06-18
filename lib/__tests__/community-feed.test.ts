import { describe, expect, it } from "vitest";
import {
	filterCommunityPostsForTabInCurrentOrder,
	getCommunityHotScore,
	getCommunityPostScore,
	isVisibleCommunityFeedPostStatus,
	normalizeCommunityFeedTab,
	sortCommunityPosts,
	type CommunityFeedPostRankInput,
} from "@/lib/community-feed";

function post(
	overrides: Partial<CommunityFeedPostRankInput>,
): CommunityFeedPostRankInput {
	return {
		comment_count: 0,
		created_at: "2026-06-07T00:00:00.000Z",
		downvote_count: 0,
		post_type: "discussion",
		upvote_count: 0,
		...overrides,
	};
}

describe("community feed ranking", () => {
	it("normalizes unknown tabs to hot", () => {
		expect(normalizeCommunityFeedTab("top")).toBe("top");
		expect(normalizeCommunityFeedTab("random")).toBe("hot");
		expect(normalizeCommunityFeedTab(["new", "top"])).toBe("new");
	});

	it("calculates score from votes", () => {
		expect(getCommunityPostScore(post({ downvote_count: 2, upvote_count: 7 }))).toBe(5);
	});

	it("treats only active and locked community statuses as feed-visible", () => {
		expect(isVisibleCommunityFeedPostStatus("active")).toBe(true);
		expect(isVisibleCommunityFeedPostStatus("locked")).toBe(true);
		expect(isVisibleCommunityFeedPostStatus("deleted")).toBe(false);
		expect(isVisibleCommunityFeedPostStatus("removed")).toBe(false);
	});

	it("uses recency and activity for hot ranking", () => {
		const now = new Date("2026-06-07T12:00:00.000Z").getTime();
		const fresh = post({
			comment_count: 2,
			created_at: "2026-06-07T11:00:00.000Z",
			upvote_count: 2,
		});
		const old = post({
			comment_count: 0,
			created_at: "2026-06-01T00:00:00.000Z",
			upvote_count: 2,
		});

		expect(getCommunityHotScore(fresh, now)).toBeGreaterThan(
			getCommunityHotScore(old, now),
		);
	});

	it("sorts top, new, questions, and unanswered tabs", () => {
		const rows = [
			post({
				comment_count: 1,
				created_at: "2026-06-06T00:00:00.000Z",
				post_type: "question",
				upvote_count: 1,
			}),
			post({
				comment_count: 0,
				created_at: "2026-06-07T00:00:00.000Z",
				post_type: "question",
				upvote_count: 2,
			}),
			post({
				comment_count: 4,
				created_at: "2026-06-05T00:00:00.000Z",
				post_type: "discussion",
				upvote_count: 8,
			}),
		];

		expect(sortCommunityPosts(rows, "top")[0]?.upvote_count).toBe(8);
		expect(sortCommunityPosts(rows, "new")[0]?.created_at).toBe(
			"2026-06-07T00:00:00.000Z",
		);
		expect(sortCommunityPosts(rows, "questions")).toHaveLength(2);
		expect(sortCommunityPosts(rows, "unanswered")).toEqual([
			expect.objectContaining({ comment_count: 0, post_type: "question" }),
		]);
	});

	it("keeps deleted and removed rows out of sorted community feeds", () => {
		const rows = [
			post({
				created_at: "2026-06-07T00:00:00.000Z",
				status: "active",
				upvote_count: 2,
			}),
			post({
				created_at: "2026-06-08T00:00:00.000Z",
				status: "deleted",
				upvote_count: 200,
			}),
			post({
				created_at: "2026-06-09T00:00:00.000Z",
				status: "removed",
				upvote_count: 300,
			}),
		];

		expect(sortCommunityPosts(rows, "top")).toEqual([
			expect.objectContaining({ status: "active" }),
		]);
	});

	it("filters active tabs without reordering already rendered feed rows", () => {
		const rows = [
			post({
				comment_count: 4,
				created_at: "2026-06-05T00:00:00.000Z",
				post_type: "discussion",
				status: "active",
				upvote_count: 1,
			}),
			post({
				comment_count: 0,
				created_at: "2026-06-07T00:00:00.000Z",
				post_type: "question",
				status: "active",
				upvote_count: 30,
			}),
			post({
				comment_count: 2,
				created_at: "2026-06-06T00:00:00.000Z",
				post_type: "question",
				status: "locked",
				upvote_count: 100,
			}),
			post({
				comment_count: 0,
				created_at: "2026-06-08T00:00:00.000Z",
				post_type: "question",
				status: "deleted",
				upvote_count: 500,
			}),
		];

		expect(filterCommunityPostsForTabInCurrentOrder(rows, "hot")).toEqual([
			rows[0],
			rows[1],
			rows[2],
		]);
		expect(filterCommunityPostsForTabInCurrentOrder(rows, "questions")).toEqual([
			rows[1],
			rows[2],
		]);
		expect(filterCommunityPostsForTabInCurrentOrder(rows, "unanswered")).toEqual([
			rows[1],
		]);
	});
});
