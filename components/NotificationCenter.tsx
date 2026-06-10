"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "@/components/ui/solar-icons";
import { toast } from "sonner";
import PushNotificationsControl from "@/components/PushNotificationsControl";
import { announceRouteTransition } from "@/components/RouteTransitionLoader";
import TeamNotifications, {
	type TeamNotification,
} from "@/components/TeamNotifications";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	NOTIFICATIONS_OPEN_EVENT,
	NOTIFICATION_SELECT,
	getNotificationHref,
	isNotificationsFeatureError,
	unreadNotificationCount,
} from "@/lib/notifications";
import { getAppHomeRoute } from "@/lib/app-routes";
import { supabase } from "@/lib/supabase/client";
import type { LintedNotification } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type NotificationCenterProps = {
	userId: string;
};

const NOTIFICATION_LIMIT = 30;

function normalizeNotification(row: LintedNotification): LintedNotification {
	return {
		...row,
		body: row.body ?? "",
		link_href: row.link_href || getAppHomeRoute(),
		metadata: row.metadata ?? {},
	};
}

function getMetadataString(
	metadata: Record<string, unknown>,
	keys: string[],
): string | undefined {
	for (const key of keys) {
		const value = metadata[key];
		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}
	}

	return undefined;
}

function toTeamNotification(notification: LintedNotification): TeamNotification {
	const metadata = notification.metadata ?? {};
	const actorName = getMetadataString(metadata, [
		"actor_name",
		"actor_full_name",
		"actor_username",
		"user_name",
		"username",
	]);
	const actorAvatar = getMetadataString(metadata, [
		"actor_avatar_url",
		"avatar_url",
		"user_avatar_url",
	]);

	return {
		id: notification.id,
		type: notification.type,
		title: notification.title,
		message: notification.body,
		read: Boolean(notification.read_at),
		timestamp: new Date(notification.created_at),
		link: getNotificationHref(notification),
		metadata,
		user: actorName
			? {
					id:
						notification.actor_id ??
						notification.related_user_id ??
						notification.id,
					name: actorName,
					avatar: actorAvatar,
				}
			: undefined,
	};
}

