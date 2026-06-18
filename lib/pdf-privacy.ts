export const MAX_PRIVACY_SCAN_PAGES = 8;

type PrivacyFindingType = "email" | "phone" | "link";

export type PrivacyFinding = {
	type: PrivacyFindingType;
	label: string;
	count: number;
};

export type PrivacyTextAssessment = {
	findings: PrivacyFinding[];
};

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_CANDIDATE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const CONTACT_LINK_PATTERN =
	/(?:https?:\/\/|www\.|mailto:|linkedin\.com|github\.com|gitlab\.com|behance\.net)/gi;

function countMatches(text: string, pattern: RegExp) {
	return Array.from(text.matchAll(pattern)).length;
}

function countPhoneMatches(text: string) {
	let count = 0;

	for (const match of text.matchAll(PHONE_CANDIDATE_PATTERN)) {
		const digits = match[0].replace(/\D/g, "");
		if (digits.length >= 10 && digits.length <= 15) {
			count += 1;
		}
	}

	return count;
}

export function assessResumePrivacyText(text: string): PrivacyTextAssessment {
	const normalizedText = text.replace(/\s+/g, " ");
	const findingCounts: Array<PrivacyFinding | null> = [
		{
			type: "email",
			label: "Email address",
			count: countMatches(normalizedText, EMAIL_PATTERN),
		},
		{
			type: "phone",
			label: "Phone number",
			count: countPhoneMatches(normalizedText),
		},
		{
			type: "link",
			label: "Profile or external link",
			count: countMatches(normalizedText, CONTACT_LINK_PATTERN),
		},
	];

	return {
		findings: findingCounts.filter(
			(finding): finding is PrivacyFinding => Boolean(finding?.count),
		),
	};
}

export function containsContactSignal(text: string) {
	return assessResumePrivacyText(text).findings.length > 0;
}

export function containsDirectContactSignal(text: string) {
	return assessResumePrivacyText(text).findings.some((finding) =>
		["email", "phone"].includes(finding.type),
	);
}

export function getPrivacyUploadIssue(status: string) {
	if (status === "checking") return "Wait for the PDF privacy check to finish.";
	if (status === "error") {
		return "Upload a standard, readable PDF so we can check it before posting.";
	}

	return "";
}
