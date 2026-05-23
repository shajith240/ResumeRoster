import { describe, expect, it } from "vitest";
import {
	getSaveButtonState,
	getSavedResumeIds,
	mergeSavedResumeState,
} from "@/lib/saved-resumes";

describe("saved resumes", () => {
	it("collects saved resume ids from database rows", () => {
		const ids = getSavedResumeIds([
			{ resume_id: "resume-1" },
			{ resume_id: "resume-2" },
			{ resume_id: "resume-1" },
		]);

		expect([...ids].sort()).toEqual(["resume-1", "resume-2"]);
	});

	it("merges saved state into resume rows without dropping resume fields", () => {
		const merged = mergeSavedResumeState(
			[
				{ id: "resume-1", title: "Saved resume" },
				{ id: "resume-2", title: "Open resume" },
			],
			new Set(["resume-1"]),
		);

		expect(merged).toEqual([
			{ id: "resume-1", title: "Saved resume", is_saved: true },
			{ id: "resume-2", title: "Open resume", is_saved: false },
		]);
	});

	it("returns stable button labels for save toggles", () => {
		expect(getSaveButtonState(false)).toEqual({
			label: "Save",
			ariaLabel: "Save resume",
		});
		expect(getSaveButtonState(true)).toEqual({
			label: "Saved",
			ariaLabel: "Remove saved resume",
		});
		expect(getSaveButtonState(false, true).label).toBe("Saving...");
		expect(getSaveButtonState(true, true).label).toBe("Removing...");
	});
});
