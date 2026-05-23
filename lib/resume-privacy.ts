export const RESUME_PRIVACY_MODES = [
	"public",
	"contact_hidden",
	"anonymous",
] as const;

export type ResumePrivacyMode = (typeof RESUME_PRIVACY_MODES)[number];

export type ResumePrivacyModeCopy = {
	description: string;
	label: string;
};

export const RESUME_PRIVACY_MODE_COPY: Record<
	ResumePrivacyMode,
	ResumePrivacyModeCopy
> = {
	public: {
		label: "Public",
		description: "Show my profile and keep the resume closest to original.",
	},
	contact_hidden: {
		label: "Hide contacts",
		description:
			"Post anonymously, hide name/email/phone, but keep useful project links.",
	},
	anonymous: {
		label: "Anonymous",
		description:
			"Post anonymously and hide name, contact details, and profile links.",
	},
};

export function isResumePrivacyMode(value: unknown): value is ResumePrivacyMode {
	return (
		typeof value === "string" &&
		(RESUME_PRIVACY_MODES as readonly string[]).includes(value)
	);
}

export function isAnonymousResumeMode(mode: ResumePrivacyMode) {
	return mode !== "public";
}

export function getPrivacyModeHelpText(mode: ResumePrivacyMode) {
	if (mode === "public") {
		return "Best when you want roasters to judge your full profile and resume together.";
	}

	if (mode === "contact_hidden") {
		return "Good default: hides direct contact details while preserving links that help reviewers judge project credibility.";
	}

	return "Strongest privacy: use this when you do not want profile or portfolio links to identify you.";
}
