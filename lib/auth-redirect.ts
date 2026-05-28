export const AUTH_NEXT_STORAGE_KEY = "linted.auth.next";

export function getSafeNextPath(value: string | null | undefined) {
	if (!value || !value.startsWith("/") || value.startsWith("//")) {
		return "/feed";
	}

	return value;
}

export function getLoginPath(nextPath?: string | null) {
	const safeNextPath = getSafeNextPath(nextPath || "/feed");
	return `/login?next=${encodeURIComponent(safeNextPath)}`;
}

export function getCurrentPathForLogin() {
	if (typeof window === "undefined") return "/feed";
	return getSafeNextPath(
		`${window.location.pathname}${window.location.search}`,
	);
}

