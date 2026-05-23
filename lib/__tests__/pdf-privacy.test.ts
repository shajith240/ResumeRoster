import { describe, expect, it } from "vitest";
import {
	assessResumePrivacyText,
	containsContactSignal,
	getPrivacyUploadIssue,
} from "@/lib/pdf-privacy";

describe("pdf privacy checks", () => {
	it("detects obvious emails, phones, and profile links", () => {
		const assessment = assessResumePrivacyText(
			"Email test@example.com phone +1 (555) 123-4567 linkedin.com/in/me",
		);

		expect(assessment.findings.map((finding) => finding.type)).toEqual([
			"email",
			"phone",
			"link",
		]);
	});

	it("ignores normal resume copy without contact signals", () => {
		const text =
			"Built a distributed chat system with WebSockets and reduced latency by 35 percent.";

		expect(assessResumePrivacyText(text).findings).toEqual([]);
		expect(containsContactSignal(text)).toBe(false);
	});

	it("maps scan states to upload-blocking messages", () => {
		expect(getPrivacyUploadIssue("checking")).toBe(
			"Wait for the PDF privacy check to finish.",
		);
		expect(getPrivacyUploadIssue("warning")).toBe(
			"Remove detected contact details from the PDF, then upload it again.",
		);
		expect(getPrivacyUploadIssue("clear")).toBe("");
	});
});
