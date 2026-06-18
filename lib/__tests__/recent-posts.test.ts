import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	RECENT_POSTS_EVENT,
	clearRecentPosts,
	readRecentPosts,
	removeRecentPost,
	removeRecentPosts,
	writeRecentPost,
	type RecentPostItem,
	type RecentPostKind,
} from "@/lib/recent-posts";

function recentPost(
	kind: RecentPostKind,
	overrides: Partial<RecentPostItem>,
): RecentPostItem {
	return {
		createdAt: "2026-06-10T00:00:00.000Z",
		href: kind === "resume" ? "/resume/post-1" : "/community/post-1",
		id: "post-1",
		kind,
		title: "Recent post",
		visitedAt: "2026-06-10T00:00:00.000Z",
		...overrides,
	};
}

describe("recent posts", () => {
	beforeEach(() => {
		window.localStorage.clear();
	});

	it("removes a deleted post from the matching recent rail history", () => {
		writeRecentPost(recentPost("community", { id: "keep" }));
		writeRecentPost(recentPost("community", { id: "delete-me" }));
		writeRecentPost(recentPost("resume", { id: "delete-me" }));

		const listener = vi.fn();
		window.addEventListener(RECENT_POSTS_EVENT, listener);

		try {
			removeRecentPost("community", "delete-me");

			expect(readRecentPosts("community").map((item) => item.id)).toEqual([
				"keep",
			]);
			expect(readRecentPosts("resume").map((item) => item.id)).toEqual([
				"delete-me",
			]);
			expect(listener).toHaveBeenCalledTimes(1);
			expect(listener.mock.calls[0]?.[0]).toMatchObject({
				detail: { kind: "community" },
			});
		} finally {
			window.removeEventListener(RECENT_POSTS_EVENT, listener);
		}
	});

	it("clears storage when the removed post was the only recent item", () => {
		writeRecentPost(recentPost("resume", { id: "resume-1" }));

		removeRecentPost("resume", "resume-1");

		expect(readRecentPosts("resume")).toEqual([]);
	});

	it("removes multiple stale posts with one recent rail change event", () => {
		writeRecentPost(recentPost("community", { id: "keep" }));
		writeRecentPost(recentPost("community", { id: "deleted-poll" }));
		writeRecentPost(recentPost("community", { id: "deleted-post" }));

		const listener = vi.fn();
		window.addEventListener(RECENT_POSTS_EVENT, listener);

		try {
			removeRecentPosts("community", ["deleted-poll", "deleted-post"]);

			expect(readRecentPosts("community").map((item) => item.id)).toEqual([
				"keep",
			]);
			expect(listener).toHaveBeenCalledTimes(1);
		} finally {
			window.removeEventListener(RECENT_POSTS_EVENT, listener);
		}
	});

	it("keeps recent history unchanged when the post is not present", () => {
		writeRecentPost(recentPost("resume", { id: "resume-1" }));

		const listener = vi.fn();
		window.addEventListener(RECENT_POSTS_EVENT, listener);

		try {
			removeRecentPost("resume", "missing");

			expect(readRecentPosts("resume").map((item) => item.id)).toEqual([
				"resume-1",
			]);
			expect(listener).not.toHaveBeenCalled();
		} finally {
			window.removeEventListener(RECENT_POSTS_EVENT, listener);
		}
	});

	it("clears recent posts for the selected kind only", () => {
		writeRecentPost(recentPost("community", { id: "community-1" }));
		writeRecentPost(recentPost("resume", { id: "resume-1" }));

		clearRecentPosts("community");

		expect(readRecentPosts("community")).toEqual([]);
		expect(readRecentPosts("resume").map((item) => item.id)).toEqual([
			"resume-1",
		]);
	});
});
