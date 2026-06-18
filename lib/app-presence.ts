import type { AppStatus } from "@/lib/supabase/types";

export const PROFILE_CHANGE_EVENT = "linted-profile-change";
export const APP_PRESENCE_CHANGE_EVENT = "linted-presence-change";
export const APP_PRESENCE_CHANNEL = "linted:app-presence";

export type AppPresencePayload = {
	user_id: string;
	session_id: string;
	status: AppStatus;
	online_at: string;
};

export function isPresenceFeatureError(error: { message?: string } | null) {
	return /record_app_presence|clear_app_presence|get_active_reviewer_count|get_active_roaster_count|app_presence_sessions|foreign key|schema cache|function|relation|violates/i.test(
		error?.message ?? "",
	);
}
