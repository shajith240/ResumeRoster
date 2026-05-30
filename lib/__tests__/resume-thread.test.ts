import { describe, expect, it } from "vitest";
import {
	buildThreadReviewTree,
	buildThreadReviews,
	getReactionBlockReason,
	getReplyBlockReason,
	normalizeReview,
} from "@/lib/resume-thread";
import type { ResumeSummary, Review } from "@/lib/supabase/types";

const resume: ResumeSummary = {
	id: "resume-1",
	user_id: "owner-1",
	title: "SDE resume",
	file_path: "owner-1/resume.pdf",
	is_anonymous: true,
	status: "open",
	roast_count: 0,
	read_count: 0,
	job_description: null,
	post_description: null,
	created_at: "2026-05-23T00:00:00.000Z",
};

function review(overrides: Partial<Review>): Review {
	return {
		id: "review-1",
		resume_id: "resume-1",
		parent_id: null,
		author_id: "reviewer-1",
		content: "Add stronger quantified impact to the project bullets.",
		helpful_votes: 0,
		dislike_count: 0,
		reply_count: 0,
		is_deleted: false,
		deleted_at: null,
		created_at: "2026-05-23T00:00:00.000Z",
		...overrides,
	};
}

describe("resume thread rules", () => {
	it("blocks resume owners and review authors from reacting", () => {
		const targetReview = review({ author_id: "reviewer-1" });

		expect(
			getReactionBlockReason({ id: "owner-1" }, resume, targetReview),
		).toBe("Resume owners cannot react to feedback on their own resume.");

		expect(
			getReactionBlockReason({ id: "reviewer-1" }, resume, targetReview),
		).toBe("You cannot react to your own feedback.");

		expect(
			getReactionBlockReason({ id: "reviewer-2" }, resume, targetReview),
		).toBeNull();
	});

	it("allows resume owners to reply for clarification when it is not their own review", () => {
		expect(
			getReplyBlockReason({
				isClosed: false,
				isDeleted: false,
				isOwnReview: false,
				migrationMessage: "Run migrations.",
				replySchemaReady: true,
			}),
		).toBeNull();
	});

	it("blocks closed, deleted, own, and unavailable reply states", () => {
		expect(
			getReplyBlockReason({
				isClosed: true,
				isDeleted: false,
				isOwnReview: false,
				migrationMessage: "Run migrations.",
				replySchemaReady: true,
			}),
		).toBe("This resume is closed for new replies.");

		expect(
			getReplyBlockReason({
				isClosed: false,
				isDeleted: true,
				isOwnReview: false,
				migrationMessage: "Run migrations.",
				replySchemaReady: true,
			}),
		).toBe("Deleted feedback cannot receive new replies.");

		expect(
			getReplyBlockReason({
				isClosed: false,
				isDeleted: false,
				isOwnReview: true,
				migrationMessage: "Run migrations.",
				replySchemaReady: true,
			}),
		).toBe("You cannot reply to your own feedback.");

		expect(
			getReplyBlockReason({
				isClosed: false,
				isDeleted: false,
				isOwnReview: false,
				migrationMessage: "Run migrations.",
				replySchemaReady: false,
			}),
		).toBe("Run migrations. Replies are not ready yet.");
	});

	it("normalizes legacy review rows with missing optional fields", () => {
		expect(
			normalizeReview({
				id: "review-1",
				resume_id: "resume-1",
				author_id: "reviewer-1",
				content: "Useful feedback goes here.",
				helpful_votes: 1,
				created_at: "2026-05-23T00:00:00.000Z",
			}),
		).toMatchObject({
			parent_id: null,
			dislike_count: 0,
			reply_count: 0,
			is_deleted: false,
			deleted_at: null,
		});
	});

	it("flattens threaded reviews with top-level score order and reply chronology", () => {
		const reviews = [
			review({
				id: "low-score",
				helpful_votes: 1,
				created_at: "2026-05-23T02:00:00.000Z",
			}),
			review({
				id: "top-score",
				helpful_votes: 5,
				created_at: "2026-05-23T01:00:00.000Z",
			}),
			review({
				id: "reply-new",
				parent_id: "top-score",
				created_at: "2026-05-23T04:00:00.000Z",
			}),
			review({
				id: "reply-old",
				parent_id: "top-score",
				created_at: "2026-05-23T03:00:00.000Z",
			}),
		];

		const flattened = buildThreadReviews(reviews, new Set());

		expect(flattened.map((item) => item.id)).toEqual([
			"top-score",
			"reply-old",
			"reply-new",
			"low-score",
		]);
		expect(flattened.find((item) => item.id === "top-score")?.childCount).toBe(2);
		expect(flattened.find((item) => item.id === "reply-old")?.depth).toBe(1);
	});

	it("hides collapsed replies while preserving parent child counts", () => {
		const flattened = buildThreadReviews(
			[
				review({ id: "parent", helpful_votes: 1 }),
				review({ id: "child", parent_id: "parent" }),
			],
			new Set(["parent"]),
		);

		expect(flattened.map((item) => item.id)).toEqual(["parent"]);
		expect(flattened[0].childCount).toBe(1);
	});

	it("builds nested review trees for continuous reply connectors", () => {
		const tree = buildThreadReviewTree(
			[
				review({ id: "parent", helpful_votes: 2 }),
				review({ id: "child", parent_id: "parent" }),
				review({ id: "grandchild", parent_id: "child" }),
			],
			new Set(),
		);

		expect(tree).toHaveLength(1);
		expect(tree[0].id).toBe("parent");
		expect(tree[0].children[0].id).toBe("child");
		expect(tree[0].children[0].depth).toBe(1);
		expect(tree[0].children[0].children[0].id).toBe("grandchild");
		expect(tree[0].children[0].children[0].depth).toBe(2);
	});
});
