import { describe, expect, it } from "vitest";
import {
	getCommunityRoleForOnboardingGoal,
	getOnboardingDestination,
	getOnboardingIssue,
	getPersonaProfileLabel,
	getReviewerTypeForOnboarding,
	isOnboardingGoalId,
	isOnboardingPersonaId,
	normalizeOnboardingTargetRole,
	parseOnboardingExpertise,
} from "@/lib/onboarding-validation";

describe("onboarding validation", () => {
	it("guards onboarding enum values", () => {
		expect(isOnboardingGoalId("get_feedback")).toBe(true);
		expect(isOnboardingGoalId("mentor_only")).toBe(false);
		expect(isOnboardingPersonaId("recruiter_hr")).toBe(true);
		expect(isOnboardingPersonaId("hr")).toBe(false);
	});

	it("maps goals to existing community roles", () => {
		expect(getCommunityRoleForOnboardingGoal("get_feedback")).toBe("candidate");
		expect(getCommunityRoleForOnboardingGoal("review_resumes")).toBe(
			"reviewer",
		);
		expect(getCommunityRoleForOnboardingGoal("both")).toBe("both");
	});

	it("maps personas to reviewer types only when reviewing is part of the goal", () => {
		expect(getReviewerTypeForOnboarding("get_feedback", "recruiter_hr")).toBe(
			null,
		);
		expect(getReviewerTypeForOnboarding("review_resumes", "recruiter_hr")).toBe(
			"recruiter",
		);
		expect(getReviewerTypeForOnboarding("both", "hiring_manager")).toBe(
			"hiring_manager",
		);
		expect(getReviewerTypeForOnboarding("review_resumes", "job_seeker")).toBe(
			"other",
		);
	});

	it("maps personas to public profile role labels", () => {
		expect(getPersonaProfileLabel("student")).toBe("Student");
		expect(getPersonaProfileLabel("recruiter_hr")).toBe("Recruiter / HR");
		expect(getPersonaProfileLabel("career_switcher")).toBe("Career switcher");
	});

	it("builds the personalized first destination", () => {
		expect(getOnboardingDestination("get_feedback")).toBe(
			"/feed?welcome=candidate",
		);
		expect(getOnboardingDestination("review_resumes")).toBe(
			"/feed?sort=needs&welcome=reviewer",
		);
		expect(getOnboardingDestination("both")).toBe(
			"/feed?sort=needs&welcome=both",
		);
	});

	it("normalizes optional setup fields", () => {
		expect(normalizeOnboardingTargetRole("  Frontend   Engineer  ")).toBe(
			"Frontend Engineer",
		);
		expect(parseOnboardingExpertise(["ATS", "ats", "Recruiter screen"])).toEqual(
			["ATS", "Recruiter screen"],
		);
	});

	it("returns user-facing issues for missing choices", () => {
		expect(getOnboardingIssue({ goalId: "", personaId: "student" })).toBe(
			"Choose what you want to do on Linted.",
		);
		expect(getOnboardingIssue({ goalId: "both", personaId: "" })).toBe(
			"Choose the option that best describes you.",
		);
		expect(getOnboardingIssue({ goalId: "both", personaId: "student" })).toBe(
			"",
		);
	});
});
