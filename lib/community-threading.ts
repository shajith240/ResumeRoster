import type { CommunityPostComment } from "@/lib/supabase/types";

export const COMMUNITY_COMMENT_MAX_DEPTH = 3;

export type CommunityCommentNode = CommunityPostComment & {
	children: CommunityCommentNode[];
	depth: number;
};

export function canReplyToCommunityComment(depth: number) {
	return depth < COMMUNITY_COMMENT_MAX_DEPTH;
}

export function buildCommunityCommentTree(comments: CommunityPostComment[]) {
	const nodes = new Map<string, CommunityCommentNode>();

	for (const comment of comments) {
		nodes.set(comment.id, {
			...comment,
			children: [],
			depth: 0,
		});
	}

	const roots: CommunityCommentNode[] = [];

	for (const comment of comments) {
		const node = nodes.get(comment.id);
		if (!node) continue;

		const parent = comment.parent_id ? nodes.get(comment.parent_id) : null;
		if (parent) {
			parent.children.push(node);
		} else {
			roots.push(node);
		}
	}

	function sortAndSetDepth(node: CommunityCommentNode, depth: number) {
		node.depth = depth;
		node.children.sort(compareCommentsByDate);
		for (const child of node.children) {
			sortAndSetDepth(child, depth + 1);
		}
	}

	roots.sort(compareCommentsByDate);
	for (const root of roots) {
		sortAndSetDepth(root, 0);
	}

	return roots;
}

function compareCommentsByDate(
	first: CommunityPostComment,
	second: CommunityPostComment,
) {
	return new Date(first.created_at).getTime() - new Date(second.created_at).getTime();
}
