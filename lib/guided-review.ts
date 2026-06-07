import { normalizeCommentContent } from "@/lib/comment-media-validation";

export const GUIDED_REVIEW_ISSUE_TYPES = [
	"clarity",
	"missing_impact",
	"weak_project",
	"too_generic",
	"ordering",
	"formatting",
	"role_fit",
] as const;

export type GuidedReviewIssueType = (typeof GUIDED_REVIEW_ISSUE_TYPES)[number];

export const GUIDED_REVIEW_ISSUE_LABELS: Record<GuidedReviewIssueType, string> = {
	clarity: "Clarity issue",
	formatting: "Formatting issue",
	missing_impact: "Missing impact",
	ordering: "Bad ordering",
	role_fit: "Role fit",
	too_generic: "Too generic",
	weak_project: "Weak project",
};

const GUIDED_REVIEW_LIMITS = {
	issue: 900,
	issueMinimum: 32,
	storage: 4000,
	suggestion: 1200,
	suggestionMinimum: 45,
	totalMinimum: 160,
};

const genericFeedbackPatterns = [
	/^good(?:\s+resume)?[.!]*$/i,
	/^great(?:\s+resume)?[.!]*$/i,
	/^looks?\s+good[.!]*$/i,
	/^nice(?:\s+resume)?[.!]*$/i,
	/^ok(?:ay)?[.!]*$/i,
	/^fine[.!]*$/i,
	/^no\s+(?:issue|issues|changes?)[.!]*$/i,
	/^nothing\s+to\s+change[.!]*$/i,
];

function visibleLength(value: string) {
	return normalizeCommentContent(value).replace(/\s+/g, " ").trim().length;
}

export function isGuidedReviewIssueType(
	value: unknown,
): value is GuidedReviewIssueType {
	return GUIDED_REVIEW_ISSUE_TYPES.includes(value as GuidedReviewIssueType);
}

function normalizeGuidedReviewText(value: string, limit: number) {
	return normalizeCommentContent(value).slice(0, limit);
}

function isGenericFeedback(value: string) {
	const normalized = normalizeCommentContent(value).replace(/\s+/g, " ").trim();
	return genericFeedbackPatterns.some((pattern) => pattern.test(normalized));
}

export function buildGuidedReviewContent({
	issue,
	issueType,
	suggestion,
}: {
	issue: string;
	issueType: GuidedReviewIssueType;
	suggestion: string;
}) {
	const normalizedIssue = normalizeGuidedReviewText(
		issue,
		GUIDED_REVIEW_LIMITS.issue,
	);
	const normalizedSuggestion = normalizeGuidedReviewText(
		suggestion,
		GUIDED_REVIEW_LIMITS.suggestion,
	);

	return normalizeCommentContent(
		[
			`**${GUIDED_REVIEW_ISSUE_LABELS[issueType]}**`,
			`**Issue:** ${normalizedIssue}`,
			`**Suggested change:** ${normalizedSuggestion}`,
		].join("\n\n"),
	);
}

export function getGuidedReviewIssue({
	issue,
	issueType,
	suggestion,
}: {
	issue: string;
	issueType: unknown;
	suggestion: string;
}) {
	if (!isGuidedReviewIssueType(issueType)) {
		return "Choose the resume issue you are reviewing.";
	}

	const normalizedIssue = normalizeGuidedReviewText(
		issue,
		GUIDED_REVIEW_LIMITS.issue,
	);
	const normalizedSuggestion = normalizeGuidedReviewText(
		suggestion,
		GUIDED_REVIEW_LIMITS.suggestion,
	);

	if (visibleLength(normalizedIssue) < GUIDED_REVIEW_LIMITS.issueMinimum) {
		return "Explain the issue with one specific resume detail.";
	}

	if (visibleLength(normalizedSuggestion) < GUIDED_REVIEW_LIMITS.suggestionMinimum) {
		return "Give one concrete rewrite, reorder, removal, or quantification step.";
	}

	if (isGenericFeedback(normalizedIssue) || isGenericFeedback(normalizedSuggestion)) {
		return "Make the feedback specific enough that the resume owner can act on it.";
	}

	const content = buildGuidedReviewContent({
		issue: normalizedIssue,
		issueType,
		suggestion: normalizedSuggestion,
	});

	if (content.length < GUIDED_REVIEW_LIMITS.totalMinimum) {
		return "Add a little more detail so this counts as useful feedback.";
	}

	if (content.length > GUIDED_REVIEW_LIMITS.storage) {
		return "Keep the guided review under 4000 characters.";
	}

	return "";
}
