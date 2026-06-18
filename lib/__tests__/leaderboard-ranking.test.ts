import { describe, expect, it } from "vitest";
import {
	bestReviewMap,
	enhanceReviewer,
	lintPoints,
	roleTag,
	sortReviewers,
} from "@/lib/leaderboard-ranking";

describe("leaderboard ranking", () => {
	it("weights helpful votes and caps the consistency bonus", () => {
		expect(lintPoints(2)).toBe(10);
		expect(lintPoints(2, 3)).toBe(13);
		expect(lintPoints(2, 80)).toBe(60);
	});

	it("derives professional role tags from profile context", () => {
		expect(roleTag({ college: null, current_position: "SDE intern", target_role: "Student", helpful_votes: 0, roast_count: 0 })).toBe("Intern");
		expect(roleTag({ college: "IIT", target_role: "SDE intern", helpful_votes: 0, roast_count: 0 })).toBe("Intern");
		expect(roleTag({ college: "IIT Hyderabad", target_role: "", helpful_votes: 0, roast_count: 0 })).toBe("Student");
		expect(roleTag({ college: null, target_role: "Career switcher", helpful_votes: 0, roast_count: 0 })).toBe("Career Switcher");
		expect(roleTag({ college: null, target_role: "Backend intern", helpful_votes: 0, roast_count: 0 })).toBe("Intern");
		expect(roleTag({ college: null, target_role: "Product Manager", helpful_votes: 0, roast_count: 0 })).toBe("Job Seeker");
	});

	it("sorts by lint points, helpful votes, then review count", () => {
		expect(
			sortReviewers([
				{ id: "a", roast_points: 0, helpful_votes: 0, roast_count: 1 },
				{ id: "b", roast_points: 2, helpful_votes: 2, roast_count: 0 },
				{ id: "c", roast_points: 2, helpful_votes: 2, roast_count: 2 },
			]).map((reviewer) => reviewer.id),
		).toEqual(["c", "b", "a"]);
	});

	it("selects each reviewer's most helpful recent review", () => {
		const top = bestReviewMap([
			{
				id: "old",
				author_id: "user-1",
				created_at: "2026-05-20T00:00:00.000Z",
				helpful_votes: 4,
			},
			{
				id: "recent",
				author_id: "user-1",
				created_at: "2026-05-21T00:00:00.000Z",
				helpful_votes: 4,
			},
			{
				id: "winner",
				author_id: "user-2",
				created_at: "2026-05-19T00:00:00.000Z",
				helpful_votes: 9,
			},
		]);

		expect(top["user-1"].id).toBe("recent");
		expect(top["user-2"].id).toBe("winner");
	});

	it("enhances a reviewer with display ranking fields", () => {
		const enhanced = enhanceReviewer(
			{
				id: "user-1",
				college: "IIT",
				target_role: "Student",
				helpful_votes: 1,
				roast_count: 2,
			},
			{
				id: "review-1",
				resume_id: "resume-1",
				content: "Add metrics to the project bullets.",
				helpful_votes: 3,
				created_at: "2026-05-21T00:00:00.000Z",
			},
		);

		expect(enhanced.roast_points).toBe(7);
		expect(enhanced.role_tag).toBe("Student");
		expect(enhanced.top_roast?.resume_id).toBe("resume-1");
	});
});