export default function NotificationCenter({ userId }: NotificationCenterProps) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [notifications, setNotifications] = useState<LintedNotification[]>([]);
	const [unreadCount, setUnreadCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [featureReady, setFeatureReady] = useState(true);

	const loadNotifications = useCallback(
		async (showLoading = false) => {
			if (showLoading) setLoading(true);

			const [notificationsResult, unreadResult] = await Promise.all([
				supabase
					.from("notifications")
					.select(NOTIFICATION_SELECT)
					.eq("recipient_id", userId)
					.order("created_at", { ascending: false })
					.limit(NOTIFICATION_LIMIT),
				supabase
					.from("notifications")
					.select("id", { count: "exact", head: true })
					.eq("recipient_id", userId)
					.is("read_at", null),
			]);

			if (notificationsResult.error) {
				if (isNotificationsFeatureError(notificationsResult.error)) {
					setFeatureReady(false);
					setLoading(false);
					return;
				}

				setLoading(false);
				toast.error("Could not load notifications.");
				return;
			}

			const rows = ((notificationsResult.data ?? []) as LintedNotification[]).map(
				normalizeNotification,
			);

			setFeatureReady(true);
			setNotifications(rows);
			setUnreadCount(
				unreadResult.error ? unreadNotificationCount(rows) : unreadResult.count ?? 0,
			);
			setLoading(false);
		},
		[userId],
	);

	const markNotificationRead = useCallback(
		async (notification: LintedNotification) => {
			if (notification.read_at) return;

			const readAt = new Date().toISOString();
			setNotifications((current) =>
				current.map((item) =>
					item.id === notification.id
						? { ...item, read_at: readAt, seen_at: item.seen_at ?? readAt }
						: item,
				),
			);
			setUnreadCount((current) => Math.max(0, current - 1));

			const { error } = await supabase
				.from("notifications")
				.update({ read_at: readAt, seen_at: readAt })
				.eq("id", notification.id)
				.eq("recipient_id", userId);

			if (error) {
				void loadNotifications();
			}
		},
		[loadNotifications, userId],
	);

	const openNotification = useCallback(
		async (notification: LintedNotification) => {
			await markNotificationRead(notification);
			const href = getNotificationHref(notification);
			setOpen(false);
			announceRouteTransition(href);
			router.push(href);
		},
		[markNotificationRead, router],
	);

	const markAllRead = useCallback(async () => {
		if (!unreadCount) return;

		const readAt = new Date().toISOString();
		setNotifications((current) =>
			current.map((notification) =>
				notification.read_at
					? notification
					: { ...notification, read_at: readAt, seen_at: notification.seen_at ?? readAt },
			),
		);
		setUnreadCount(0);

		const { error } = await supabase
			.from("notifications")
			.update({ read_at: readAt, seen_at: readAt })
			.eq("recipient_id", userId)
			.is("read_at", null);

		if (error) {
			toast.error("Could not mark notifications read.");
			void loadNotifications();
		}
	}, [loadNotifications, unreadCount, userId]);

	const deleteNotification = useCallback(
		async (notificationId: string) => {
			const notification = notifications.find((item) => item.id === notificationId);
			if (!notification) return;

			setNotifications((current) =>
				current.filter((item) => item.id !== notificationId),
			);
			if (!notification.read_at) {
				setUnreadCount((current) => Math.max(0, current - 1));
			}

			const { error } = await supabase
				.from("notifications")
				.delete()
				.eq("id", notificationId)
				.eq("recipient_id", userId);

			if (error) {
				toast.error("Could not delete notification.");
				void loadNotifications();
			}
		},
		[loadNotifications, notifications, userId],
	);

	useEffect(() => {
		void loadNotifications(true);
	}, [loadNotifications]);

	useEffect(() => {
		function handleOpenRequest() {
			setOpen(true);
			void loadNotifications();
		}

		window.addEventListener(NOTIFICATIONS_OPEN_EVENT, handleOpenRequest);

		return () => {
			window.removeEventListener(NOTIFICATIONS_OPEN_EVENT, handleOpenRequest);
		};
	}, [loadNotifications]);

	useEffect(() => {
		if (!featureReady) return;

		const channel = supabase
			.channel(`notifications:${userId}`)
			.on(
				"postgres_changes",
				{
					event: "INSERT",
					filter: `recipient_id=eq.${userId}`,
					schema: "public",
					table: "notifications",
				},
				(payload) => {
					const notification = normalizeNotification(
						payload.new as LintedNotification,
					);

					if (document.visibilityState === "visible") {
						toast.info(notification.title, {
							action: {
								label: "Open",
								onClick: () => void openNotification(notification),
							},
							description: notification.body || undefined,
						});
					}

					void loadNotifications();
				},
			)
			.on(
				"postgres_changes",
				{
					event: "UPDATE",
					filter: `recipient_id=eq.${userId}`,
					schema: "public",
					table: "notifications",
				},
				() => {
					void loadNotifications();
				},
			)
			.subscribe();

		function refreshWhenVisible() {
			if (document.visibilityState === "visible") {
				void loadNotifications();
			}
		}

		document.addEventListener("visibilitychange", refreshWhenVisible);
		window.addEventListener("focus", refreshWhenVisible);

		return () => {
			document.removeEventListener("visibilitychange", refreshWhenVisible);
			window.removeEventListener("focus", refreshWhenVisible);
			void supabase.removeChannel(channel);
		};
	}, [featureReady, loadNotifications, openNotification, userId]);

	const notificationById = useMemo(
		() =>
			new Map(
				notifications.map((notification) => [notification.id, notification]),
			),
		[notifications],
	);

	const teamNotifications = useMemo(
		() => notifications.map(toTeamNotification),
		[notifications],
	);

	const markNotificationIdRead = useCallback(
		async (notificationId: string) => {
			const notification = notificationById.get(notificationId);
			if (!notification) return;

			await markNotificationRead(notification);
		},
		[markNotificationRead, notificationById],
	);

	const openTeamNotification = useCallback(
		async (notification: TeamNotification) => {
			const sourceNotification = notificationById.get(notification.id);
			if (!sourceNotification) return;

			await openNotification(sourceNotification);
		},
		[notificationById, openNotification],
	);

	if (!featureReady) return null;

	return (
		<DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<button
					aria-label={
						unreadCount
							? `${unreadCount} unread notifications`
							: "Notifications"
					}
					className={cn(
						"notification-trigger",
						unreadCount ? "has-unread" : "",
					)}
					type="button"
				>
					<Bell aria-hidden="true" size={19} strokeWidth={2.1} />
					{unreadCount ? (
						<span className="notification-badge">
							{unreadCount > 99 ? "99+" : unreadCount}
						</span>
					) : null}
				</button>
			</DropdownMenuTrigger>

			<DropdownMenuContent
				align="end"
				className="notification-panel"
				collisionPadding={12}
				sideOffset={12}
			>
				<TeamNotifications
					className="h-full"
					loading={loading}
					notifications={teamNotifications}
					onMarkAllAsRead={markAllRead}
					onMarkAsRead={markNotificationIdRead}
					onDelete={deleteNotification}
					onOpen={openTeamNotification}
					pushControl={<PushNotificationsControl />}
					unreadCount={unreadCount}
				/>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
