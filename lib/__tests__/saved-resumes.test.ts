import { describe, expect, it } from "vitest";
import {
	getSaveButtonState,
	getSavedResumeIds,
	isSavedResumeSchemaMissingError,
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
		expect(getSaveButtonState(false, "save")).toEqual({
			label: "Saving...",
			ariaLabel: "Saving resume",
		});
		expect(getSaveButtonState(true, "save")).toEqual({
			label: "Saving...",
			ariaLabel: "Saving resume",
		});
		expect(getSaveButtonState(true, "remove")).toEqual({
			label: "Removing...",
			ariaLabel: "Removing saved resume",
		});
		expect(getSaveButtonState(false, "remove")).toEqual({
			label: "Removing...",
			ariaLabel: "Removing saved resume",
		});
	});

	it("detects only missing saved-resume schema errors", () => {
		expect(
			isSavedResumeSchemaMissingError({
				code: "PGRST205",
				message:
					"Could not find the table 'public.saved_resumes' in the schema cache",
			}),
		).toBe(true);
		expect(
			isSavedResumeSchemaMissingError({
				code: "42P01",
				message: 'relation "public.saved_resumes" does not exist',
			}),
		).toBe(true);
	});

	it("does not mislabel saved-resume permission errors as migrations", () => {
		expect(
			isSavedResumeSchemaMissingError({
				code: "42501",
				message: 'permission denied for table "saved_resumes"',
			}),
		).toBe(false);
		expect(
			isSavedResumeSchemaMissingError({
				code: "42501",
				message:
					'new row violates row-level security policy for table "saved_resumes"',
			}),
		).toBe(false);
	});
});
