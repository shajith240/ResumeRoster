export const COMMUNITY_ROLES = ["candidate", "reviewer", "both"] as const;
export const REVIEWER_TYPES = [
	"student",
	"placed_professional",
	"recruiter",
	"hiring_manager",
	"engineer",
	"designer",
	"product_manager",
	"career_coach",
	"founder",
	"other",
] as const;
const REVIEWER_APPLICATION_STATUSES = [
	"pending",
	"approved",
	"rejected",
] as const;

export type CommunityRole = (typeof COMMUNITY_ROLES)[number];
export type ReviewerType = (typeof REVIEWER_TYPES)[number];
export type ReviewerVerificationStatus =
	| "none"
	| "pending"
	| "verified"
	| "rejected";
export type ReviewerApplicationStatus =
	(typeof REVIEWER_APPLICATION_STATUSES)[number];

export const REVIEWER_FIELD_LIMITS = {
	headline: 90,
	bio: 280,
	expertise: 12,
	expertiseItem: 32,
	proofUrl: 240,
	applicationNote: 600,
	adminNote: 600,
};

const reviewerTypeLabels: Record<ReviewerType, string> = {
	career_coach: "Career coach",
	designer: "Designer",
	engineer: "Engineer",
	founder: "Founder",
	hiring_manager: "Hiring manager",
	other: "Reviewer",
	placed_professional: "Placed professional",
	product_manager: "Product manager",
	recruiter: "Recruiter",
	student: "Student reviewer",
};

export function isCommunityRole(value: unknown): value is CommunityRole {
	return COMMUNITY_ROLES.includes(value as CommunityRole);
}

export function isReviewerType(value: unknown): value is ReviewerType {
	return REVIEWER_TYPES.includes(value as ReviewerType);
}

export function isReviewerApplicationStatus(
	value: unknown,
): value is ReviewerApplicationStatus {
	return REVIEWER_APPLICATION_STATUSES.includes(
		value as ReviewerApplicationStatus,
	);
}

export function limitReviewerText(value: string, limit: number) {
	return value.trim().slice(0, limit);
}

export function parseReviewerExpertise(value: string | string[] | null | undefined) {
	const rawItems = Array.isArray(value) ? value : (value ?? "").split(/[,\n]/);
	const seen = new Set<string>();

	return rawItems
		.map((item) => item.trim())
		.filter(
			(item) =>
				item.length >= 2 &&
				item.length <= REVIEWER_FIELD_LIMITS.expertiseItem,
		)
		.filter((item) => {
			const key = item.toLowerCase();
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		})
		.slice(0, REVIEWER_FIELD_LIMITS.expertise);
}

export function getReviewerTypeLabel(type: ReviewerType | null | undefined) {
	return reviewerTypeLabels[type && isReviewerType(type) ? type : "other"];
}

export function canShowReviewerProfile(
	role: CommunityRole | null | undefined,
	type?: ReviewerType | null,
) {
	return (
		(role === "reviewer" || role === "both") &&
		Boolean(type && isReviewerType(type))
	);
}

export function isTrustedReviewer(
	status: ReviewerVerificationStatus | null | undefined,
) {
	return status === "verified";
}

export function getReviewerDisplayLabel(profile: {
	reviewer_type?: ReviewerType | null;
	reviewer_verification_status?: ReviewerVerificationStatus | null;
}) {
	if (isTrustedReviewer(profile.reviewer_verification_status)) {
		return "Trusted reviewer";
	}

	return getReviewerTypeLabel(profile.reviewer_type);
}

export function getProfileRoleLabel(profile: {
	college?: string | null;
	community_role?: CommunityRole | null;
	current_position?: string | null;
	reviewer_type?: ReviewerType | null;
	target_role?: string | null;
}) {
	const currentPosition = profile.current_position?.trim().replace(/\s+/g, " ");
	if (currentPosition) return currentPosition;

	if (profile.community_role === "reviewer") {
		return "Reviewer";
	}

	if (profile.community_role === "both") {
		return "Reviewer + candidate";
	}

	const role = `${profile.current_position ?? profile.target_role ?? ""} ${
		profile.college ?? ""
	}`.toLowerCase();

	if (role.includes("student") || role.includes("college") || role.includes("iit")) {
		return "Student";
	}

	if (role.includes("switch")) {
		return "Career switcher";
	}

	if (role.includes("intern")) {
		return "Intern";
	}

	return "Job seeker";
}

export function normalizeProofUrl(value: string) {
	return limitReviewerText(value, REVIEWER_FIELD_LIMITS.proofUrl);
}

export function getProofUrlIssue(value: string) {
	const proofUrl = normalizeProofUrl(value);

	if (!proofUrl) return "Add a public proof link before applying.";

	try {
		const url = new URL(proofUrl);
		if (url.protocol !== "https:" && url.protocol !== "http:") {
			return "Use a public http or https proof link.";
		}
	} catch {
		return "Enter a valid public proof link.";
	}

	return "";
}

export function getReviewerApplicationIssue(input: {
	communityRole: CommunityRole;
	note: string;
	proofUrl: string;
	reviewerType: ReviewerType | null;
}) {
	if (input.communityRole === "candidate") {
		return "Choose Review resumes or Both before applying.";
	}

	if (!input.reviewerType) {
		return "Choose the reviewer role you want verified.";
	}

	const proofIssue = getProofUrlIssue(input.proofUrl);
	if (proofIssue) return proofIssue;

	if (input.note.trim().length > REVIEWER_FIELD_LIMITS.applicationNote) {
		return `Keep the application note under ${REVIEWER_FIELD_LIMITS.applicationNote} characters.`;
	}

	return "";
}
