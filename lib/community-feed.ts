const COMMUNITY_FEED_TABS = [
	"hot",
	"new",
	"top",
	"questions",
	"unanswered",
] as const;

export type CommunityFeedTab = (typeof COMMUNITY_FEED_TABS)[number];

export type CommunityFeedPostRankInput = {
	comment_count: number;
	created_at: string;
	downvote_count: number;
	post_type: string;
	status?: string | null;
	upvote_count: number;
};

export function normalizeCommunityFeedTab(
	value: string | string[] | undefined,
): CommunityFeedTab {
	const tab = Array.isArray(value) ? value[0] : value;

	return COMMUNITY_FEED_TABS.includes(tab as CommunityFeedTab)
		? (tab as CommunityFeedTab)
		: "hot";
}

export function getCommunityPostScore(post: CommunityFeedPostRankInput) {
	return post.upvote_count - post.downvote_count;
}

export function isVisibleCommunityFeedPostStatus(status: string | null | undefined) {
	return status === undefined || status === "active" || status === "locked";
}

export function getCommunityHotScore(
	post: CommunityFeedPostRankInput,
	now = Date.now(),
) {
	const ageHours = Math.max(
		1,
		(now - new Date(post.created_at).getTime()) / 3_600_000,
	);
	const score = getCommunityPostScore(post);
	const discussionWeight = Math.min(post.comment_count, 30) * 1.5;

	return score * 4 + discussionWeight + 64 / Math.pow(ageHours + 2, 1.18);
}

function newestFirst(
	a: CommunityFeedPostRankInput,
	b: CommunityFeedPostRankInput,
) {
	return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export function sortCommunityPosts<T extends CommunityFeedPostRankInput>(
	posts: T[],
	tab: CommunityFeedTab,
	now = Date.now(),
) {
	const filteredPosts = posts.filter(
		(post) =>
			isVisibleCommunityFeedPostStatus(post.status) &&
			(tab === "questions" || tab === "unanswered"
				? post.post_type === "question"
				: true),
	);
	const visiblePosts =
		tab === "unanswered"
			? filteredPosts.filter((post) => post.comment_count === 0)
			: filteredPosts;

	return [...visiblePosts].sort((a, b) => {
		if (tab === "new" || tab === "questions" || tab === "unanswered") {
			return newestFirst(a, b);
		}

		if (tab === "top") {
			return (
				getCommunityPostScore(b) - getCommunityPostScore(a) ||
				b.comment_count - a.comment_count ||
				newestFirst(a, b)
			);
		}

	return getCommunityHotScore(b, now) - getCommunityHotScore(a, now) || newestFirst(a, b);
	});
}

export function filterCommunityPostsForTabInCurrentOrder<
	T extends CommunityFeedPostRankInput,
>(posts: T[], tab: CommunityFeedTab) {
	const visiblePosts = posts.filter((post) =>
		isVisibleCommunityFeedPostStatus(post.status),
	);

	if (tab === "unanswered") {
		return visiblePosts.filter(
			(post) => post.post_type === "question" && post.comment_count === 0,
		);
	}

	if (tab === "questions") {
		return visiblePosts.filter((post) => post.post_type === "question");
	}

	return visiblePosts;
}
