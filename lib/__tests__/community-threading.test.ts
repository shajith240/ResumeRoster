import {
	COMMUNITY_COMMENT_MAX_DEPTH,
	buildCommunityCommentTree,
	canReplyToCommunityComment,
} from "@/lib/community-threading";
import type { CommunityPostComment } from "@/lib/supabase/types";
import { describe, expect, it } from "vitest";

function comment(
	id: string,
	parentId: string | null,
	createdAt: string,
	status: CommunityPostComment["status"] = "active",
): CommunityPostComment {
	return {
		author_id: `author-${id}`,
		body: status === "deleted" ? "[deleted]" : `Comment ${id}`,
		created_at: createdAt,
		deleted_at: status === "deleted" ? createdAt : null,
		downvote_count: 0,
		id,
		parent_id: parentId,
		post_id: "post-1",
		reply_count: 0,
		status,
		upvote_count: 0,
		updated_at: createdAt,
	};
}

describe("community comment threading", () => {
	it("builds ordered threaded replies from normalized comment rows", () => {
		const tree = buildCommunityCommentTree([
			comment("reply-late", "root", "2026-01-01T00:04:00.000Z"),
			comment("root", null, "2026-01-01T00:01:00.000Z"),
			comment("reply-early", "root", "2026-01-01T00:02:00.000Z"),
			comment("nested", "reply-early", "2026-01-01T00:03:00.000Z"),
		]);

		expect(tree).toHaveLength(1);
		expect(tree[0].id).toBe("root");
		expect(tree[0].depth).toBe(0);
		expect(tree[0].children.map((node) => node.id)).toEqual([
			"reply-early",
			"reply-late",
		]);
		expect(tree[0].children[0].children[0].id).toBe("nested");
		expect(tree[0].children[0].children[0].depth).toBe(2);
	});

	it("keeps deleted comments in the tree so replies keep their shape", () => {
		const tree = buildCommunityCommentTree([
			comment("root", null, "2026-01-01T00:01:00.000Z", "deleted"),
			comment("reply", "root", "2026-01-01T00:02:00.000Z"),
		]);

		expect(tree[0].status).toBe("deleted");
		expect(tree[0].children[0].id).toBe("reply");
	});

	it("treats orphaned rows as roots and caps reply affordances by depth", () => {
		const tree = buildCommunityCommentTree([
			comment("orphan", "missing", "2026-01-01T00:01:00.000Z"),
		]);

		expect(tree[0].id).toBe("orphan");
		expect(canReplyToCommunityComment(COMMUNITY_COMMENT_MAX_DEPTH - 1)).toBe(true);
		expect(canReplyToCommunityComment(COMMUNITY_COMMENT_MAX_DEPTH)).toBe(false);
	});
});
