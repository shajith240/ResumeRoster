export const COMMUNITY_CODE_LANGUAGE_OPTIONS = [
	{ label: "Auto", value: "auto" },
	{ label: "JavaScript", value: "javascript" },
	{ label: "TypeScript", value: "typescript" },
	{ label: "Python", value: "python" },
	{ label: "C", value: "c" },
	{ label: "C++", value: "cpp" },
	{ label: "Java", value: "java" },
	{ label: "HTML", value: "html" },
	{ label: "CSS", value: "css" },
	{ label: "JSON", value: "json" },
	{ label: "SQL", value: "sql" },
	{ label: "Bash", value: "bash" },
	{ label: "Markdown", value: "markdown" },
	{ label: "YAML", value: "yaml" },
	{ label: "Plain text", value: "plaintext" },
] as const;

export type CommunityCodeLanguageValue =
	(typeof COMMUNITY_CODE_LANGUAGE_OPTIONS)[number]["value"];

export const COMMUNITY_CODE_HIGHLIGHT_LANGUAGES =
	COMMUNITY_CODE_LANGUAGE_OPTIONS
		.map((option) => option.value)
		.filter(
			(value): value is Exclude<CommunityCodeLanguageValue, "auto"> =>
				value !== "auto",
		);

const COMMUNITY_CODE_LANGUAGE_LABELS = new Map(
	COMMUNITY_CODE_LANGUAGE_OPTIONS.map((option) => [option.value, option.label]),
);

const COMMUNITY_CODE_LANGUAGE_ALIASES = new Map<string, CommunityCodeLanguageValue>(
	[
		["c++", "cpp"],
		["h", "c"],
		["hpp", "cpp"],
		["js", "javascript"],
		["jsx", "javascript"],
		["md", "markdown"],
		["py", "python"],
		["sh", "bash"],
		["shell", "bash"],
		["ts", "typescript"],
		["tsx", "typescript"],
		["yml", "yaml"],
	],
);

export function normalizeCommunityCodeLanguage(value: string) {
	const normalized = value.trim().toLowerCase();
	if (!normalized) return "auto";

	return (
		COMMUNITY_CODE_LANGUAGE_ALIASES.get(normalized) ??
		(COMMUNITY_CODE_LANGUAGE_LABELS.has(normalized as CommunityCodeLanguageValue)
			? (normalized as CommunityCodeLanguageValue)
			: "auto")
	);
}

export function getCommunityCodeLanguageLabel(value: string) {
	const normalized = normalizeCommunityCodeLanguage(value);
	return COMMUNITY_CODE_LANGUAGE_LABELS.get(normalized) ?? "Auto";
}
