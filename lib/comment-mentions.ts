export type MentionSuggestion = {
	avatarUrl?: string | null;
	displayName: string;
	handle: string;
	id: string;
	subtitle?: string | null;
};

export type MentionableProfile = {
	avatar_url?: string | null;
	full_name?: string | null;
	id: string;
	username?: string | null;
};

const MENTION_HANDLE_LIMIT = 32;
export const MENTION_TEXT_PATTERN = /@([A-Za-z0-9_.-]{1,32})/g;

export function normalizeMentionHandle(value?: string | null) {
	return (value ?? "")
		.trim()
		.replace(/^@+/, "")
		.replace(/\s+/g, "")
		.replace(/[^A-Za-z0-9_.-]/g, "")
		.slice(0, MENTION_HANDLE_LIMIT);
}

export function getMentionHandleKey(value?: string | null) {
	return normalizeMentionHandle(value).toLowerCase();
}

function getFallbackMentionHandle(userId: string) {
	const compactId = userId.replace(/-/g, "");
	return `member-${compactId.slice(0, 6) || "user"}`;
}

export function getMentionAvatarUrl(userId: string, profile?: MentionableProfile | null) {
	const seed = profile?.full_name?.trim() || profile?.username?.trim() || userId;
	return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed)}`;
}

export function buildMentionSuggestion(
	userId: string,
	profile?: MentionableProfile | null,
	subtitle?: string | null,
): MentionSuggestion {
	const displayName =
		profile?.full_name?.trim() || profile?.username?.trim() || "Community member";
	const handle =
		normalizeMentionHandle(profile?.username) ||
		normalizeMentionHandle(profile?.full_name) ||
		getFallbackMentionHandle(userId);

	return {
		avatarUrl: profile?.avatar_url ?? getMentionAvatarUrl(userId, profile),
		displayName,
		handle,
		id: userId,
		subtitle: subtitle ?? null,
	};
}

export function buildMentionSuggestions(
	userIds: Array<string | null | undefined>,
	profiles: Record<string, MentionableProfile | undefined>,
	options: {
		excludeUserId?: string | null;
		subtitleById?: Record<string, string>;
	} = {},
) {
	const seen = new Set<string>();

	return userIds.reduce<MentionSuggestion[]>((suggestions, userId) => {
		if (!userId || userId === options.excludeUserId || seen.has(userId)) {
			return suggestions;
		}

		seen.add(userId);
		suggestions.push(
			buildMentionSuggestion(userId, profiles[userId], options.subtitleById?.[userId]),
		);
		return suggestions;
	}, []);
}

export function buildMentionTargetMap(suggestions: MentionSuggestion[]) {
	return suggestions.reduce<Record<string, MentionSuggestion>>(
		(targets, suggestion) => {
			const key = getMentionHandleKey(suggestion.handle);
			if (key) targets[key] = suggestion;
			return targets;
		},
		{},
	);
}
