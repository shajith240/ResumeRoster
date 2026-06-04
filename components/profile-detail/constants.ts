import type { CommunityRole } from "@/lib/supabase/types";

export const fallbackAvatar = "/assets/logo.png";

export const VERIFIED_TICK_SRC = "/assets/verified_tick.png";

export const PROFILE_CHANGE_EVENT = "linted-profile-change";

export const SUPABASE_MIGRATION_MESSAGE =
	"Profile controls are temporarily unavailable. Please refresh and try again.";

export const NO_POSITION_VALUE = "__not_set__";

export const uuidPattern =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SHORT_COMMUNITY_ROLE_LABELS: Record<CommunityRole, string> = {
	both: "Both",
	candidate: "Get feedback",
	reviewer: "Review resumes",
};
