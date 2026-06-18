import {
	COMMUNITY_POST_TYPES,
	isCommunityPostType,
	type CommunityPostType,
} from "@/lib/community";

export const COMMUNITY_POST_TITLE_MIN_LENGTH = 8;
export const COMMUNITY_POST_TITLE_MAX_LENGTH = 300;
export const COMMUNITY_POST_BODY_MAX_LENGTH = 12000;
export const COMMUNITY_POST_TAG_MAX_COUNT = 5;
const COMMUNITY_POST_TAG_MAX_LENGTH = 40;
const COMMUNITY_POLL_OPTION_MIN_COUNT = 2;
export const COMMUNITY_POLL_OPTION_MAX_COUNT = 6;
const COMMUNITY_POLL_OPTION_MAX_LENGTH = 120;
export const COMMUNITY_POLL_DURATION_DAYS = [1, 3, 7, 14, 30] as const;

export type CommunityPostInput = {
	body: string;
	postType: string;
	tags: string[];
	title: string;
	topicId: string;
};

export function cleanCommunityText(value: unknown) {
	return typeof value === "string" ? value.trim() : "";
}

function normalizeCommunityTag(value: string) {
	return value.replace(/\s+/g, " ").trim();
}

export function parseCommunityTags(value: string) {
	const seen = new Set<string>();
	const tags: string[] = [];

	for (const rawTag of value.split(",")) {
		const tag = normalizeCommunityTag(rawTag);
		const key = tag.toLowerCase();

		if (tag && !seen.has(key)) {
			seen.add(key);
			tags.push(tag);
		}
	}

	return tags;
}

function getCommunityTagIssue(tags: string[]) {
	if (tags.length > COMMUNITY_POST_TAG_MAX_COUNT) {
		return `Use at most ${COMMUNITY_POST_TAG_MAX_COUNT} tags.`;
	}

	const invalidTag = tags.find(
		(tag) => tag.length < 2 || tag.length > COMMUNITY_POST_TAG_MAX_LENGTH,
	);

	if (invalidTag) {
		return `Keep each tag between 2 and ${COMMUNITY_POST_TAG_MAX_LENGTH} characters.`;
	}

	return "";
}

export function getCommunityPostIssue(input: CommunityPostInput) {
	const title = cleanCommunityText(input.title);
	const body = cleanCommunityText(input.body);
	const topicId = cleanCommunityText(input.topicId);

	if (!title) return "Add a title.";

	if (title.length < COMMUNITY_POST_TITLE_MIN_LENGTH) {
		return `Add ${COMMUNITY_POST_TITLE_MIN_LENGTH - title.length} more characters to the title.`;
	}

	if (title.length > COMMUNITY_POST_TITLE_MAX_LENGTH) {
		return `Keep the title under ${COMMUNITY_POST_TITLE_MAX_LENGTH} characters.`;
	}

	if (!topicId) return "Choose a topic.";

	if (!isCommunityPostType(input.postType)) {
		return "Choose a valid post type.";
	}

	if (body.length > COMMUNITY_POST_BODY_MAX_LENGTH) {
		return `Keep the body under ${COMMUNITY_POST_BODY_MAX_LENGTH} characters.`;
	}

	return getCommunityTagIssue(input.tags);
}

export function normalizeCommunityPollOptions(options: string[]) {
	return options.map(cleanCommunityText);
}

export function getCommunityPollIssue(options: string[]) {
	const normalizedOptions = normalizeCommunityPollOptions(options);
	const filledOptions = normalizedOptions.filter(Boolean);

	if (filledOptions.length < COMMUNITY_POLL_OPTION_MIN_COUNT) {
		return `Add at least ${COMMUNITY_POLL_OPTION_MIN_COUNT} poll options.`;
	}

	if (filledOptions.length > COMMUNITY_POLL_OPTION_MAX_COUNT) {
		return `Use at most ${COMMUNITY_POLL_OPTION_MAX_COUNT} poll options.`;
	}

	const duplicateOptions = new Set<string>();
	for (const option of filledOptions) {
		const key = option.toLowerCase();
		if (duplicateOptions.has(key)) return "Poll options must be unique.";
		duplicateOptions.add(key);
	}

	if (filledOptions.some((option) => option.length > COMMUNITY_POLL_OPTION_MAX_LENGTH)) {
		return `Keep poll options under ${COMMUNITY_POLL_OPTION_MAX_LENGTH} characters.`;
	}

	return "";
}

export function isCommunityPollDurationDays(value: unknown) {
	const numberValue =
		typeof value === "number"
			? value
			: typeof value === "string"
				? Number(value)
				: NaN;

	return COMMUNITY_POLL_DURATION_DAYS.includes(
		numberValue as (typeof COMMUNITY_POLL_DURATION_DAYS)[number],
	);
}

export function getDefaultCommunityPostType(): CommunityPostType {
	return COMMUNITY_POST_TYPES[0];
}
