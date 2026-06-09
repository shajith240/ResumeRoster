import type {
	UserFeedbackCategory,
	UserFeedbackPriority,
	UserFeedbackStatus,
} from "@/lib/supabase/types";

export const USER_FEEDBACK_TITLE_MAX_LENGTH = 120;
export const USER_FEEDBACK_BODY_MAX_LENGTH = 2000;
export const USER_FEEDBACK_ADMIN_NOTE_MAX_LENGTH = 1000;
export const USER_FEEDBACK_ADMIN_REPLY_MAX_LENGTH = 800;

export const USER_FEEDBACK_CATEGORIES = [
	"bug",
	"ui_ux",
	"performance",
	"feature_request",
	"account",
	"content_safety",
	"other",
] as const satisfies UserFeedbackCategory[];

export const USER_FEEDBACK_PRIORITIES = [
	"urgent",
	"high",
	"normal",
	"low",
] as const satisfies UserFeedbackPriority[];

export const USER_FEEDBACK_STATUSES = [
	"new",
	"reviewing",
	"needs_user_reply",
	"planned",
	"resolved",
	"closed",
] as const satisfies UserFeedbackStatus[];

export const USER_FEEDBACK_CATEGORY_LABELS: Record<
	UserFeedbackCategory,
	string
> = {
	account: "Account",
	bug: "Bug",
	content_safety: "Safety",
	feature_request: "Feature",
	other: "Other",
	performance: "Performance",
	ui_ux: "UI / UX",
};

export const USER_FEEDBACK_STATUS_LABELS: Record<UserFeedbackStatus, string> = {
	closed: "Closed",
	needs_user_reply: "Needs user reply",
	new: "New",
	planned: "Planned",
	resolved: "Resolved",
	reviewing: "Reviewing",
};

export const USER_FEEDBACK_PRIORITY_LABELS: Record<
	UserFeedbackPriority,
	string
> = {
	high: "High",
	low: "Low",
	normal: "Normal",
	urgent: "Urgent",
};

export type UserFeedbackInput = {
	body: string;
	category: UserFeedbackCategory;
	metadata: Record<string, string>;
	sourcePath: string;
	title: string;
	viewport: string;
};

export type UserFeedbackValidationResult =
	| {
			ok: true;
			value: UserFeedbackInput;
	  }
	| {
			message: string;
			ok: false;
	  };

export type AdminFeedbackAction =
	| "close_feedback_ticket"
	| "mark_feedback_needs_user_reply"
	| "mark_feedback_planned"
	| "mark_feedback_resolved"
	| "mark_feedback_reviewing"
	| "reopen_feedback_ticket"
	| "reply_feedback_ticket"
	| "update_feedback_priority";

const ADMIN_FEEDBACK_ACTIONS = new Set<AdminFeedbackAction>([
	"close_feedback_ticket",
	"mark_feedback_needs_user_reply",
	"mark_feedback_planned",
	"mark_feedback_resolved",
	"mark_feedback_reviewing",
	"reopen_feedback_ticket",
	"reply_feedback_ticket",
	"update_feedback_priority",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getTrimmedString(value: unknown) {
	return typeof value === "string" ? value.trim() : "";
}

function limitString(value: unknown, limit: number) {
	return getTrimmedString(value).slice(0, limit);
}

export function isUserFeedbackCategory(
	value: unknown,
): value is UserFeedbackCategory {
	return (
		typeof value === "string" &&
		(USER_FEEDBACK_CATEGORIES as readonly string[]).includes(value)
	);
}

export function isUserFeedbackPriority(
	value: unknown,
): value is UserFeedbackPriority {
	return (
		typeof value === "string" &&
		(USER_FEEDBACK_PRIORITIES as readonly string[]).includes(value)
	);
}

export function isUserFeedbackStatus(
	value: unknown,
): value is UserFeedbackStatus {
	return (
		typeof value === "string" &&
		(USER_FEEDBACK_STATUSES as readonly string[]).includes(value)
	);
}

export function isAdminFeedbackAction(
	value: unknown,
): value is AdminFeedbackAction {
	return typeof value === "string" && ADMIN_FEEDBACK_ACTIONS.has(value as never);
}

export function getFeedbackStatusForAction(
	action: AdminFeedbackAction,
): UserFeedbackStatus | null {
	if (action === "mark_feedback_reviewing") return "reviewing";
	if (action === "mark_feedback_needs_user_reply") return "needs_user_reply";
	if (action === "mark_feedback_planned") return "planned";
	if (action === "mark_feedback_resolved") return "resolved";
	if (action === "close_feedback_ticket") return "closed";
	if (action === "reopen_feedback_ticket") return "reviewing";
	return null;
}

export function validateUserFeedbackPayload(
	payload: unknown,
): UserFeedbackValidationResult {
	if (!isRecord(payload)) {
		return { message: "Feedback details are required.", ok: false };
	}

	const title = limitString(payload.title, USER_FEEDBACK_TITLE_MAX_LENGTH);
	if (title.length < 3) {
		return { message: "Add a short feedback title.", ok: false };
	}

	const body = limitString(payload.body, USER_FEEDBACK_BODY_MAX_LENGTH);
	if (body.length < 10) {
		return {
			message: "Tell us a little more so the issue can be understood.",
			ok: false,
		};
	}

	const category = isUserFeedbackCategory(payload.category)
		? payload.category
		: "other";
	const sourcePath = normalizeFeedbackPath(payload.sourcePath);
	const viewport = limitString(payload.viewport, 80);
	const metadata = normalizeFeedbackMetadata(payload.metadata);

	return {
		ok: true,
		value: {
			body,
			category,
			metadata,
			sourcePath,
			title,
			viewport,
		},
	};
}

export function normalizeFeedbackPath(value: unknown) {
	const path = limitString(value, 500);
	if (!path || !path.startsWith("/") || path.startsWith("//")) return "/";
	if (path.includes("\\") || /\s/.test(path)) return "/";
	return path;
}

export function normalizeFeedbackMetadata(value: unknown) {
	if (!isRecord(value)) return {};

	const metadata: Record<string, string> = {};
	for (const [key, rawValue] of Object.entries(value).slice(0, 8)) {
		const safeKey = key.trim().slice(0, 40);
		const safeValue = limitString(rawValue, 180);
		if (!safeKey || !safeValue) continue;
		metadata[safeKey] = safeValue;
	}

	return metadata;
}
