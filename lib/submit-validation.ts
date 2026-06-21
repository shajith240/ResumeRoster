export const TARGET_ROLES = [
	"SDE Intern",
	"Full-time SDE",
	"Senior SDE",
	"ML / AI Engineer",
	"Data Scientist",
	"Data Analyst",
	"Product Manager",
	"PM Intern",
	"Business Analyst",
	"Consultant",
	"MBA",
	"Other",
] as const;

export const JOB_DESCRIPTION_MIN_LENGTH = 20;
export const JOB_DESCRIPTION_MAX_LENGTH = 8000;
export const POST_DESCRIPTION_MIN_LENGTH = 10;
export const POST_DESCRIPTION_MAX_LENGTH = 4000;

export type SubmitValidationInput = {
	title: string;
	hasFile: boolean;
	jobDescription: string;
	postDescription: string;
	privacyIssue?: string;
};

export function cleanResumeFileName(name: string) {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9.]+/g, "-")
		.replace(/-+/g, "-");
}

export function formatFileSize(size: number) {
	return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

export function getSubmitIssue({
	title,
	hasFile,
	jobDescription,
	postDescription,
	privacyIssue,
}: SubmitValidationInput) {
	const trimmedTitle = title.trim();
	const trimmedJobDescription = jobDescription.trim();
	const trimmedPostDescription = postDescription.trim();
	const jobDescriptionRemaining = Math.max(
		JOB_DESCRIPTION_MIN_LENGTH - trimmedJobDescription.length,
		0,
	);
	const postDescriptionRemaining = Math.max(
		POST_DESCRIPTION_MIN_LENGTH - trimmedPostDescription.length,
		0,
	);

	if (!trimmedTitle) return "Add a resume title.";
	if (!hasFile) return "Upload a PDF resume.";
	if (privacyIssue) return privacyIssue;

	if (jobDescriptionRemaining > 0) {
		return `Add ${jobDescriptionRemaining} more ${
			jobDescriptionRemaining === 1 ? "character" : "characters"
		} to the job description.`;
	}

	if (postDescriptionRemaining > 0) {
		return `Add ${postDescriptionRemaining} more ${
			postDescriptionRemaining === 1 ? "character" : "characters"
		} to what you want help with.`;
	}

	return "";
}
