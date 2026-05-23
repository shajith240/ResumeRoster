import { describe, expect, it } from "vitest";
import {
	RESUME_PRIVACY_MODES,
	allowsResumePreviewInteractions,
	getPrivacyModeHelpText,
	isAnonymousResumeMode,
	isResumePreviewLocked,
	isResumePrivacyMode,
} from "@/lib/resume-privacy";
import { buildNameRedactionCandidates } from "@/lib/pdf-redaction";

describe("resume privacy modes", () => {
	it("recognizes supported privacy modes", () => {
		expect(RESUME_PRIVACY_MODES).toEqual([
			"public",
			"contact_hidden",
			"anonymous",
		]);
		expect(isResumePrivacyMode("contact_hidden")).toBe(true);
		expect(isResumePrivacyMode("private")).toBe(false);
	});

	it("maps public versus anonymous feed identity", () => {
		expect(isAnonymousResumeMode("public")).toBe(false);
		expect(isAnonymousResumeMode("contact_hidden")).toBe(true);
		expect(isAnonymousResumeMode("anonymous")).toBe(true);
	});

	it("returns beginner-readable help copy", () => {
		expect(getPrivacyModeHelpText("anonymous")).toContain("Strongest privacy");
	});

	it("locks copy and links only for fully anonymous previews", () => {
		expect(allowsResumePreviewInteractions("public")).toBe(true);
		expect(allowsResumePreviewInteractions("contact_hidden")).toBe(true);
		expect(allowsResumePreviewInteractions("anonymous")).toBe(false);
		expect(isResumePreviewLocked("public")).toBe(false);
		expect(isResumePreviewLocked("anonymous")).toBe(true);
	});

	it("builds conservative name candidates from profile data", () => {
		expect(
			buildNameRedactionCandidates({
				email: "jane.doe@example.com",
				fullName: "Jane Doe",
				username: "jane_doe",
			}),
		).toEqual(["Jane Doe"]);
	});
});
