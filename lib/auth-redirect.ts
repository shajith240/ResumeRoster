import { getAppHomeRoute } from "@/lib/app-routes";

export const AUTH_NEXT_STORAGE_KEY = "linted.auth.next";

export function getSafeNextPath(value: string | null | undefined) {
	if (!value || !value.startsWith("/") || value.startsWith("//")) {
		return getAppHomeRoute();
	}

	return value;
}

export function getLoginPath(nextPath?: string | null) {
	const safeNextPath = getSafeNextPath(nextPath || getAppHomeRoute());
	return `/login?next=${encodeURIComponent(safeNextPath)}`;
}

export function getCurrentPathForLogin() {
	if (typeof window === "undefined") return getAppHomeRoute();
	return getSafeNextPath(
		`${window.location.pathname}${window.location.search}`,
	);
}
