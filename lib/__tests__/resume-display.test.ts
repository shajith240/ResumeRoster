import { describe, expect, it } from "vitest";
import {
	getProfileDisplayName,
	getResumeAffiliationLabel,
	getResumePosterLabel,
	getResumeRoleLabel,
	roleFromResumeTitle,
} from "@/lib/resume-display";
import type { ResumeSummary } from "@/lib/supabase/types";

const baseResume: ResumeSummary = {
	id: "resume-1",
	user_id: "user-1",
	title: "student applying for SDE internship",
	file_path: "user-1/resume.pdf",
	is_anonymous: true,
	status: "open",
	roast_count: 0,
	read_count: 0,
	job_description: null,
	post_description: null,
	created_at: "2026-05-23T00:00:00.000Z",
};

describe("resume display labels", () => {
	it("infers a role from common resume title keywords", () => {
		expect(roleFromResumeTitle("MBA consulting resume")).toBe("MBA");
		expect(roleFromResumeTitle("Data analyst resume")).toBe("Data Analyst");
		expect(roleFromResumeTitle("Product manager resume")).toBe("Product Manager");
		expect(roleFromResumeTitle("SDE intern resume")).toBe("SDE Intern");
		expect(roleFromResumeTitle("Generic software resume")).toBe("Full-time SDE");
	});

	it("prefers full name over username for public profiles", () => {
		expect(
			getProfileDisplayName({
				id: "user-1",
				full_name: "Shajith Bathina",
				username: "shajith240",
			}),
		).toBe("Shajith Bathina");
	});

	it("hides poster identity for anonymous resumes", () => {
		expect(getResumePosterLabel(baseResume)).toBe("posted anonymously");
		expect(getResumeAffiliationLabel(baseResume)).toBe("Anonymous college");
	});

	it("uses public profile details when a resume is not anonymous", () => {
		const publicResume = { ...baseResume, is_anonymous: false };
		const profile = {
			id: "user-1",
			full_name: "Shajith Bathina",
			username: "shajith",
			college: "IIT(ISM) Dhanbad",
			current_position: "SDE intern",
			target_role: "Full-time SDE",
		};

		expect(getResumePosterLabel(publicResume, profile)).toBe(
			"posted by Shajith Bathina",
		);
		expect(getResumeRoleLabel(publicResume, profile)).toBe("SDE intern");
		expect(getResumeAffiliationLabel(publicResume, profile)).toBe(
			"IIT(ISM) Dhanbad",
		);
	});
});
