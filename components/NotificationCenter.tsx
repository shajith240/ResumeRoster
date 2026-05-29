"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
	Bell,
	CheckCheck,
	MessageCircle,
	Megaphone,
	ShieldCheck,
	ThumbsUp,
	UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { announceRouteTransition } from "@/components/RouteTransitionLoader";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	NOTIFICATIONS_OPEN_EVENT,
	NOTIFICATION_SELECT,
	getNotificationHref,
	getNotificationTone,
	isNotificationsFeatureError,
	unreadNotificationCount,
} from "@/lib/notifications";
import { supabase } from "@/lib/supabase/client";
import type {
	LintedNotification,
	NotificationType,
} from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type NotificationCenterProps = {
	userId: string;
};

type NotificationFilter = "all" | "unread";

const NOTIFICATION_LIMIT = 30;

function formatNotificationAge(value: string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";

	const elapsedSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
	if (elapsedSeconds < 60) return "now";

	const elapsedMinutes = Math.floor(elapsedSeconds / 60);
	if (elapsedMinutes < 60) return `${elapsedMinutes}m`;

	const elapsedHours = Math.floor(elapsedMinutes / 60);
	if (elapsedHours < 24) return `${elapsedHours}h`;

	const elapsedDays = Math.floor(elapsedHours / 24);
	if (elapsedDays < 7) return `${elapsedDays}d`;

	return new Intl.DateTimeFormat(undefined, {
		day: "numeric",
		month: "short",
	}).format(date);
}

function NotificationGlyph({ type }: { type: NotificationType }) {
	const props = {
		"aria-hidden": true,
		size: 17,
		strokeWidth: 2.1,
	};

	if (type === "helpful_vote") return <ThumbsUp {...props} />;
	if (type === "reviewer_status") return <UserCheck {...props} />;
	if (type === "moderation") return <ShieldCheck {...props} />;
	if (type === "system") return <Megaphone {...props} />;

	return <MessageCircle {...props} />;
}

function normalizeNotification(row: LintedNotification): LintedNotification {
	return {
		...row,
		body: row.body ?? "",
		link_href: row.link_href || "/feed",
		metadata: row.metadata ?? {},
	};
}

export default function NotificationCenter({ userId }: NotificationCenterProps) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [filter, setFilter] = useState<NotificationFilter>("all");
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

	const visibleNotifications = useMemo(
		() =>
			filter === "unread"
				? notifications.filter((notification) => !notification.read_at)
				: notifications,
		[filter, notifications],
	);

	if (!featureReady) return null;

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
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
				<header className="notification-panel-header">
					<div>
						<h2>Notifications</h2>
						<p>{unreadCount ? `${unreadCount} unread` : "All caught up"}</p>
					</div>
					<button
						className="notification-mark-all"
						disabled={!unreadCount}
						onClick={() => void markAllRead()}
						type="button"
					>
						<CheckCheck aria-hidden="true" size={16} strokeWidth={2.1} />
						Mark read
					</button>
				</header>

				<div className="notification-tabs" role="tablist" aria-label="Notifications filter">
					<button
						aria-selected={filter === "all"}
						className={filter === "all" ? "active" : ""}
						onClick={() => setFilter("all")}
						role="tab"
						type="button"
					>
						All
					</button>
					<button
						aria-selected={filter === "unread"}
						className={filter === "unread" ? "active" : ""}
						onClick={() => setFilter("unread")}
						role="tab"
						type="button"
					>
						Unread
					</button>
				</div>

				<div className="notification-list" role="list">
					{loading ? (
						<div className="notification-empty">Loading notifications...</div>
					) : null}

					{!loading && visibleNotifications.length === 0 ? (
						<div className="notification-empty">
							{filter === "unread" ? "No unread notifications." : "No notifications yet."}
						</div>
					) : null}

					{!loading
						? visibleNotifications.map((notification) => {
								const unread = !notification.read_at;
								const tone = getNotificationTone(notification.type);

								return (
									<div key={notification.id} role="listitem">
										<button
											className={cn(
												"notification-item",
												unread ? "is-unread" : "",
											)}
											onClick={() => void openNotification(notification)}
											type="button"
										>
											<span className={`notification-icon tone-${tone}`}>
												<NotificationGlyph type={notification.type} />
											</span>
											<span className="notification-copy">
												<span className="notification-title-row">
													<strong>{notification.title}</strong>
													<time dateTime={notification.created_at}>
														{formatNotificationAge(notification.created_at)}
													</time>
												</span>
												{notification.body ? <span>{notification.body}</span> : null}
											</span>
											{unread ? <span className="notification-dot" /> : null}
										</button>
									</div>
								);
							})
						: null}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
