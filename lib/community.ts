export const COMMUNITY_POSTS_FEATURE_FLAG =
	"NEXT_PUBLIC_COMMUNITY_POSTS_ENABLED";

const ENABLED_FEATURE_FLAG_VALUES = new Set(["1", "true", "yes", "on"]);
const DISABLED_FEATURE_FLAG_VALUES = new Set(["", "0", "false", "no", "off"]);

export type CommunityFeatureEnvironment = {
	[key: string]: string | undefined;
};

export function parseBooleanFeatureFlag(
	value: string | null | undefined,
	defaultValue = false,
) {
	const normalized = value?.trim().toLowerCase();

	if (normalized === undefined) {
		return defaultValue;
	}

	if (ENABLED_FEATURE_FLAG_VALUES.has(normalized)) {
		return true;
	}

	if (DISABLED_FEATURE_FLAG_VALUES.has(normalized)) {
		return false;
	}

	return defaultValue;
}

export function areCommunityPostsEnabled(
	env?: CommunityFeatureEnvironment,
) {
	const value = env
		? env[COMMUNITY_POSTS_FEATURE_FLAG]
		: process.env.NEXT_PUBLIC_COMMUNITY_POSTS_ENABLED;

	return parseBooleanFeatureFlag(value, true);
}

export const COMMUNITY_POST_TYPES = [
	"question",
	"discussion",
	"resource",
] as const;

export type CommunityPostType = (typeof COMMUNITY_POST_TYPES)[number];

export const RESERVED_COMMUNITY_POST_TYPES = ["announcement"] as const;

export type ReservedCommunityPostType =
	(typeof RESERVED_COMMUNITY_POST_TYPES)[number];

export const COMMUNITY_POST_TYPE_LABELS: Record<CommunityPostType, string> = {
	discussion: "Discussion",
	question: "Question",
	resource: "Resource",
};

export const RESERVED_COMMUNITY_POST_TYPE_LABELS: Record<
	ReservedCommunityPostType,
	string
> = {
	announcement: "Announcement",
};

export function isCommunityPostType(
	value: unknown,
): value is CommunityPostType {
	return (
		typeof value === "string" &&
		COMMUNITY_POST_TYPES.includes(value as CommunityPostType)
	);
}

export function isReservedCommunityPostType(
	value: unknown,
): value is ReservedCommunityPostType {
	return (
		typeof value === "string" &&
		RESERVED_COMMUNITY_POST_TYPES.includes(value as ReservedCommunityPostType)
	);
}
