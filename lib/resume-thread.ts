import type { ResumeSummary, Roast } from "@/lib/supabase/types";

type ActiveUserLike = {
	id: string;
} | null;

export type ThreadRoast = Roast & {
	childCount: number;
	depth: number;
};

export type ThreadRoastNode = ThreadRoast & {
	children: ThreadRoastNode[];
};

export function getReactionBlockReason(
	activeUser: ActiveUserLike,
	activeResume: ResumeSummary | null,
	roast: Roast,
) {
	if (!activeUser) return null;

	if (activeResume?.user_id === activeUser.id) {
		return "Resume owners cannot react to roasts on their own resume.";
	}

	if (roast.author_id === activeUser.id) {
		return "You cannot react to your own roast.";
	}

	return null;
}

export function getReplyBlockReason({
	isClosed,
	isDeleted,
	isOwnRoast,
	migrationMessage,
	replySchemaReady,
}: {
	isClosed: boolean;
	isDeleted: boolean;
	isOwnRoast: boolean;
	migrationMessage: string;
	replySchemaReady: boolean;
}) {
	if (isClosed) return "This resume is closed for new replies.";
	if (isDeleted) return "Deleted roasts cannot receive new replies.";
	if (isOwnRoast) return "You cannot reply to your own roast.";
	if (!replySchemaReady) return `${migrationMessage} Replies are not ready yet.`;
	return null;
}

export function normalizeRoast(roast: Roast): Roast {
	return {
		...roast,
		parent_id: roast.parent_id ?? null,
		sticker_id: roast.sticker_id ?? null,
		dislike_count: roast.dislike_count ?? 0,
		reply_count: roast.reply_count ?? 0,
		is_deleted: roast.is_deleted ?? false,
		deleted_at: roast.deleted_at ?? null,
	};
}

function sortTopLevelRoasts(a: Roast, b: Roast) {
	return (
		b.helpful_votes - a.helpful_votes ||
		new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
	);
}

function sortReplyRoasts(a: Roast, b: Roast) {
	return (
		new Date(a.created_at).getTime() - new Date(b.created_at).getTime() ||
		b.helpful_votes - a.helpful_votes
	);
}

function buildChildrenByParent(roasts: Roast[]) {
	const childrenByParent = new Map<string | null, Roast[]>();

	for (const roast of roasts) {
		const parentId = roast.parent_id ?? null;
		const siblings = childrenByParent.get(parentId) ?? [];
		siblings.push(roast);
		childrenByParent.set(parentId, siblings);
	}

	childrenByParent.get(null)?.sort(sortTopLevelRoasts);
	for (const [parentId, children] of childrenByParent.entries()) {
		if (parentId !== null) {
			children.sort(sortReplyRoasts);
		}
	}

	return childrenByParent;
}

export function buildThreadRoastTree(
	roasts: Roast[],
	collapsedRoastIds: Set<string>,
): ThreadRoastNode[] {
	const childrenByParent = buildChildrenByParent(roasts);

	function buildNode(roast: Roast, depth: number): ThreadRoastNode {
		const children = childrenByParent.get(roast.id) ?? [];
		const visibleChildren = collapsedRoastIds.has(roast.id)
			? []
			: children.map((child) => buildNode(child, depth + 1));

		return {
			...roast,
			childCount: children.length,
			depth,
			children: visibleChildren,
		};
	}

	return (childrenByParent.get(null) ?? []).map((roast) => buildNode(roast, 0));
}

export function buildThreadRoasts(
	roasts: Roast[],
	collapsedRoastIds: Set<string>,
): ThreadRoast[] {
	const flattened: ThreadRoast[] = [];

	function visit(node: ThreadRoastNode) {
		const { children, ...roast } = node;
		flattened.push(roast);
		children.forEach(visit);
	}

	buildThreadRoastTree(roasts, collapsedRoastIds).forEach(visit);
	return flattened;
}
