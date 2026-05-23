export type SavedResumeReference = {
	resume_id: string;
};

export type SaveButtonState = {
	label: string;
	ariaLabel: string;
};

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
