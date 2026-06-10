"use client";

import { MoreVertical } from "lucide-react";
import {
	Bell,
	Check,
	CheckCheck,
	ExternalLink,
	MessageCircle,
	MessageSquare,
	ShieldCheck,
	ThumbsUp,
	UserCheck,
} from "@/components/ui/solar-icons";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import type { NotificationType } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type TeamNotificationFilter = NotificationType | "all";
type TeamNotificationStatus = "all" | "unread" | "read";
type NotificationFilterOption = {
	value: TeamNotificationFilter | TeamNotificationStatus;
	label: string;
};

export interface TeamNotification {
	id: string;
	type: NotificationType;
	title: string;
	message: string;
	user?: {
		id: string;
		name: string;
		avatar?: string;
	};
	link?: string;
	read: boolean;
	timestamp: Date;
	metadata?: Record<string, unknown>;
}

type TeamNotificationsProps = {
	notifications?: TeamNotification[];
	loading?: boolean;
	onOpen?: (notification: TeamNotification) => Promise<void> | void;
	onMarkAsRead?: (notificationId: string) => Promise<void>;
	onMarkAllAsRead?: () => Promise<void>;
	onDelete?: (notificationId: string) => Promise<void>;
	className?: string;
	pushControl?: ReactNode;
	showFilters?: boolean;
	unreadCount?: number;
};

const typeLabels: Record<NotificationType, string> = {
	resume_feedback: "Feedback",
	comment_reply: "Reply",
	resume_thread_reply: "Thread",
	helpful_vote: "Helpful",
	reviewer_status: "Trust",
	moderation: "Moderation",
	system: "System",
};

const primaryFilters: NotificationFilterOption[] = [
	{ value: "all", label: "All" },
	{ value: "unread", label: "Unread" },
	{ value: "resume_feedback", label: "Feedback" },
	{ value: "comment_reply", label: "Replies" },
	{ value: "helpful_vote", label: "Helpful" },
];

function formatRelativeTime(date: Date): string {
	const timestamp = date.getTime();
	if (Number.isNaN(timestamp)) return "";

	const diff = Date.now() - timestamp;
	const minutes = Math.floor(diff / 60_000);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (minutes < 1) return "Just now";
	if (minutes < 60) return `${minutes}m ago`;
	if (hours < 24) return `${hours}h ago`;
	if (days < 7) return `${days}d ago`;

	return new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		month: "short",
	}).format(date);
}

