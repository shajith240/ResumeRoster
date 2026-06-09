export type RecentPostKind = "community" | "resume";

export type RecentPostItem = {
	author?: string | null;
	comments?: number | null;
	createdAt: string;
	href: string;
	id: string;
	imageUrl?: string | null;
	kind: RecentPostKind;
	meta?: string | null;
	title: string;
	visitedAt: string;
	votes?: number | null;
};

const RECENT_POSTS_LIMIT = 6;
const RECENT_POSTS_STORAGE_PREFIX = "linted.recent-posts";

export const RECENT_POSTS_EVENT = "linted:recent-posts-change";

function getStorageKey(kind: RecentPostKind) {
	return `${RECENT_POSTS_STORAGE_PREFIX}.${kind}.v1`;
}

function isRecentPostItem(value: unknown, kind: RecentPostKind): value is RecentPostItem {
	if (!value || typeof value !== "object") return false;

	const item = value as Partial<RecentPostItem>;

	return (
		item.kind === kind &&
		typeof item.id === "string" &&
		typeof item.href === "string" &&
		typeof item.title === "string" &&
		typeof item.createdAt === "string" &&
		typeof item.visitedAt === "string"
	);
}

function dispatchRecentPostsChange(kind: RecentPostKind) {
	window.dispatchEvent(
		new CustomEvent(RECENT_POSTS_EVENT, {
			detail: { kind },
		}),
	);
}

export function readRecentPosts(kind: RecentPostKind): RecentPostItem[] {
	if (typeof window === "undefined") return [];

	try {
		const raw = window.localStorage.getItem(getStorageKey(kind));
		if (!raw) return [];

		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];

		return parsed
			.filter((item): item is RecentPostItem => isRecentPostItem(item, kind))
			.slice(0, RECENT_POSTS_LIMIT);
	} catch {
		return [];
	}
}

export function writeRecentPost(item: RecentPostItem) {
	if (typeof window === "undefined") return;

	const nextItem: RecentPostItem = {
		...item,
		title: item.title.trim(),
		visitedAt: new Date().toISOString(),
	};

	if (!nextItem.title) return;

	const existing = readRecentPosts(item.kind);
	const nextItems = [
		nextItem,
		...existing.filter((recentItem) => recentItem.id !== item.id),
	].slice(0, RECENT_POSTS_LIMIT);

	try {
		window.localStorage.setItem(getStorageKey(item.kind), JSON.stringify(nextItems));
		dispatchRecentPostsChange(item.kind);
	} catch {
		// Recent history is optional UI state; storage failures should not block navigation.
	}
}

export function clearRecentPosts(kind: RecentPostKind) {
	if (typeof window === "undefined") return;

	try {
		window.localStorage.removeItem(getStorageKey(kind));
		dispatchRecentPostsChange(kind);
	} catch {
		// Recent history is optional UI state; storage failures should not block navigation.
	}
}
