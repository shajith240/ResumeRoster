import type { LintedNotification, NotificationType } from "@/lib/supabase/types";
import { getAppHomeRoute } from "@/lib/app-routes";

export const NOTIFICATIONS_OPEN_EVENT = "linted-notifications-open";

export const NOTIFICATION_SELECT =
	"id,recipient_id,actor_id,type,title,body,link_href,resume_id,roast_id,parent_roast_id,related_user_id,metadata,dedupe_key,read_at,seen_at,created_at,updated_at";

export function isNotificationsFeatureError(error: { message?: string } | null) {
	return /notifications|notification_preferences|insert_notification|schema cache|relation|column|does not exist/i.test(
		error?.message ?? "",
	);
}

export function getNotificationHref(
	notification: Pick<LintedNotification, "link_href">,
) {
	const href = notification.link_href?.trim();

	if (!href || !href.startsWith("/") || href.startsWith("//")) {
		return getAppHomeRoute();
	}

	return href;
}

export function getNotificationTone(type: NotificationType) {
	if (type === "helpful_vote") return "helpful";
	if (type === "moderation") return "moderation";
	if (type === "reviewer_status") return "trust";
	if (type === "system") return "system";
	return "feedback";
}

export function unreadNotificationCount(
	notifications: Array<Pick<LintedNotification, "read_at">>,
) {
	return notifications.filter((notification) => !notification.read_at).length;
}
