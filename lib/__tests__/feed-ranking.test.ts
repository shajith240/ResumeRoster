import { describe, expect, it } from "vitest";
import {
	formatCount,
	getBestScore,
	isPublicFeedResume,
	mergeReviewCountsFromRows,
	sortResumes,
	withResumeDefaults,
} from "@/lib/feed-ranking";
import type { ResumeSummary } from "@/lib/supabase/types";

function resume(overrides: Partial<ResumeSummary>): ResumeSummary {
	return {
		id: "resume-1",
		user_id: "user-1",
		title: "Resume",
		file_path: "user-1/resume.pdf",
		is_anonymous: true,
		status: "open",
		roast_count: 0,
		read_count: 0,
		review_queue_status: "active",
		activation_reviews_required: 0,
		activation_reviews_completed: 0,
		job_description: null,
		post_description: null,
		created_at: "2026-05-23T00:00:00.000Z",
		...overrides,
	};
}

describe("feed ranking", () => {
	it("formats compact counts for reads and roasts", () => {
		expect(formatCount(999)).toBe("999");
		expect(formatCount(1_500)).toBe("1.5K");
		expect(formatCount(15_000)).toBe("15K");
		expect(formatCount(1_200_000)).toBe("1.2M");
	});

	it("fills optional resume context defaults for legacy rows", () => {
		expect(
			withResumeDefaults({
				id: "resume-1",
				user_id: "user-1",
				title: "Resume",
				file_path: "user-1/resume.pdf",
				is_anonymous: true,
				status: "open",
				roast_count: 0,
				created_at: "2026-05-23T00:00:00.000Z",
			}),
		).toMatchObject({
			read_count: 0,
			review_queue_status: "active",
			activation_reviews_required: 0,
			activation_reviews_completed: 0,
			job_description: null,
			post_description: null,
		});
	});

	it("keeps waiting resumes out of public feed visibility", () => {
		expect(isPublicFeedResume(resume({ review_queue_status: "active" }))).toBe(
			true,
		);
		expect(isPublicFeedResume(resume({ review_queue_status: "waiting" }))).toBe(
			false,
		);
	});

	it("orders New by latest creation date", () => {
		const rows = [
			resume({ id: "old", created_at: "2026-05-20T00:00:00.000Z" }),
			resume({ id: "new", created_at: "2026-05-23T00:00:00.000Z" }),
		];

		expect(sortResumes(rows, "new").map((item) => item.id)).toEqual([
			"new",
			"old",
		]);
	});

	it("orders Top by roast count and then recency", () => {
		const rows = [
			resume({
				id: "newer-tie",
				roast_count: 4,
				created_at: "2026-05-23T00:00:00.000Z",
			}),
			resume({
				id: "older-tie",
				roast_count: 4,
				created_at: "2026-05-22T00:00:00.000Z",
			}),
			resume({ id: "low", roast_count: 1 }),
		];

		expect(sortResumes(rows, "top").map((item) => item.id)).toEqual([
			"newer-tie",
			"older-tie",
			"low",
		]);
	});

	it("orders Needs review by open status, low roast count, and recency", () => {
		const rows = [
			resume({
				id: "waiting-zero",
				review_queue_status: "waiting",
				activation_reviews_required: 2,
				activation_reviews_completed: 0,
				roast_count: 0,
				created_at: "2026-05-25T00:00:00.000Z",
			}),
			resume({
				id: "closed-zero",
				roast_count: 0,
				status: "closed",
				created_at: "2026-05-23T00:00:00.000Z",
			}),
			resume({
				id: "open-two",
				roast_count: 2,
				created_at: "2026-05-24T00:00:00.000Z",
			}),
			resume({
				id: "open-zero-new",
				roast_count: 0,
				created_at: "2026-05-23T00:00:00.000Z",
			}),
			resume({
				id: "open-zero-old",
				roast_count: 0,
				created_at: "2026-05-22T00:00:00.000Z",
			}),
		];

		expect(sortResumes(rows, "needs").map((item) => item.id)).toEqual([
			"open-zero-new",
			"open-zero-old",
			"open-two",
			"waiting-zero",
			"closed-zero",
		]);
	});

	it("balances Best between roast activity and freshness", () => {
		const now = new Date("2026-05-23T12:00:00.000Z").getTime();
		const activeOlder = resume({
			id: "active-older",
			roast_count: 5,
			created_at: "2026-05-22T12:00:00.000Z",
		});
		const freshQuiet = resume({
			id: "fresh-quiet",
			roast_count: 0,
			created_at: "2026-05-23T11:00:00.000Z",
		});

		expect(getBestScore(activeOlder, now)).toBeGreaterThan(
			getBestScore(freshQuiet, now),
		);
		expect(sortResumes([freshQuiet, activeOlder], "best", now)[0].id).toBe(
			"active-older",
		);
	});

	it("keeps active resumes ahead of waiting resumes in Best", () => {
		const active = resume({
			id: "active",
			created_at: "2026-05-22T12:00:00.000Z",
			review_queue_status: "active",
			roast_count: 0,
		});
		const waiting = resume({
			id: "waiting",
			created_at: "2026-05-23T12:00:00.000Z",
			review_queue_status: "waiting",
			activation_reviews_required: 2,
			activation_reviews_completed: 1,
			roast_count: 10,
		});

		expect(
			sortResumes(
				[waiting, active],
				"best",
				new Date("2026-05-24T00:00:00.000Z").getTime(),
			).map((item) => item.id),
		).toEqual(["active", "waiting"]);
	});

	it("merges live roast counts without trusting stale resume counters", () => {
		const merged = mergeReviewCountsFromRows(
			[
				resume({ id: "resume-1", roast_count: 9 }),
				resume({ id: "resume-2", roast_count: 5 }),
			],
			[
				{ resume_id: "resume-1" },
				{ resume_id: "resume-1" },
				{ resume_id: "unknown" },
			],
		);

		expect(merged.map((item) => [item.id, item.roast_count])).toEqual([
			["resume-1", 2],
			["resume-2", 0],
		]);
	});
});
