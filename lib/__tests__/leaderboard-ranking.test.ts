import { describe, expect, it } from "vitest";
import {
	bestRoastMap,
	enhanceRoaster,
	improvement,
	roastPoints,
	roleTag,
	sortRoasters,
} from "@/lib/leaderboard-ranking";

describe("leaderboard ranking", () => {
	it("scores roast points from helpful votes and roast count", () => {
		expect(roastPoints(2, 3)).toBe(420);
	});

	it("keeps improvement in a sensible range", () => {
		expect(improvement(0, 0)).toBe(18);
		expect(improvement(100, 100)).toBe(96);
	});

	it("derives professional role tags from profile context", () => {
		expect(roleTag({ college: "IIT", target_role: "SDE intern", helpful_votes: 0, roast_count: 0 })).toBe("Student");
		expect(roleTag({ college: null, target_role: "Career switcher", helpful_votes: 0, roast_count: 0 })).toBe("Career Switcher");
		expect(roleTag({ college: null, target_role: "Backend intern", helpful_votes: 0, roast_count: 0 })).toBe("Intern");
		expect(roleTag({ college: null, target_role: "Product Manager", helpful_votes: 0, roast_count: 0 })).toBe("Job Seeker");
	});

	it("sorts by points, helpful votes, then roast count", () => {
		expect(
			sortRoasters([
				{ id: "a", roast_points: 60, helpful_votes: 0, roast_count: 1 },
				{ id: "b", roast_points: 240, helpful_votes: 2, roast_count: 0 },
				{ id: "c", roast_points: 240, helpful_votes: 1, roast_count: 2 },
			]).map((roaster) => roaster.id),
		).toEqual(["b", "c", "a"]);
	});

	it("selects each roaster's most helpful recent roast", () => {
		const top = bestRoastMap([
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

	it("enhances a roaster with display ranking fields", () => {
		const enhanced = enhanceRoaster(
			{
				id: "user-1",
				college: "IIT",
				target_role: "Student",
				helpful_votes: 1,
				roast_count: 2,
			},
			{
				id: "roast-1",
				resume_id: "resume-1",
				content: "Add metrics to the project bullets.",
				helpful_votes: 3,
				created_at: "2026-05-21T00:00:00.000Z",
			},
		);

		expect(enhanced.roast_points).toBe(240);
		expect(enhanced.role_tag).toBe("Student");
		expect(enhanced.top_roast?.resume_id).toBe("resume-1");
	});
});
