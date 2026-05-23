import { describe, expect, it } from "vitest";
import {
	PROFILE_FIELD_LIMITS,
	buildUsernameCandidates,
	fallbackSkills,
	limitText,
	normalizeUsername,
	parseSkills,
	usernameTakenMessage,
} from "@/lib/profile-validation";

describe("profile validation", () => {
	it("normalizes usernames to the public handle format", () => {
		expect(normalizeUsername("@Sha Jith!!_240")).toBe("shajith_240");
	});

	it("limits text without adding hidden formatting", () => {
		expect(limitText("ResumeRoster", 6)).toBe("Resume");
	});

	it("builds unique-looking username suggestions within the DB limit", () => {
		const suggestions = buildUsernameCandidates("shajith");

		expect(suggestions).toContain("shajith24");
		expect(suggestions.length).toBeLessThanOrEqual(10);
		expect(
			suggestions.every(
				(suggestion) => suggestion.length <= PROFILE_FIELD_LIMITS.username,
			),
		).toBe(true);
	});

	it("explains taken usernames in plain language", () => {
		expect(usernameTakenMessage([])).toBe(
			"That username is already taken. Try another name.",
		);
		expect(usernameTakenMessage(["shajith24", "shajithdev"])).toBe(
			"That username is already taken. Try @shajith24, @shajithdev.",
		);
	});

	it("parses skills from comma and newline input with dedupe and limits", () => {
		expect(
			parseSkills(
				"React, react\nATS, x, This Skill Name Is Far Beyond Thirty Two Characters",
			),
		).toEqual(["React", "ATS"]);
	});

	it("falls back to role skills plus core review skills", () => {
		expect(
			fallbackSkills({
				current_position: "Frontend SDE Intern",
				target_role: null,
			}),
		).toEqual([
			"Frontend",
			"SDE",
			"Intern",
			"Resume Review",
			"ATS",
			"Clarity",
			"Proof",
			"Recruiter Screen",
		]);
	});
});
