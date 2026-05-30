import webPush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NOTIFICATION_SELECT, getNotificationHref } from "@/lib/notifications";
import type { LintedNotification } from "@/lib/supabase/types";

type PushSubscriptionRow = {
	id: string;
	user_id: string;
	endpoint: string;
	p256dh: string;
	auth: string;
};

type PushPreferenceRow = {
	push_enabled: boolean;
};

export type PushDispatchResult = {
	configured: boolean;
	sent: number;
	failed: number;
	removed: number;
	skipped?: string;
};

type WebPushConfig = {
	publicKey: string;
	privateKey: string;
	subject: string;
};

function getWebPushConfig(): WebPushConfig | null {
	const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY;
	const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
	const subject = process.env.WEB_PUSH_SUBJECT;

	if (!publicKey || !privateKey || !subject) return null;

	return { publicKey, privateKey, subject };
}

function truncatePushText(value: string | null | undefined, maxLength: number) {
	const normalized = (value ?? "").replace(/\s+/g, " ").trim();
	if (normalized.length <= maxLength) return normalized;
	return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function getPushPayload(notification: LintedNotification) {
	return JSON.stringify({
		body:
			truncatePushText(notification.body, 140) ||
			"Open Linted to see the update.",
		notificationId: notification.id,
		tag: `linted:${notification.id}`,
		title: truncatePushText(notification.title, 80) || "Linted",
		type: notification.type,
		url: getNotificationHref(notification),
	});
}

function getPushStatusCode(error: unknown) {
	if (!error || typeof error !== "object") return 0;
	const statusCode = "statusCode" in error ? error.statusCode : undefined;
	return typeof statusCode === "number" ? statusCode : 0;
}

async function revokeDeadSubscription(
	admin: SupabaseClient,
	subscriptionId: string,
) {
	const now = new Date().toISOString();
	await admin
		.from("push_subscriptions")
		.update({ revoked_at: now, updated_at: now })
		.eq("id", subscriptionId);
}

export async function sendPushForNotification(
	admin: SupabaseClient,
	notification: LintedNotification,
): Promise<PushDispatchResult> {
	const config = getWebPushConfig();
	if (!config) {
		return {
			configured: false,
			failed: 0,
			removed: 0,
			sent: 0,
			skipped: "Web Push is not configured.",
		};
	}

	const { data: preferences, error: preferencesError } = await admin
		.from("notification_preferences")
		.select("push_enabled")
		.eq("user_id", notification.recipient_id)
		.maybeSingle<PushPreferenceRow>();

	if (preferencesError) {
		return {
			configured: true,
			failed: 0,
			removed: 0,
			sent: 0,
			skipped: "Notification preferences are unavailable.",
		};
	}

	if (!preferences?.push_enabled) {
		return {
			configured: true,
			failed: 0,
			removed: 0,
			sent: 0,
			skipped: "Push is disabled for this user.",
		};
	}

	const { data: subscriptions, error: subscriptionsError } = await admin
		.from("push_subscriptions")
		.select("id,user_id,endpoint,p256dh,auth")
		.eq("user_id", notification.recipient_id)
		.is("revoked_at", null)
		.returns<PushSubscriptionRow[]>();

	if (subscriptionsError) {
		return {
			configured: true,
			failed: 0,
			removed: 0,
			sent: 0,
			skipped: "Push subscriptions are unavailable.",
		};
	}

	if (!subscriptions?.length) {
		return {
			configured: true,
			failed: 0,
			removed: 0,
			sent: 0,
			skipped: "No active push subscriptions.",
		};
	}

	webPush.setVapidDetails(
		config.subject,
		config.publicKey,
		config.privateKey,
	);

	const payload = getPushPayload(notification);
	let sent = 0;
	let failed = 0;
	let removed = 0;

	await Promise.all(
		subscriptions.map(async (subscription) => {
			try {
				await webPush.sendNotification(
					{
						endpoint: subscription.endpoint,
						keys: {
							auth: subscription.auth,
							p256dh: subscription.p256dh,
						},
					},
					payload,
					{
						TTL: 60 * 60 * 24,
						urgency: "normal",
					},
				);
				sent += 1;
			} catch (error) {
				failed += 1;
				const statusCode = getPushStatusCode(error);
				if (statusCode === 404 || statusCode === 410) {
					removed += 1;
					await revokeDeadSubscription(admin, subscription.id);
				}
			}
		}),
	);

	return {
		configured: true,
		failed,
		removed,
		sent,
	};
}

export async function sendPushForNotificationId(
	admin: SupabaseClient,
	notificationId: string,
) {
	const { data: notification, error } = await admin
		.from("notifications")
		.select(NOTIFICATION_SELECT)
		.eq("id", notificationId)
		.maybeSingle<LintedNotification>();

	if (error || !notification) {
		return {
			configured: Boolean(getWebPushConfig()),
			failed: 0,
			removed: 0,
			sent: 0,
			skipped: "Notification not found.",
		};
	}

	return sendPushForNotification(admin, notification);
}
