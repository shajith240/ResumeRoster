import type { AppStatus } from "@/lib/supabase/types";

export const APP_PRESENCE_CHANNEL = "resumeroster-active-roasters";
export const PROFILE_CHANGE_EVENT = "resumeroster-profile-change";

export type AppPresencePayload = {
	user_id: string;
	status: Exclude<AppStatus, "offline">;
	online_at: string;
};

export function normalizeAppStatus(value: string | null | undefined): AppStatus {
	return value === "focus" || value === "offline" ? value : "online";
}