function getInitials(name: string): string {
	return name
		.split(" ")
		.map((part) => part[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

function NotificationTypeIcon({ type }: { type: NotificationType }) {
	const iconProps = {
		"aria-hidden": true,
		className: "size-4",
		strokeWidth: 2.1,
	};

	if (type === "helpful_vote") return <ThumbsUp {...iconProps} />;
	if (type === "reviewer_status") return <UserCheck {...iconProps} />;
	if (type === "moderation") return <ShieldCheck {...iconProps} />;
	if (type === "comment_reply" || type === "resume_thread_reply") {
		return <MessageSquare {...iconProps} />;
	}

	return <Bell {...iconProps} />;
}

function NotificationEmpty({
	children,
}: {
	children: ReactNode;
}) {
	return (
		<div className="flex min-h-[128px] flex-col items-center justify-center gap-2.5 px-5 py-8 text-center text-[0.78rem] font-semibold text-muted-foreground">
			<span className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-muted/45 text-muted-foreground">
				<Bell aria-hidden="true" className="size-[18px]" strokeWidth={2} />
			</span>
			<span>{children}</span>
		</div>
	);
}

export default function TeamNotifications({
	notifications = [],
	loading = false,
	onOpen,
	onMarkAsRead,
	onMarkAllAsRead,
	onDelete,
	className,
	pushControl,
	showFilters = true,
	unreadCount,
}: TeamNotificationsProps) {
	const [typeFilter, setTypeFilter] = useState<TeamNotificationFilter>("all");
	const [statusFilter, setStatusFilter] = useState<TeamNotificationStatus>("all");
	const [expandedNotificationId, setExpandedNotificationId] = useState<
		string | null
	>(null);

	function setQuickFilter(value: NotificationFilterOption["value"]) {
		if (value === "unread") {
			setStatusFilter("unread");
			setTypeFilter("all");
			return;
		}

		setStatusFilter("all");
		setTypeFilter(value as TeamNotificationFilter);
	}

	const filteredNotifications = useMemo(
		() =>
			notifications.filter((notification) => {
				const matchesType =
					typeFilter === "all" ||
					(typeFilter === "comment_reply"
						? notification.type === "comment_reply" ||
							notification.type === "resume_thread_reply"
						: notification.type === typeFilter);
				const matchesStatus =
					statusFilter === "all" ||
					(statusFilter === "unread" && !notification.read) ||
					(statusFilter === "read" && notification.read);

				return matchesType && matchesStatus;
			}),
		[notifications, statusFilter, typeFilter],
	);

	useEffect(() => {
		if (
			expandedNotificationId &&
			!filteredNotifications.some(
				(notification) => notification.id === expandedNotificationId,
			)
		) {
			setExpandedNotificationId(null);
		}
	}, [expandedNotificationId, filteredNotifications]);

	function toggleNotificationDetails(notification: TeamNotification) {
		const nextExpanded =
			expandedNotificationId === notification.id ? null : notification.id;

		setExpandedNotificationId(nextExpanded);
	}

	const loadedUnreadCount = notifications.filter((notification) => !notification.read).length;
	const displayUnreadCount = unreadCount ?? loadedUnreadCount;
	const activeQuickFilter =
		statusFilter === "unread" ? "unread" : typeFilter;
	const emptyMessage =
		typeFilter !== "all" || statusFilter !== "all"
			? "No notifications match your filters."
			: "No notifications yet.";

	return (
		<section
			className={cn("flex max-h-[inherit] flex-col bg-background", className)}
		>
			<header className="border-b border-border bg-muted/20 px-3 py-3">
				<div className="flex flex-col gap-3">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							<h2 className="text-[0.92rem] font-bold tracking-[-0.01em] text-foreground">
								Notifications
							</h2>
							<p className="mt-0.5 text-[0.72rem] font-semibold text-muted-foreground">
								{displayUnreadCount > 0 ? (
									<span className="text-primary">
										{displayUnreadCount} unread
									</span>
								) : (
									"All caught up"
								)}
							</p>
						</div>
						<div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
							{pushControl}
							{onMarkAllAsRead ? (
								<Button
									disabled={!displayUnreadCount}
									onClick={() => void onMarkAllAsRead()}
									size="xs"
									type="button"
									variant="outline"
								>
									<CheckCheck className="size-3" />
									Mark read
								</Button>
							) : null}
						</div>
					</div>

					{showFilters ? (
						<div
							className="flex gap-1.5 overflow-x-auto pb-1"
							role="tablist"
							aria-label="Notification filters"
						>
							{primaryFilters.map((filter) => (
								<button
									key={filter.value}
									aria-selected={activeQuickFilter === filter.value}
									className={cn(
										"shrink-0 rounded-[10px] border px-2.5 py-1.5 text-[0.72rem] font-bold leading-none transition-colors",
										activeQuickFilter === filter.value
											? "border-primary/25 bg-primary/10 text-foreground"
											: "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
									)}
									onClick={() => setQuickFilter(filter.value)}
									role="tab"
									type="button"
								>
									{filter.label}
								</button>
							))}
						</div>
					) : null}
				</div>
			</header>

			<div className="min-h-0 overflow-y-auto p-1.5">
				{loading ? <NotificationEmpty>Loading notifications...</NotificationEmpty> : null}

				{!loading && filteredNotifications.length === 0 ? (
					<NotificationEmpty>{emptyMessage}</NotificationEmpty>
				) : null}

				{!loading && filteredNotifications.length > 0 ? (
					<div className="flex flex-col">
						{filteredNotifications.map((notification, index) => {
							const unread = !notification.read;
							const expanded = expandedNotificationId === notification.id;
							const detailId = `notification-detail-${notification.id}`;

							return (
								<div key={notification.id}>
									<div
										className={cn(
											"grid grid-cols-[minmax(0,1fr)_auto] items-start gap-1 rounded-xl transition-colors duration-150 ease-out",
											unread ? "bg-primary/5" : "",
											"hover:bg-muted/45",
										)}
									>
										<button
											className="grid min-w-0 grid-cols-[34px_minmax(0,1fr)] gap-2.5 rounded-xl px-2.5 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
											aria-controls={detailId}
											aria-expanded={expanded}
											onClick={() => toggleNotificationDetails(notification)}
											type="button"
										>
											<span
												className={cn(
													"inline-flex size-[34px] items-center justify-center rounded-full border",
													unread
														? "border-primary/20 bg-primary/10 text-primary"
														: "border-border bg-muted/45 text-muted-foreground",
												)}
											>
												{notification.user ? (
													<Avatar className="size-[34px]">
														<AvatarImage
															alt={notification.user.name}
															src={notification.user.avatar}
														/>
														<AvatarFallback className="text-xs font-bold">
															{getInitials(notification.user.name)}
														</AvatarFallback>
													</Avatar>
												) : (
													<NotificationTypeIcon type={notification.type} />
												)}
											</span>
											<span className="min-w-0">
												<span className="flex min-w-0 items-center gap-2">
													<strong className="min-w-0 truncate text-[0.8rem] font-bold leading-5 text-foreground">
														{notification.title}
													</strong>
													{unread ? (
														<span className="size-2 shrink-0 rounded-full bg-primary" />
													) : null}
												</span>
												<span className="mt-0.5 line-clamp-2 text-[0.74rem] font-medium leading-4 text-muted-foreground">
													{notification.message}
												</span>
												<span className="mt-1.5 flex flex-wrap items-center gap-2">
													<Badge
														className="rounded-full px-2 py-0 text-[0.65rem] font-bold"
														variant="outline"
													>
														{typeLabels[notification.type]}
													</Badge>
													<span className="text-[0.68rem] font-semibold text-muted-foreground">
														{formatRelativeTime(notification.timestamp)}
													</span>
												</span>
											</span>
										</button>

										<DropdownMenu modal={false}>
											<DropdownMenuTrigger asChild>
												<Button
													aria-label="Notification options"
													className="mr-1.5 mt-1.5"
													size="icon-sm"
													type="button"
													variant="ghost"
												>
													<MoreVertical className="size-4" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent
												align="end"
												className="z-[1200] w-40"
												collisionPadding={12}
												sideOffset={6}
											>
												{unread && onMarkAsRead ? (
													<DropdownMenuItem
														onSelect={() => void onMarkAsRead(notification.id)}
													>
														<Check className="size-4" />
														Mark as read
													</DropdownMenuItem>
												) : null}
												{notification.link ? (
													<DropdownMenuItem
														onSelect={() => void onOpen?.(notification)}
													>
														<MessageCircle className="size-4" />
														Open link
													</DropdownMenuItem>
												) : null}
												{onDelete ? (
													<>
														<DropdownMenuSeparator />
														<DropdownMenuItem
															className="text-destructive focus:bg-destructive/10 focus:text-destructive"
															onSelect={() => void onDelete(notification.id)}
														>
															Delete
														</DropdownMenuItem>
													</>
												) : null}
											</DropdownMenuContent>
										</DropdownMenu>

										{expanded ? (
											<div
												className="col-span-2 px-2.5 pb-2.5 pt-0"
												id={detailId}
											>
												<div className="rounded-[10px] border border-border/70 bg-background/80 p-3">
													<p className="whitespace-pre-wrap break-words text-[0.76rem] font-medium leading-5 text-foreground/90">
														{notification.message || "No message details."}
													</p>
													{(unread && onMarkAsRead) || notification.link ? (
														<div className="mt-3 flex flex-wrap gap-2">
															{unread && onMarkAsRead ? (
																<Button
																	className="w-full justify-center sm:w-auto"
																	onClick={() =>
																		void onMarkAsRead(notification.id)
																	}
																	size="xs"
																	type="button"
																	variant="outline"
																>
																	<Check className="size-3" />
																	Mark read
																</Button>
															) : null}
															{notification.link ? (
																<Button
																	className="w-full justify-center sm:w-auto"
																	onClick={() => void onOpen?.(notification)}
																	size="xs"
																	type="button"
																	variant="outline"
																>
																	<ExternalLink className="size-3" />
																	Open link
																</Button>
															) : null}
														</div>
													) : null}
												</div>
											</div>
										) : null}
									</div>
									{index < filteredNotifications.length - 1 ? (
										<Separator className="my-1" />
									) : null}
								</div>
							);
						})}
					</div>
				) : null}
			</div>
		</section>
	);
}
