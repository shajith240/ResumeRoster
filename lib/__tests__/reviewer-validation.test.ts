import { describe, expect, it } from "vitest";
import {
	REVIEWER_FIELD_LIMITS,
	canShowReviewerProfile,
	getProofUrlIssue,
	getProfileRoleLabel,
	getReviewerApplicationIssue,
	getReviewerDisplayLabel,
	getReviewerTypeLabel,
	isCommunityRole,
	isReviewerType,
	parseReviewerExpertise,
} from "@/lib/reviewer-validation";

describe("reviewer validation", () => {
	it("guards reviewer enum values", () => {
		expect(isCommunityRole("both")).toBe(true);
		expect(isCommunityRole("mentor")).toBe(false);
		expect(isReviewerType("recruiter")).toBe(true);
		expect(isReviewerType("hr")).toBe(false);
	});

	it("parses reviewer expertise with dedupe and limits", () => {
		const expertise = parseReviewerExpertise(
			"ATS, ats\nRecruiter screen, x, This Expertise Label Is Too Long To Keep",
		);

		expect(expertise).toEqual(["ATS", "Recruiter screen"]);
		expect(expertise.length).toBeLessThanOrEqual(
			REVIEWER_FIELD_LIMITS.expertise,
		);
	});

	it("labels trusted reviewers without making self claims look verified", () => {
		expect(
			getReviewerDisplayLabel({
				reviewer_type: "recruiter",
				reviewer_verification_status: "verified",
			}),
		).toBe("Trusted reviewer");
		expect(
			getReviewerDisplayLabel({
				reviewer_type: "recruiter",
				reviewer_verification_status: "none",
			}),
		).toBe("Recruiter");
		expect(getReviewerTypeLabel("placed_professional")).toBe(
			"Placed professional",
		);
	});

	it("uses profile role before reviewer-specific identity on profiles", () => {
		expect(
			getProfileRoleLabel({
				college: null,
				community_role: "reviewer",
				current_position: "Recruiter / HR",
				reviewer_type: "recruiter",
				target_role: null,
			}),
		).toBe("Recruiter / HR");
		expect(
			getProfileRoleLabel({
				college: null,
				community_role: "both",
				current_position: "Student",
				reviewer_type: "hiring_manager",
				target_role: "SDE intern",
			}),
		).toBe("Student");
		expect(
			getProfileRoleLabel({
				college: null,
				community_role: "candidate",
				current_position: null,
				reviewer_type: null,
				target_role: "Backend intern",
			}),
		).toBe("Intern");
		expect(
			getProfileRoleLabel({
				college: null,
				community_role: "reviewer",
				current_position: null,
				reviewer_type: "engineer",
				target_role: null,
			}),
		).toBe("Reviewer");
	});

	it("validates proof links for reviewer applications", () => {
		expect(getProofUrlIssue("")).toBe("Add a public proof link before applying.");
		expect(getProofUrlIssue("javascript:alert(1)")).toBe(
			"Use a public http or https proof link.",
		);
		expect(getProofUrlIssue("https://www.linkedin.com/in/example")).toBe("");
	});

	it("requires reviewer identity before applying for trust", () => {
		expect(
			getReviewerApplicationIssue({
				communityRole: "candidate",
				note: "",
				proofUrl: "https://example.com",
				reviewerType: "engineer",
			}),
		).toBe("Choose Review resumes or Both before applying.");
		expect(
			getReviewerApplicationIssue({
				communityRole: "reviewer",
				note: "",
				proofUrl: "https://example.com",
				reviewerType: null,
			}),
		).toBe("Choose the reviewer role you want verified.");
		expect(
			getReviewerApplicationIssue({
				communityRole: "both",
				note: "",
				proofUrl: "https://example.com",
				reviewerType: "career_coach",
			}),
		).toBe("");
		expect(canShowReviewerProfile("reviewer", "engineer")).toBe(true);
	});
});
