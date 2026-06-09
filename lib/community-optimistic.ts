import type { CommunityVoteReaction } from "@/lib/supabase/types";

type VoteCountInput = {
	downvote_count: number;
	upvote_count: number;
};

export function getOptimisticCommunityVoteCounts(
	current: VoteCountInput,
	previousReaction: CommunityVoteReaction | null,
	nextReaction: CommunityVoteReaction | null,
) {
	let upvoteCount = current.upvote_count;
	let downvoteCount = current.downvote_count;

	if (previousReaction === "upvote") upvoteCount -= 1;
	if (previousReaction === "downvote") downvoteCount -= 1;
	if (nextReaction === "upvote") upvoteCount += 1;
	if (nextReaction === "downvote") downvoteCount += 1;

	return {
		downvote_count: Math.max(0, downvoteCount),
		upvote_count: Math.max(0, upvoteCount),
	};
}
