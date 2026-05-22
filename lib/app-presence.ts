import type { AppStatus } from "@/lib/supabase/types";

export const PROFILE_CHANGE_EVENT = "resumeroster-profile-change";
export const APP_PRESENCE_CHANGE_EVENT = "resumeroster-presence-change";
export const APP_PRESENCE_ACTIVE_WINDOW_SECONDS = 120;

export function normalizeAppStatus(value: string | null | undefined): AppStatus {
	return value === "focus" || value === "offline" ? value : "online";
}
