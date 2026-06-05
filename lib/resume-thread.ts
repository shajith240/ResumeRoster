import type { ResumeSummary, Review } from "@/lib/supabase/types";

type ActiveUserLike = {
	id: string;
} | null;

export type ThreadReview = Review & {
	childCount: number;
	depth: number;
};

export type ThreadReviewNode = ThreadReview & {
	children: ThreadReviewNode[];
};

export function getReactionBlockReason(
	activeUser: ActiveUserLike,
	activeResume: ResumeSummary | null,
	review: Review,
) {
	if (!activeUser) return null;

	if (activeResume?.user_id === activeUser.id) {
		return "Resume owners cannot react to feedback on their own resume.";
	}

	if (review.author_id === activeUser.id) {
		return "You cannot react to your own feedback.";
	}

	return null;
}

export function getReplyBlockReason({
	isClosed,
	isDeleted,
	isOwnReview,
	isOwnRoast,
	migrationMessage,
	replySchemaReady,
}: {
	isClosed: boolean;
	isDeleted: boolean;
	isOwnReview?: boolean;
	isOwnRoast?: boolean;
	migrationMessage: string;
	replySchemaReady: boolean;
}) {
	if (isClosed) return "This resume is closed for new replies.";
	if (isDeleted) return "Deleted feedback cannot receive new replies.";
	if (isOwnReview ?? isOwnRoast) return "You cannot reply to your own feedback.";
	if (!replySchemaReady) return `${migrationMessage} Replies are not ready yet.`;
	return null;
}

export function normalizeReview(review: Review): Review {
	return {
		...review,
		parent_id: review.parent_id ?? null,
		attachment_id: review.attachment_id ?? null,
		content_format: review.content_format ?? "plain",
		dislike_count: review.dislike_count ?? 0,
		reply_count: review.reply_count ?? 0,
		is_deleted: review.is_deleted ?? false,
		deleted_at: review.deleted_at ?? null,
	};
}

function sortTopLevelReviews(a: Review, b: Review) {
	return (
		b.helpful_votes - a.helpful_votes ||
		new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
	);
}

function sortReplyReviews(a: Review, b: Review) {
	return (
		new Date(a.created_at).getTime() - new Date(b.created_at).getTime() ||
		b.helpful_votes - a.helpful_votes
	);
}

function buildChildrenByParent(reviews: Review[]) {
	const childrenByParent = new Map<string | null, Review[]>();

	for (const review of reviews) {
		const parentId = review.parent_id ?? null;
		const siblings = childrenByParent.get(parentId) ?? [];
		siblings.push(review);
		childrenByParent.set(parentId, siblings);
	}

	childrenByParent.get(null)?.sort(sortTopLevelReviews);
	for (const [parentId, children] of childrenByParent.entries()) {
		if (parentId !== null) {
			children.sort(sortReplyReviews);
		}
	}

	return childrenByParent;
}

export function buildThreadReviewTree(reviews: Review[]): ThreadReviewNode[] {
	const childrenByParent = buildChildrenByParent(reviews);

	function buildNode(review: Review, depth: number): ThreadReviewNode {
		const children = childrenByParent.get(review.id) ?? [];

		return {
			...review,
			childCount: children.length,
			depth,
			children: children.map((child) => buildNode(child, depth + 1)),
		};
	}

	return (childrenByParent.get(null) ?? []).map((review) => buildNode(review, 0));
}

export function buildThreadReviews(reviews: Review[]): ThreadReview[] {
	const flattened: ThreadReview[] = [];

	function visit(node: ThreadReviewNode) {
		const { children, ...review } = node;
		flattened.push(review);
		children.forEach(visit);
	}

	buildThreadReviewTree(reviews).forEach(visit);
	return flattened;
}
