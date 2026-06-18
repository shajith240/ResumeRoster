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

type MentionSearchResponse = {
	suggestions?: MentionSuggestion[];
};

type MentionSearchOptions = {
	accessToken?: string | null;
	limit?: number;
	signal?: AbortSignal;
};

type MentionSearchCacheResult = {
	exact: boolean;
	suggestions: MentionSuggestion[];
};

const MENTION_HANDLE_LIMIT = 32;
const DEFAULT_MENTION_SEARCH_LIMIT = 8;
const DEFAULT_MENTION_LOOKUP_LIMIT = 60;
const MENTION_SEARCH_CACHE_LIMIT = 50;
const mentionSearchCache = new Map<string, MentionSuggestion[]>();
export const MENTION_TEXT_PATTERN = /@([A-Za-z0-9_.-]{1,32})/g;

export function normalizeMentionHandle(value?: string | null) {
	return (value ?? "")
		.trim()
		.replace(/^@+/, "")
		.replace(/\s+/g, "")
		.replace(/[^A-Za-z0-9_.-]/g, "")
		.replace(/^[._-]+|[._-]+$/g, "")
		.slice(0, MENTION_HANDLE_LIMIT);
}

export function getMentionHandleKey(value?: string | null) {
	return normalizeMentionHandle(value).toLowerCase();
}

function getMentionSearchQueryKey(value?: string | null) {
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

export function getMentionSuggestionMatches(
	suggestions: MentionSuggestion[],
	query: string,
	limit = DEFAULT_MENTION_SEARCH_LIMIT,
) {
	const normalizedQuery = query.trim().toLowerCase();
	const matches = normalizedQuery
		? suggestions.filter((suggestion) => {
				const handle = suggestion.handle.toLowerCase();
				const displayName = suggestion.displayName.toLowerCase();
				const subtitle = suggestion.subtitle?.toLowerCase() ?? "";

				return (
					handle.includes(normalizedQuery) ||
					displayName.includes(normalizedQuery) ||
					subtitle.includes(normalizedQuery)
				);
			})
		: suggestions;

	return matches.slice(0, limit);
}

function trimMentionSearchCache() {
	while (mentionSearchCache.size > MENTION_SEARCH_CACHE_LIMIT) {
		const oldestKey = mentionSearchCache.keys().next().value as string | undefined;
		if (!oldestKey) return;
		mentionSearchCache.delete(oldestKey);
	}
}

export function cacheMentionSearchSuggestions(
	query: string,
	suggestions: MentionSuggestion[],
) {
	const key = getMentionSearchQueryKey(query);
	if (!key) return;

	mentionSearchCache.delete(key);
	mentionSearchCache.set(key, suggestions);
	trimMentionSearchCache();
}

export function getCachedMentionSearchSuggestions(
	query: string,
	limit = DEFAULT_MENTION_SEARCH_LIMIT,
): MentionSearchCacheResult {
	const key = getMentionSearchQueryKey(query);
	if (!key) return { exact: false, suggestions: [] };

	const exactSuggestions = mentionSearchCache.get(key);
	if (exactSuggestions) {
		return {
			exact: true,
			suggestions: exactSuggestions.slice(0, limit),
		};
	}

	const prefixKey = Array.from(mentionSearchCache.keys())
		.filter((cachedKey) => key.startsWith(cachedKey))
		.sort((firstKey, secondKey) => secondKey.length - firstKey.length)[0];

	if (!prefixKey) return { exact: false, suggestions: [] };

	return {
		exact: false,
		suggestions: getMentionSuggestionMatches(
			mentionSearchCache.get(prefixKey) ?? [],
			key,
			limit,
		),
	};
}

export function mergeMentionSuggestions(
	primary: MentionSuggestion[],
	secondary: MentionSuggestion[],
	limit = DEFAULT_MENTION_SEARCH_LIMIT,
) {
	const seen = new Set<string>();
	const merged: MentionSuggestion[] = [];

	for (const suggestion of [...primary, ...secondary]) {
		const handle = normalizeMentionHandle(suggestion.handle);
		if (!handle) continue;

		const key = getMentionHandleKey(handle);
		if (!key || seen.has(key)) continue;

		seen.add(key);
		merged.push({
			...suggestion,
			handle,
		});

		if (merged.length >= limit) break;
	}

	return merged;
}

function extractMentionHandlesFromText(text: string) {
	const handles: string[] = [];
	const seen = new Set<string>();
	let match: RegExpExecArray | null;

	MENTION_TEXT_PATTERN.lastIndex = 0;
	while ((match = MENTION_TEXT_PATTERN.exec(text))) {
		const handle = normalizeMentionHandle(match[1]);
		const key = getMentionHandleKey(handle);
		if (!key || seen.has(key)) continue;

		seen.add(key);
		handles.push(handle);
	}

	return handles;
}

export function extractMentionHandlesFromTexts(texts: string[]) {
	const seen = new Set<string>();
	const handles: string[] = [];

	for (const text of texts) {
		for (const handle of extractMentionHandlesFromText(text)) {
			const key = getMentionHandleKey(handle);
			if (!key || seen.has(key)) continue;

			seen.add(key);
			handles.push(handle);
		}
	}

	return handles;
}

export function normalizeMentionHandleList(values: string[], limit = 120) {
	const seen = new Set<string>();
	const handles: string[] = [];

	for (const value of values) {
		const handle = normalizeMentionHandle(value);
		const key = getMentionHandleKey(handle);
		if (!key || seen.has(key)) continue;

		seen.add(key);
		handles.push(handle);
		if (handles.length >= limit) break;
	}

	return handles;
}

function mentionAuthHeaders(accessToken?: string | null) {
	if (!accessToken) return null;
	return {
		Authorization: `Bearer ${accessToken}`,
	};
}

async function readMentionResponse(response: Response) {
	if (!response.ok) {
		throw new Error("Mention request failed.");
	}

	const payload = (await response.json().catch(() => null)) as
		| MentionSearchResponse
		| null;
	return Array.isArray(payload?.suggestions) ? payload.suggestions : [];
}

export async function searchMentionSuggestions(
	query: string,
	options: MentionSearchOptions = {},
) {
	const headers = mentionAuthHeaders(options.accessToken);
	const trimmedQuery = query.trim();
	if (!headers || !trimmedQuery) return [];

	const params = new URLSearchParams({
		limit: String(options.limit ?? DEFAULT_MENTION_SEARCH_LIMIT),
		query: trimmedQuery,
	});
	const response = await fetch(`/api/mentions/users?${params.toString()}`, {
		headers,
		signal: options.signal,
	});

	const suggestions = await readMentionResponse(response);
	cacheMentionSearchSuggestions(trimmedQuery, suggestions);
	return suggestions;
}

export async function lookupMentionSuggestionsByHandles(
	handles: string[],
	options: MentionSearchOptions = {},
) {
	const headers = mentionAuthHeaders(options.accessToken);
	const normalizedHandles = normalizeMentionHandleList(handles);
	if (!headers || !normalizedHandles.length) return [];

	const response = await fetch("/api/mentions/users", {
		body: JSON.stringify({
			handles: normalizedHandles,
			limit: options.limit ?? DEFAULT_MENTION_LOOKUP_LIMIT,
		}),
		headers: {
			...headers,
			"Content-Type": "application/json",
		},
		method: "POST",
		signal: options.signal,
	});

	return readMentionResponse(response);
}
