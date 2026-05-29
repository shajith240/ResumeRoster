import { describe, expect, it } from "vitest";
import { canPreviewResumeFile } from "@/lib/resume-file-access";

describe("resume file access", () => {
	it("allows owners to preview any existing resume status", () => {
		expect(
			canPreviewResumeFile({
				resumeOwnerId: "owner",
				status: "draft",
				userId: "owner",
			}),
		).toBe(true);
	});

	it("allows signed-in users to preview all visible legacy statuses", () => {
		for (const status of ["open", "roasted", "closed"]) {
			expect(
				canPreviewResumeFile({
					resumeOwnerId: "owner",
					status,
					userId: "reviewer",
				}),
			).toBe(true);
		}
	});

	it("blocks non-owners from non-visible statuses", () => {
		expect(
			canPreviewResumeFile({
				resumeOwnerId: "owner",
				status: "draft",
				userId: "reviewer",
			}),
		).toBe(false);
	});
});
