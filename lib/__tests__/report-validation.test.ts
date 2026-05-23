import { describe, expect, it } from "vitest";
import {
	getReportIssue,
	isReportReason,
	REPORT_DETAILS_MAX_LENGTH,
} from "@/lib/report-validation";

describe("report validation", () => {
	it("accepts known moderation reasons", () => {
		expect(isReportReason("personal_info")).toBe(true);
		expect(isReportReason("harassment")).toBe(true);
		expect(isReportReason("made-up")).toBe(false);
	});

	it("requires a valid reason", () => {
		expect(getReportIssue({ reason: "made-up", details: "" })).toBe(
			"Choose a report reason.",
		);
	});

	it("keeps details inside the database limit", () => {
		expect(
			getReportIssue({
				reason: "spam",
				details: "a".repeat(REPORT_DETAILS_MAX_LENGTH + 1),
			}),
		).toBe(`Keep report details under ${REPORT_DETAILS_MAX_LENGTH} characters.`);
	});

	it("asks for context when the reason is other", () => {
		expect(getReportIssue({ reason: "other", details: "too short" })).toBe(
			"Add a short note so moderators know what to review.",
		);

		expect(
			getReportIssue({
				reason: "other",
				details: "This looks like a different moderation issue.",
			}),
		).toBe("");
	});

	it("allows specific reasons without extra notes", () => {
		expect(getReportIssue({ reason: "personal_info", details: "" })).toBe("");
	});
});
