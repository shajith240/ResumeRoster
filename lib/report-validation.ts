export const REPORT_DETAILS_MAX_LENGTH = 800;

export const REPORT_REASON_OPTIONS = [
	{
		value: "personal_info",
		label: "Personal info",
		description: "Names, emails, phone numbers, links, or IDs were exposed.",
	},
	{
		value: "harassment",
		label: "Harassment",
		description: "The content attacks the person instead of staying useful.",
	},
	{
		value: "spam",
		label: "Spam",
		description: "Promotional, repeated, or low-effort content.",
	},
	{
		value: "unsafe",
		label: "Unsafe",
		description: "Threats, hateful content, or clearly harmful advice.",
	},
	{
		value: "off_topic",
		label: "Off topic",
		description: "Not useful for the profile, resume, or feedback thread.",
	},
	{
		value: "other",
		label: "Other",
		description: "Something else the moderation queue should review.",
	},
] as const;

export type ReportReason = (typeof REPORT_REASON_OPTIONS)[number]["value"];

const REPORT_REASONS = new Set<string>(
	REPORT_REASON_OPTIONS.map((option) => option.value),
);

export function isReportReason(value: string): value is ReportReason {
	return REPORT_REASONS.has(value);
}

export function getReportIssue({
	details,
	reason,
}: {
	details: string;
	reason: string;
}) {
	if (!isReportReason(reason)) {
		return "Choose a report reason.";
	}

	if (details.trim().length > REPORT_DETAILS_MAX_LENGTH) {
		return `Keep report details under ${REPORT_DETAILS_MAX_LENGTH} characters.`;
	}

	if (reason === "other" && details.trim().length < 10) {
		return "Add a short note so moderators know what to review.";
	}

	return "";
}
