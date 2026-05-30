export type SavedResumeReference = {
	resume_id: string;
};

export type SaveButtonState = {
	label: string;
	ariaLabel: string;
};

type SavedResumeError = {
	code?: string;
	details?: string;
	hint?: string;
	message?: string;
};

export const SAVED_RESUMES_UNAVAILABLE_MESSAGE =
	"Saved resumes are temporarily unavailable. Please refresh and try again.";

export function isSavedResumeSchemaMissingError(error: SavedResumeError | null) {
	if (!error) return false;

	const message = [error.message, error.details, error.hint]
		.filter(Boolean)
		.join(" ");
	const code = error.code ?? "";

	return (
		code === "42P01" ||
		(code === "PGRST205" && /saved_resumes/i.test(message)) ||
		/Could not find the table ['"]?public\.saved_resumes['"]?/i.test(message) ||
		/relation ['"]?(public\.)?saved_resumes['"]? does not exist/i.test(message) ||
		(/schema cache/i.test(message) && /saved_resumes/i.test(message))
	);
}

export function getSavedResumeIds(savedRows: SavedResumeReference[]) {
	return new Set(savedRows.map((row) => row.resume_id));
}

export function mergeSavedResumeState<T extends { id: string }>(
	resumes: T[],
	savedResumeIds: ReadonlySet<string>,
) {
	return resumes.map((resume) => ({
		...resume,
		is_saved: savedResumeIds.has(resume.id),
	}));
}

export function getSaveButtonState(
	isSaved: boolean,
	isPending = false,
): SaveButtonState {
	if (isPending) {
		return {
			label: isSaved ? "Removing..." : "Saving...",
			ariaLabel: isSaved ? "Remove saved resume" : "Save resume",
		};
	}

	return {
		label: isSaved ? "Saved" : "Save",
		ariaLabel: isSaved ? "Remove saved resume" : "Save resume",
	};
}
