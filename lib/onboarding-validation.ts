import {
	type CommunityRole,
	type ReviewerType,
	parseReviewerExpertise,
} from "@/lib/reviewer-validation";

export const ONBOARDING_VERSION = 1;

export const ONBOARDING_GOALS = [
	{
		description:
			"Post a resume and learn which fixes matter before applying.",
		id: "get_feedback",
		label: "Get feedback",
		mappedCommunityRole: "candidate",
	},
	{
		description:
			"Help others catch weak bullets, unclear proof, and recruiter red flags.",
		id: "review_resumes",
		label: "Review resumes",
		mappedCommunityRole: "reviewer",
	},
	{
		description:
			"Get feedback on your own resume and review resumes from the community.",
		id: "both",
		label: "Do both",
		mappedCommunityRole: "both",
	},
] as const satisfies Array<{
	description: string;
	id: string;
	label: string;
	mappedCommunityRole: CommunityRole;
}>;

export const ONBOARDING_PERSONAS = [
	{
		description: "Preparing for internships, placements, or early-career roles.",
		id: "student",
		label: "Student",
		mappedReviewerType: "student",
	},
	{
		description: "Moving from college into a first full-time role.",
		id: "new_grad",
		label: "New grad",
		mappedReviewerType: null,
	},
	{
		description: "Actively applying and looking for a clearer resume.",
		id: "job_seeker",
		label: "Job seeker",
		mappedReviewerType: null,
	},
	{
		description: "Changing roles, domains, or industries.",
		id: "career_switcher",
		label: "Career switcher",
		mappedReviewerType: null,
	},
	{
		description: "Screens resumes or supports hiring pipelines.",
		id: "recruiter_hr",
		label: "Recruiter / HR",
		mappedReviewerType: "recruiter",
	},
	{
		description: "Evaluates candidates or makes hiring decisions.",
		id: "hiring_manager",
		label: "Hiring manager",
		mappedReviewerType: "hiring_manager",
	},
	{
		description: "Can review technical projects, proof, and role fit.",
		id: "engineer",
		label: "Engineer",
		mappedReviewerType: "engineer",
	},
	{
		description: "Can review design portfolios, UX proof, and presentation.",
		id: "designer",
		label: "Designer",
		mappedReviewerType: "designer",
	},
	{
		description: "Can review product, strategy, and impact signals.",
		id: "product_manager",
		label: "Product manager",
		mappedReviewerType: "product_manager",
	},
	{
		description: "Helps people position their career story.",
		id: "career_coach",
		label: "Career coach",
		mappedReviewerType: "career_coach",
	},
	{
		description: "Hires, mentors, or reviews from an operator lens.",
		id: "founder",
		label: "Founder",
		mappedReviewerType: "founder",
	},
	{
		description: "Does not fit one label yet.",
		id: "other",
		label: "Other",
		mappedReviewerType: null,
	},
] as const satisfies Array<{
	description: string;
	id: string;
	label: string;
	mappedReviewerType: ReviewerType | null;
}>;

export type OnboardingGoalId = (typeof ONBOARDING_GOALS)[number]["id"];
export type OnboardingPersonaId = (typeof ONBOARDING_PERSONAS)[number]["id"];
export type OnboardingStatus = "pending" | "completed" | "not_required";

const onboardingGoalIds = new Set<string>(
	ONBOARDING_GOALS.map((goal) => goal.id),
);
const onboardingPersonaIds = new Set<string>(
	ONBOARDING_PERSONAS.map((persona) => persona.id),
);

export function isOnboardingGoalId(value: unknown): value is OnboardingGoalId {
	return typeof value === "string" && onboardingGoalIds.has(value);
}

export function isOnboardingPersonaId(
	value: unknown,
): value is OnboardingPersonaId {
	return typeof value === "string" && onboardingPersonaIds.has(value);
}

export function getOnboardingGoal(value: OnboardingGoalId) {
	return ONBOARDING_GOALS.find((goal) => goal.id === value) ?? ONBOARDING_GOALS[0];
}

export function getOnboardingPersona(value: OnboardingPersonaId) {
	return (
		ONBOARDING_PERSONAS.find((persona) => persona.id === value) ??
		ONBOARDING_PERSONAS[ONBOARDING_PERSONAS.length - 1]
	);
}

export function getCommunityRoleForOnboardingGoal(
	goalId: OnboardingGoalId,
): CommunityRole {
	return getOnboardingGoal(goalId).mappedCommunityRole;
}

export function getReviewerTypeForOnboarding(
	goalId: OnboardingGoalId,
	personaId: OnboardingPersonaId,
): ReviewerType | null {
	const communityRole = getCommunityRoleForOnboardingGoal(goalId);
	if (communityRole === "candidate") return null;

	return getOnboardingPersona(personaId).mappedReviewerType ?? "other";
}

export function normalizeOnboardingTargetRole(value: string) {
	return value.trim().replace(/\s+/g, " ").slice(0, 64);
}

export function parseOnboardingExpertise(value: string | string[]) {
	return parseReviewerExpertise(value);
}

export function getOnboardingDestination(goalId: OnboardingGoalId) {
	if (goalId === "get_feedback") return "/feed?welcome=candidate";
	if (goalId === "review_resumes") return "/feed?sort=needs&welcome=reviewer";

	return "/feed?sort=needs&welcome=both";
}

export function getOnboardingIssue(input: {
	goalId: string;
	personaId: string;
}) {
	if (!isOnboardingGoalId(input.goalId)) {
		return "Choose what you want to do on Linted.";
	}

	if (!isOnboardingPersonaId(input.personaId)) {
		return "Choose the option that best describes you.";
	}

	return "";
}
