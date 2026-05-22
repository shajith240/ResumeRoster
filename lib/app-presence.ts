import type { AppStatus } from "@/lib/supabase/types";

export const PROFILE_CHANGE_EVENT = "resumeroster-profile-change";
export const APP_PRESENCE_CHANGE_EVENT = "resumeroster-presence-change";
export const APP_PRESENCE_ACTIVE_WINDOW_SECONDS = 120;

export function normalizeAppStatus(value: string | null | undefined): AppStatus {
	return value === "focus" || value === "offline" ? value : "online";
}

export function isPresenceFeatureError(error: { message?: string } | null) {
	return /record_app_presence|clear_app_presence|get_active_roaster_count|app_presence_sessions|schema cache|function|relation/i.test(
		error?.message ?? "",
	);
}
