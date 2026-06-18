import { describe, expect, it } from "vitest";
import {
	buildGuidedReviewContent,
	getGuidedReviewIssue,
	isGuidedReviewIssueType,
} from "@/lib/guided-review";

describe("guided review validation", () => {
	it("guards guided issue types", () => {
		expect(isGuidedReviewIssueType("clarity")).toBe(true);
		expect(isGuidedReviewIssueType("resume_score")).toBe(false);
	});

	it("rejects missing issue type and shallow feedback", () => {
		expect(
			getGuidedReviewIssue({
				issue: "The project is unclear because the result is not obvious.",
				issueType: "",
				suggestion:
					"Rewrite it with the system, metric, and final outcome in one bullet.",
			}),
		).toBe("Choose the resume issue you are reviewing.");

		expect(
			getGuidedReviewIssue({
				issue: "Looks good",
				issueType: "clarity",
				suggestion: "Nice resume",
			}),
		).toBe("Explain the issue with one specific resume detail.");
	});

	it("requires a concrete suggestion", () => {
		expect(
			getGuidedReviewIssue({
				issue:
					"The first project bullet lists tools, but it does not say what changed for users or the business.",
				issueType: "missing_impact",
				suggestion: "Add impact.",
			}),
		).toBe("Give one concrete rewrite, reorder, removal, or quantification step.");
	});

	it("accepts and composes a specific guided lint pass", () => {
		const issue =
			"The backend internship project has a strong stack, but the bullet stops at implementation and never explains latency, scale, reliability, or user impact.";
		const suggestion =
			"Rewrite it as: Built a Node/Postgres API for 1,200 monthly users, cut dashboard load time by 38%, and added retry logging to reduce failed syncs.";

		expect(
			getGuidedReviewIssue({
				issue,
				issueType: "missing_impact",
				suggestion,
			}),
		).toBe("");

		expect(
			buildGuidedReviewContent({
				issue,
				issueType: "missing_impact",
				suggestion,
			}),
		).toContain("**Missing impact**");
	});
});
