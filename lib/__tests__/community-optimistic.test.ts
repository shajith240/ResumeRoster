import { describe, expect, it } from "vitest";
import { getOptimisticCommunityVoteCounts } from "@/lib/community-optimistic";

describe("community optimistic helpers", () => {
	it("applies vote transitions without waiting for server counts", () => {
		expect(
			getOptimisticCommunityVoteCounts(
				{ downvote_count: 1, upvote_count: 4 },
				null,
				"upvote",
			),
		).toEqual({ downvote_count: 1, upvote_count: 5 });

		expect(
			getOptimisticCommunityVoteCounts(
				{ downvote_count: 1, upvote_count: 4 },
				"upvote",
				"downvote",
			),
		).toEqual({ downvote_count: 2, upvote_count: 3 });

		expect(
			getOptimisticCommunityVoteCounts(
				{ downvote_count: 1, upvote_count: 4 },
				"downvote",
				null,
			),
		).toEqual({ downvote_count: 0, upvote_count: 4 });
	});

	it("never returns negative counts for stale local state", () => {
		expect(
			getOptimisticCommunityVoteCounts(
				{ downvote_count: 0, upvote_count: 0 },
				"upvote",
				null,
			),
		).toEqual({ downvote_count: 0, upvote_count: 0 });
	});
});
