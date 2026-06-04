"use client";

import Link from "next/link";
import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	Activity,
	BadgeCheck,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Database,
	ExternalLink,
	FileText,
	Flag,
	History,
	LayoutDashboard,
	MessageSquare,
	RefreshCcw,
	RotateCcw,
	Search,
	Send,
	ShieldAlert,
	ShieldCheck,
	Trash2,
	UserRound,
	UsersRound,
	UserX,
	XCircle,
	type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	ADMIN_MESSAGE_BODY_MAX_LENGTH,
	ADMIN_MESSAGE_TITLE_MAX_LENGTH,
	DEFAULT_ADMIN_MESSAGE_LINK,
	isSafeAdminMessageLink,
} from "@/lib/admin-messages";
import { supabase } from "@/lib/supabase/client";
import { useAdminAccess } from "@/lib/use-admin-access";
import type {
	ContentReportStatus,
	ContentReportTargetType,
} from "@/lib/supabase/types";
import {
	getReviewerTypeLabel,
	isReviewerType,
	type ReviewerApplicationStatus,
} from "@/lib/reviewer-validation";

export type AdminDashboardView =
	| "audit"
	| "content"
	| "data"
	| "overview"
	| "people"
	| "reports"
	| "reviewers";

type AdminStats = {
	activeReviewers: number;
	activeRoasters?: number;
	openResumes: number;
	pendingReports: number;
	pendingReviewers: number;
	replies: number;
	resumes: number;
	reviews: number;
	roasts?: number;
	users: number;
};

type AdminResume = {
	id: string;
	title: string;
	status: string;
	roast_count?: number;
	read_count?: number;
	created_at: string;
};

type AdminReview = {
	id: string;
	resume_id: string;
	content: string;
	is_deleted?: boolean;
	created_at: string;
};

type AdminOverview = {
	activity: {
		recentResumes: AdminResume[];
		recentReviews: AdminReview[];
		recentRoasts?: AdminReview[];
	};
	stats: AdminStats;
};

type ProfilePreview = {
	id: string;
	username: string | null;
	full_name: string | null;
	avatar_url?: string | null;
	current_position?: string | null;
	community_role?: string | null;
	reviewer_type?: string | null;
	reviewer_headline?: string | null;
	reviewer_verification_status?: string | null;
	roast_count?: number;
	helpful_votes?: number;
};

type ReportPreview = {
	id: string;
	details: string;
	reason: string;
	report_count: number;
	reportedUser: ProfilePreview | null;
	reporter: ProfilePreview | null;
	profile: ProfilePreview | null;
	resume: AdminResume | null;
	review?: AdminReview | null;
	roast: AdminReview | null;
	status: ContentReportStatus;
	target_type: ContentReportTargetType;
	updated_at: string;
	last_reported_at?: string;
};

type ReviewerApplicationPreview = {
	id: string;
	admin_note: string;
	created_at: string;
	expertise: string[];
	note: string;
	profile: ProfilePreview | null;
	proof_url: string;
	requested_type: string;
	reviewed_at: string | null;
	reviewedBy: ProfilePreview | null;
	status: ReviewerApplicationStatus;
	updated_at: string;
	user_id: string;
};

type AdminUserDataFootprint = {
	attachments: number;
	reportsFiled: number;
	resumes: number;
	reviewerApplications: number;
	reviews: number;
	votes: number;
};

type AdminUser = {
	id: string;
	email: string | null;
	created_at: string | null;
	last_sign_in_at: string | null;
	profile: ProfilePreview | null;
	dataFootprint?: AdminUserDataFootprint;
};

type ActiveAdminUser = {
	email: string | null;
	lastSeenAt: string;
	profile: ProfilePreview | null;
	status: string;
	userId: string;
};

type AdminUsersPagination = {
	from: number;
	hasNextPage: boolean;
	hasPreviousPage: boolean;
	lastPage: number;
	page: number;
	perPage: number;
	to: number;
	total: number;
};

type AdminUsersResponse = {
	activeUsers: ActiveAdminUser[];
	latestUsers: AdminUser[];
	pagination: AdminUsersPagination;
	query: string;
	users: AdminUser[];
};

type AdminMessageDialogTarget =
	| {
			mode: "all";
	  }
	| {
			mode: "user";
			user: AdminUser;
	  };

type AdminMessageForm = {
	body: string;
	customLinkHref: string;
	linkChoice: string;
	title: string;
};

type AdminMessageResponse = {
	auditLogId: string;
	delivered: number;
	failed: number;
	skipped: number;
	status: "ok";
	total: number;
};

type ModerationAction = {
	id: string;
	action: string;
	adminProfile: ProfilePreview | null;
	created_at: string;
	reason: string;
	report_id: string | null;
	target_id: string | null;
	target_type: string;
};

type DataMetric = {
	detail?: string;
	key: string;
	label: string;
	value: number | string;
};

type AdminDataInventory = {
	lifecycle: DataMetric[];
	storage: DataMetric[];
	tables: DataMetric[];
};

type AdminSection = {
	description: string;
	group: "Governance" | "Operations";
	href: string;
	icon: LucideIcon;
	id: AdminDashboardView;
	label: string;
	title: string;
};

const adminSections: AdminSection[] = [
	{
		description: "Health, queues, and shortcuts.",
		group: "Operations",
		href: "/admin",
		icon: LayoutDashboard,
		id: "overview",
		label: "Overview",
		title: "Admin Overview",
	},
	{
		description: "Reports that need moderation decisions.",
		group: "Governance",
		href: "/admin/reports",
		icon: Flag,
		id: "reports",
		label: "Reports",
		title: "Reports",
	},
	{
		description: "Users, profiles, data footprint, and account actions.",
		group: "Operations",
		href: "/admin/people",
		icon: UsersRound,
		id: "people",
		label: "People",
		title: "People",
	},
	{
		description: "Reviewer trust applications and proof checks.",
		group: "Governance",
		href: "/admin/reviewers",
		icon: BadgeCheck,
		id: "reviewers",
		label: "Reviewer Trust",
		title: "Reviewer Trust",
	},
	{
		description: "Newest resumes and feedback activity.",
		group: "Operations",
		href: "/admin/content",
		icon: FileText,
		id: "content",
		label: "Content",
		title: "Content",
	},
	{
		description: "Recent admin actions and moderation history.",
		group: "Governance",
		href: "/admin/audit",
		icon: History,
		id: "audit",
		label: "Audit",
		title: "Audit Trail",
	},
	{
		description: "Table counts, storage surface, and deletion model.",
		group: "Governance",
		href: "/admin/data",
		icon: Database,
		id: "data",
		label: "Data",
		title: "Data Control",
	},
];

const reportStatuses: ContentReportStatus[] = [
	"pending",
	"reviewing",
	"actioned",
	"dismissed",
];
const reviewerStatuses: ReviewerApplicationStatus[] = [
	"pending",
	"approved",
	"rejected",
];

const adminMessageLinkOptions = [
	{ label: "Feed", value: "/feed" },
	{ label: "Submit", value: "/submit" },
	{ label: "Leaderboard", value: "/leaderboard" },
	{ label: "My profile", value: "/profile/me" },
	{ label: "Custom path", value: "custom" },
];

const adminMessageTemplates: Array<{
	body: string;
	id: string;
	label: string;
	linkHref: string;
	title: string;
}> = [
	{
		body: "Upload a resume when you are ready for a fresh lint pass.",
		id: "upload",
		label: "Upload nudge",
		linkHref: "/submit",
		title: "Add your resume",
	},
	{
		body: "A few resumes are waiting for thoughtful feedback from the community.",
		id: "review",
		label: "Review nudge",
		linkHref: "/feed",
		title: "Help review a resume",
	},
	{
		body: "A quick note from the Linted team.",
		id: "general",
		label: "Announcement",
		linkHref: "/feed",
		title: "Linted update",
	},
];

function formatDate(value: string | null | undefined) {
	if (!value) return "Never";
	return new Intl.DateTimeFormat("en", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function getProfileLabel(profile: ProfilePreview | null) {
	if (!profile) return "Unknown";
	return profile.username || profile.full_name || profile.id.slice(0, 8);
}

function getProfileSecondary(profile: ProfilePreview | null) {
	if (!profile) return "No public profile row";
	return (
		profile.reviewer_headline ||
		profile.current_position ||
		profile.reviewer_type ||
		profile.community_role ||
		"Profile details not set"
	);
}

function formatReason(value: string) {
	return value.replaceAll("_", " ");
}

function formatTargetType(value: string) {
	return value === "roast" ? "review" : formatReason(value);
}

function getTargetTitle(report: ReportPreview) {
	if (report.target_type === "profile") {
		return `Profile: ${getProfileLabel(report.profile ?? report.reportedUser)}`;
	}

	if (report.target_type === "roast") {
		return report.review?.content || report.roast?.content || "Reported feedback";
	}

	return report.resume?.title || "Reported resume";
}

function getFootprintTotal(footprint?: AdminUserDataFootprint) {
	if (!footprint) return 0;
	return (
		footprint.attachments +
		footprint.reportsFiled +
		footprint.resumes +
		footprint.reviewerApplications +
		footprint.reviews +
		footprint.votes
	);
}

function getAdminMessageAudienceLabel(target: AdminMessageDialogTarget | null) {
	if (!target) return "";
	if (target.mode === "all") return "All users";

	const profileLabel = getProfileLabel(target.user.profile);
	return target.user.email ? `${profileLabel} (${target.user.email})` : profileLabel;
}

function getAdminMessageLinkChoice(linkHref: string) {
	const knownOption = adminMessageLinkOptions.find(
		(option) => option.value === linkHref,
	);
	return knownOption ? knownOption.value : "custom";
}

export default function AdminDashboard({
	view = "overview",
}: {
	view?: AdminDashboardView;
}) {
	const { email, isAdmin, loading } = useAdminAccess();
	const [accessToken, setAccessToken] = useState("");
	const [currentAdminUserId, setCurrentAdminUserId] = useState("");
	const [overview, setOverview] = useState<AdminOverview | null>(null);
	const [reports, setReports] = useState<ReportPreview[]>([]);
	const [reviewerApplications, setReviewerApplications] = useState<
		ReviewerApplicationPreview[]
	>([]);
	const [users, setUsers] = useState<AdminUser[]>([]);
	const [latestUsers, setLatestUsers] = useState<AdminUser[]>([]);
	const [activeUsers, setActiveUsers] = useState<ActiveAdminUser[]>([]);
	const [peoplePagination, setPeoplePagination] =
		useState<AdminUsersPagination>({
			from: 0,
			hasNextPage: false,
			hasPreviousPage: false,
			lastPage: 1,
			page: 1,
			perPage: 10,
			to: 0,
			total: 0,
		});
	const [actions, setActions] = useState<ModerationAction[]>([]);
	const [dataInventory, setDataInventory] = useState<AdminDataInventory | null>(
		null,
	);
	const [reportStatus, setReportStatus] =
		useState<ContentReportStatus>("pending");
	const [reviewerStatus, setReviewerStatus] =
		useState<ReviewerApplicationStatus>("pending");
	const [userQuery, setUserQuery] = useState("");
	const [peoplePage, setPeoplePage] = useState(1);
	const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
	const [busyAction, setBusyAction] = useState("");
	const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
	const [messageTarget, setMessageTarget] =
		useState<AdminMessageDialogTarget | null>(null);
	const [messageSending, setMessageSending] = useState(false);
	const [pageLoading, setPageLoading] = useState(false);

	const activeSection =
		adminSections.find((section) => section.id === view) ?? adminSections[0];

	const headers = useMemo(
		() => ({
			Authorization: `Bearer ${accessToken}`,
		}),
		[accessToken],
	);

	useEffect(() => {
		let active = true;

		async function loadSession() {
			const {
				data: { session },
			} = await supabase.auth.getSession();

			if (active) {
				setAccessToken(session?.access_token ?? "");
				setCurrentAdminUserId(session?.user.id ?? "");
			}
		}

		void loadSession();
		return () => {
			active = false;
		};
	}, []);

	const fetchJson = useCallback(
		async function fetchJson<T>(url: string, init?: RequestInit) {
			const response = await fetch(url, {
				...init,
				headers: {
					...headers,
					...(init?.headers ?? {}),
				},
			});

			const data = await response.json().catch(() => ({}));

			if (!response.ok) {
				throw new Error(
					(data as { message?: string })?.message ?? "Admin request failed.",
				);
			}

			return data as T;
		},
		[headers],
	);

	const loadAdminData = useCallback(async function loadAdminData() {
		if (!accessToken || !isAdmin) return;

		setPageLoading(true);

		try {
			const overviewPromise = fetchJson<AdminOverview>("/api/admin/overview");
			const sectionPromise = (() => {
				if (view === "reports") {
					return fetchJson<{ reports: ReportPreview[] }>(
						`/api/admin/reports?status=${reportStatus}&limit=100`,
					);
				}
				if (view === "reviewers") {
					return fetchJson<{ applications: ReviewerApplicationPreview[] }>(
						`/api/admin/reviewers?status=${reviewerStatus}&limit=100`,
					);
				}
				if (view === "people") {
					const params = new URLSearchParams({
						page: String(peoplePage),
						perPage: "10",
					});
					if (userQuery.trim()) {
						params.set("query", userQuery.trim());
					}
					return fetchJson<AdminUsersResponse>(
						`/api/admin/users?${params.toString()}`,
					);
				}
				if (view === "audit") {
					return fetchJson<{ actions: ModerationAction[] }>(
						"/api/admin/actions?limit=100",
					);
				}
				if (view === "data") {
					return fetchJson<AdminDataInventory>("/api/admin/data");
				}
				return Promise.resolve(null);
			})();

			const [overviewData, sectionData] = await Promise.all([
				overviewPromise,
				sectionPromise,
			]);

			setOverview(overviewData);

			if (view === "reports") {
				setReports(
					(sectionData as { reports: ReportPreview[] } | null)?.reports ?? [],
				);
			}
			if (view === "reviewers") {
				setReviewerApplications(
					(sectionData as { applications: ReviewerApplicationPreview[] } | null)
						?.applications ?? [],
				);
			}
			if (view === "people") {
				const peopleData = sectionData as AdminUsersResponse | null;
				setUsers(peopleData?.users ?? []);
				setLatestUsers(peopleData?.latestUsers ?? []);
				setActiveUsers(peopleData?.activeUsers ?? []);
				if (peopleData?.pagination) {
					setPeoplePagination(peopleData.pagination);
				}
			}
			if (view === "audit") {
				setActions(
					(sectionData as { actions: ModerationAction[] } | null)?.actions ??
						[],
				);
			}
			if (view === "data") {
				setDataInventory(sectionData as AdminDataInventory | null);
			}
		} finally {
			setPageLoading(false);
		}
	}, [
		accessToken,
		fetchJson,
		isAdmin,
		peoplePage,
		reportStatus,
		reviewerStatus,
		userQuery,
		view,
	]);

	useEffect(() => {
		void loadAdminData().catch((error) => {
			toast.error(error instanceof Error ? error.message : "Admin load failed.");
		});
	}, [loadAdminData]);

	useEffect(() => {
		if (view !== "people" || !accessToken || !isAdmin) return;

		const timer = window.setInterval(() => {
			void loadAdminData().catch((error) => {
				toast.error(error instanceof Error ? error.message : "Admin refresh failed.");
			});
		}, 30_000);

		return () => window.clearInterval(timer);
	}, [accessToken, isAdmin, loadAdminData, view]);

	async function runReportAction(reportId: string, action: string) {
		const actionKey = `report:${reportId}:${action}`;
		setBusyAction(actionKey);

		try {
			await fetchJson(`/api/admin/reports/${reportId}/action`, {
				body: JSON.stringify({
					action,
					note: adminNotes[reportId] ?? "",
				}),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			});
			toast.success("Moderation action saved.");
			setAdminNotes((current) => ({ ...current, [reportId]: "" }));
			await loadAdminData();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Action failed.");
		} finally {
			setBusyAction("");
		}
	}

	async function runUserAction(userId: string, action: string) {
		const actionKey = `user:${userId}:${action}`;
		const body: Record<string, string> = { action };

		if (action === "delete_user_account") {
			body.confirm = "delete-user-data";
			body.note = "Deleted from admin people control.";
		}

		setBusyAction(actionKey);

		try {
			await fetchJson(`/api/admin/users/${userId}/action`, {
				body: JSON.stringify(body),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			});
			toast.success(
				action === "delete_user_account"
					? "User and linked data deleted."
					: "Profile action saved.",
			);
			if (action === "delete_user_account") {
				setDeleteTarget(null);
			}
			await loadAdminData();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Action failed.");
		} finally {
			setBusyAction("");
		}
	}

	async function sendAdminMessage(message: AdminMessageForm) {
		if (!messageTarget) return;

		const linkHref =
			message.linkChoice === "custom"
				? message.customLinkHref
				: message.linkChoice || DEFAULT_ADMIN_MESSAGE_LINK;

		setMessageSending(true);

		try {
			const response = await fetchJson<AdminMessageResponse>(
				"/api/admin/messages",
				{
					body: JSON.stringify({
						body: message.body,
						linkHref,
						target:
							messageTarget.mode === "all"
								? { mode: "all" }
								: { mode: "user", userId: messageTarget.user.id },
						title: message.title,
					}),
					headers: { "Content-Type": "application/json" },
					method: "POST",
				},
			);

			const skippedText = response.skipped
				? ` ${response.skipped} skipped by preferences.`
				: "";
			toast.success(`Message sent to ${response.delivered} users.${skippedText}`);
			setMessageTarget(null);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Message failed.");
		} finally {
			setMessageSending(false);
		}
	}

	async function runReviewerAction(applicationId: string, action: string) {
		const actionKey = `reviewer:${applicationId}:${action}`;
		setBusyAction(actionKey);

		try {
			await fetchJson(`/api/admin/reviewers/${applicationId}/action`, {
				body: JSON.stringify({ action }),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			});
			toast.success("Reviewer action saved.");
			await loadAdminData();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Action failed.");
		} finally {
			setBusyAction("");
		}
	}

	if (loading) {
		return <main className="admin-route page-enter">Checking admin access...</main>;
	}

	if (!isAdmin) {
		return (
			<main className="admin-route page-enter">
				<section className="admin-access-card">
					<ShieldCheck size={28} strokeWidth={2} aria-hidden="true" />
					<h1>Admin access required</h1>
					<p>This area is limited to emails listed in ADMIN_EMAILS.</p>
					<Link className="btn-primary" href="/feed">
						Return to feed
					</Link>
				</section>
			</main>
		);
	}

	const stats = overview?.stats;
	const attentionCount =
		(stats?.pendingReports ?? 0) + (stats?.pendingReviewers ?? 0);

	return (
		<main className="admin-route admin-console page-enter">
			<header className="admin-page-header">
				<div>
					<span className="admin-eyebrow">Linted Admin</span>
					<h1>{activeSection.title}</h1>
					<p>{activeSection.description}</p>
					{email ? <small>{email}</small> : null}
				</div>
				<div className="admin-header-actions">
					<Button
						className="admin-refresh-button"
						onClick={() => void loadAdminData()}
						type="button"
					>
						<RefreshCcw aria-hidden="true" />
						Refresh
					</Button>
				</div>
			</header>

			<section className="admin-command-strip" aria-label="Site overview">
				<MetricCard
					icon={<ShieldAlert aria-hidden="true" />}
					label="Needs attention"
					tone={attentionCount ? "danger" : "normal"}
					value={attentionCount}
				/>
				<MetricCard
					icon={<Flag aria-hidden="true" />}
					label="Pending reports"
					tone={stats?.pendingReports ? "danger" : "normal"}
					value={stats?.pendingReports ?? 0}
				/>
				<MetricCard
					icon={<BadgeCheck aria-hidden="true" />}
					label="Trust reviews"
					value={stats?.pendingReviewers ?? 0}
				/>
				<MetricCard
					icon={<UsersRound aria-hidden="true" />}
					label="Users"
					value={stats?.users ?? 0}
				/>
				<MetricCard
					icon={<FileText aria-hidden="true" />}
					label="Open resumes"
					value={stats?.openResumes ?? 0}
				/>
				<MetricCard
					icon={<MessageSquare aria-hidden="true" />}
					label="Feedback"
					value={stats?.reviews ?? stats?.roasts ?? 0}
				/>
				<MetricCard
					icon={<UserRound aria-hidden="true" />}
					label="Active now"
					value={stats?.activeReviewers ?? stats?.activeRoasters ?? 0}
				/>
			</section>

			<div className="admin-console-layout">
				<AdminSectionNav activeView={view} stats={stats} />
				<div className="admin-console-main">
					{pageLoading ? (
						<div className="admin-page-loading">Refreshing admin data</div>
					) : null}
					{view === "overview" ? (
						<OverviewPage stats={stats} />
					) : null}
					{view === "reports" ? (
						<ReportsPage
							adminNotes={adminNotes}
							busyAction={busyAction}
							onAction={runReportAction}
							onNoteChange={(reportId, value) =>
								setAdminNotes((current) => ({
									...current,
									[reportId]: value,
								}))
							}
							onStatusChange={(value) =>
								setReportStatus(value as ContentReportStatus)
							}
							reports={reports}
							status={reportStatus}
						/>
					) : null}
					{view === "people" ? (
						<PeoplePage
							activeUsers={activeUsers}
							busyAction={busyAction}
							currentAdminUserId={currentAdminUserId}
							latestUsers={latestUsers}
							onAction={runUserAction}
							onDeleteRequest={setDeleteTarget}
							onMessageRequest={setMessageTarget}
							onPageChange={setPeoplePage}
							onQueryChange={(value) => {
								setUserQuery(value);
								setPeoplePage(1);
							}}
							pagination={peoplePagination}
							query={userQuery}
							users={users}
						/>
					) : null}
					{view === "reviewers" ? (
						<ReviewersPage
							applications={reviewerApplications}
							busyAction={busyAction}
							onAction={runReviewerAction}
							onStatusChange={(value) =>
								setReviewerStatus(value as ReviewerApplicationStatus)
							}
							status={reviewerStatus}
						/>
					) : null}
					{view === "content" ? (
						<ContentPage overview={overview} />
					) : null}
					{view === "audit" ? <AuditPage actions={actions} /> : null}
					{view === "data" ? <DataPage inventory={dataInventory} /> : null}
				</div>
			</div>
			<DeleteUserDialog
				busy={Boolean(
					deleteTarget &&
						busyAction ===
							`user:${deleteTarget.id}:delete_user_account`,
				)}
				onConfirm={() =>
					deleteTarget
						? runUserAction(deleteTarget.id, "delete_user_account")
						: Promise.resolve()
				}
				onOpenChange={(open) => {
					if (!open) setDeleteTarget(null);
				}}
				user={deleteTarget}
			/>
			<AdminMessageDialog
				busy={messageSending}
				onOpenChange={(open) => {
					if (!open) setMessageTarget(null);
				}}
				onSend={sendAdminMessage}
				target={messageTarget}
			/>
		</main>
	);
}

function getSectionBadge(sectionId: AdminDashboardView, stats?: AdminStats) {
	if (sectionId === "reports" && stats?.pendingReports) {
		return stats.pendingReports;
	}
	if (sectionId === "reviewers" && stats?.pendingReviewers) {
		return stats.pendingReviewers;
	}
	if (sectionId === "people" && stats?.users) {
		return stats.users;
	}
	if (sectionId === "content" && stats?.openResumes) {
		return stats.openResumes;
	}
	if (sectionId === "overview") {
		const attention =
			(stats?.pendingReports ?? 0) + (stats?.pendingReviewers ?? 0);
		return attention || null;
	}
	return null;
}

function AdminSectionNav({
	activeView,
	stats,
}: {
	activeView: AdminDashboardView;
	stats?: AdminStats;
}) {
	const groups: Array<AdminSection["group"]> = ["Operations", "Governance"];

	return (
		<nav className="admin-section-nav" aria-label="Admin sections">
			<div className="admin-section-nav-header">
				<strong>Operations Console</strong>
				<span>Moderate, message, and inspect.</span>
			</div>
			{groups.map((group) => (
				<div className="admin-section-nav-group" key={group}>
					<span>{group}</span>
					{adminSections
						.filter((section) => section.group === group)
						.map((section) => {
							const Icon = section.icon;
							const badge = getSectionBadge(section.id, stats);
							return (
								<Link
									aria-current={activeView === section.id ? "page" : undefined}
									className={activeView === section.id ? "active" : ""}
									href={section.href}
									key={section.id}
								>
									<Icon aria-hidden="true" />
									<span className="admin-nav-item-copy">
										<strong>{section.label}</strong>
										<small>{section.description}</small>
									</span>
									{badge ? (
										<b className="admin-nav-badge">{badge.toLocaleString()}</b>
									) : null}
								</Link>
							);
						})}
				</div>
			))}
		</nav>
	);
}

function MetricCard({
	icon,
	label,
	tone = "normal",
	value,
}: {
	icon: ReactNode;
	label: string;
	tone?: "danger" | "normal";
	value: number;
}) {
	return (
		<div className={`admin-metric-card admin-metric-${tone}`}>
			<div>{icon}</div>
			<strong>{value.toLocaleString()}</strong>
			<span>{label}</span>
		</div>
	);
}

function OverviewPage({ stats }: { stats?: AdminStats }) {
	const cards = [
		{
			detail: `${stats?.pendingReports ?? 0} pending`,
			href: "/admin/reports",
			icon: Flag,
			label: "Reports",
		},
		{
			detail: `${stats?.users ?? 0} accounts`,
			href: "/admin/people",
			icon: UsersRound,
			label: "People",
		},
		{
			detail: `${stats?.pendingReviewers ?? 0} waiting`,
			href: "/admin/reviewers",
			icon: BadgeCheck,
			label: "Reviewer Trust",
		},
		{
			detail: `${stats?.resumes ?? 0} resumes`,
			href: "/admin/content",
			icon: FileText,
			label: "Content",
		},
		{
			detail: "Moderation history",
			href: "/admin/audit",
			icon: History,
			label: "Audit Trail",
		},
		{
			detail: "Tables and deletion model",
			href: "/admin/data",
			icon: Database,
			label: "Data Control",
		},
	];

	return (
		<section className="admin-console-section">
			<PanelHeader
				description="Choose one workspace. Each page owns one job."
				title="Control Areas"
			/>
			<div className="admin-overview-grid">
				{cards.map((card) => {
					const Icon = card.icon;
					return (
						<Link className="admin-overview-card" href={card.href} key={card.href}>
							<Icon aria-hidden="true" />
							<strong>{card.label}</strong>
							<span>{card.detail}</span>
						</Link>
					);
				})}
			</div>
		</section>
	);
}

function ReportsPage({
	adminNotes,
	busyAction,
	onAction,
	onNoteChange,
	onStatusChange,
	reports,
	status,
}: {
	adminNotes: Record<string, string>;
	busyAction: string;
	onAction: (reportId: string, action: string) => Promise<void>;
	onNoteChange: (reportId: string, value: string) => void;
	onStatusChange: (value: string) => void;
	reports: ReportPreview[];
	status: ContentReportStatus;
}) {
	return (
		<section className="admin-console-section admin-critical-section">
			<PanelHeader
				description="Comment and profile reports sorted by risk signal."
				title="Moderation Queue"
			>
				<SegmentedTabs
					active={status}
					onChange={onStatusChange}
					values={reportStatuses}
				/>
			</PanelHeader>
			{reports.length ? (
				<div className="admin-table-wrap">
					<table className="admin-table">
						<thead>
							<tr>
								<th>Target</th>
								<th>Reason</th>
								<th>People</th>
								<th>Updated</th>
								<th>Note</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{reports.map((report) => (
								<ReportRow
									busyAction={busyAction}
									key={report.id}
									note={adminNotes[report.id] ?? ""}
									onAction={onAction}
									onNoteChange={(value) => onNoteChange(report.id, value)}
									report={report}
								/>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<EmptyPanel description="No reports in this status." title="Queue clear" />
			)}
		</section>
	);
}

function PeoplePage({
	activeUsers,
	busyAction,
	currentAdminUserId,
	latestUsers,
	onAction,
	onDeleteRequest,
	onMessageRequest,
	onPageChange,
	onQueryChange,
	pagination,
	query,
	users,
}: {
	activeUsers: ActiveAdminUser[];
	busyAction: string;
	currentAdminUserId: string;
	latestUsers: AdminUser[];
	onAction: (userId: string, action: string) => Promise<void>;
	onDeleteRequest: (user: AdminUser) => void;
	onMessageRequest: (target: AdminMessageDialogTarget) => void;
	onPageChange: (page: number) => void;
	onQueryChange: (value: string) => void;
	pagination: AdminUsersPagination;
	query: string;
	users: AdminUser[];
}) {
	return (
		<div className="admin-people-workspace">
			<div className="admin-people-overview-grid">
				<LatestPeoplePanel users={latestUsers} />
				<ActiveUsersPanel activeUsers={activeUsers} />
			</div>

			<section className="admin-console-section">
				<PanelHeader
					description="Search accounts, inspect footprint, and manage profile or deletion actions."
					title="People Directory"
				>
					<Button
						className="admin-panel-button"
						onClick={() => onMessageRequest({ mode: "all" })}
						type="button"
					>
						<MessageSquare aria-hidden="true" />
						Message users
					</Button>
				</PanelHeader>
				<div className="admin-people-toolbar">
					<label className="admin-search">
						<Search aria-hidden="true" />
						<input
							onChange={(event) => onQueryChange(event.target.value)}
							placeholder="Search email, username, reviewer claim, trust status"
							value={query}
						/>
					</label>
					<PeoplePagination
						onPageChange={onPageChange}
						pagination={pagination}
					/>
				</div>
				<div className="admin-table-wrap">
					<table className="admin-table admin-people-table">
						<thead>
							<tr>
								<th>User</th>
								<th>Public profile</th>
								<th>Footprint</th>
								<th>Trust</th>
								<th>Last sign in</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{users.map((adminUser) => (
								<UserRow
									adminUser={adminUser}
									busyAction={busyAction}
									currentAdminUserId={currentAdminUserId}
									key={adminUser.id}
									onAction={onAction}
									onDeleteRequest={onDeleteRequest}
									onMessageRequest={onMessageRequest}
								/>
							))}
						</tbody>
					</table>
					{!users.length ? (
						<EmptyPanel
							description="Try a different email, username, or role."
							title="No matching users"
						/>
					) : null}
				</div>
				<PeoplePagination onPageChange={onPageChange} pagination={pagination} />
			</section>
		</div>
	);
}

function formatRelativeAdminTime(value: string | null | undefined) {
	if (!value) return "Never";
	const timestamp = new Date(value).getTime();
	if (Number.isNaN(timestamp)) return "Never";

	const diff = Date.now() - timestamp;
	const minutes = Math.floor(diff / 60_000);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (minutes < 1) return "Just now";
	if (minutes < 60) return `${minutes}m ago`;
	if (hours < 24) return `${hours}h ago`;
	if (days < 7) return `${days}d ago`;

	return formatDate(value);
}

function formatAdminPresenceStatus(value: string) {
	return value
		.split(/[_\s-]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
		.join(" ");
}

function LatestPeoplePanel({ users }: { users: AdminUser[] }) {
	return (
		<section className="admin-console-section admin-people-summary-panel">
			<PanelHeader
				description="The newest profiles created in Linted."
				title="Latest 10 People"
			/>
			<div className="admin-compact-list">
				{users.map((user) => (
					<MiniUserRow
						detail={user.email ?? "No email"}
						href={`/profile/${user.id}`}
						key={user.id}
						meta={formatRelativeAdminTime(user.created_at)}
						timestamp={user.created_at ?? undefined}
						title={getProfileLabel(user.profile)}
					/>
				))}
				{!users.length ? (
					<EmptyPanel
						description="New accounts will appear here."
						title="No people yet"
					/>
				) : null}
			</div>
		</section>
	);
}

function ActiveUsersPanel({
	activeUsers,
}: {
	activeUsers: ActiveAdminUser[];
}) {
	return (
		<section className="admin-console-section admin-people-summary-panel">
			<PanelHeader
				description="Profiles seen in the last two minutes."
				title="Live Active Users"
			>
				<span className="admin-live-count">
					<Activity aria-hidden="true" />
					{activeUsers.length}
				</span>
			</PanelHeader>
			<div className="admin-compact-list">
				{activeUsers.map((user) => (
					<MiniUserRow
						detail={user.email ?? "No email"}
						href={`/profile/${user.userId}`}
						key={`${user.userId}-${user.lastSeenAt}`}
						meta={`${formatAdminPresenceStatus(user.status)} - ${formatRelativeAdminTime(user.lastSeenAt)}`}
						timestamp={user.lastSeenAt}
						title={getProfileLabel(user.profile)}
					/>
				))}
				{!activeUsers.length ? (
					<EmptyPanel
						description="Active sessions refresh automatically."
						title="No one active now"
					/>
				) : null}
			</div>
		</section>
	);
}

function MiniUserRow({
	detail,
	href,
	meta,
	timestamp,
	title,
}: {
	detail: string;
	href: string;
	meta: string;
	timestamp?: string;
	title: string;
}) {
	const initials = title
		.split(/\s+/)
		.map((part) => part[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();

	return (
		<Link className="admin-mini-user-row" href={href}>
			<span className="admin-mini-avatar">{initials || "LI"}</span>
			<span className="admin-mini-copy">
				<strong>{title}</strong>
				<small>{detail}</small>
			</span>
			<time dateTime={timestamp}>{meta}</time>
		</Link>
	);
}

function PeoplePagination({
	onPageChange,
	pagination,
}: {
	onPageChange: (page: number) => void;
	pagination: AdminUsersPagination;
}) {
	const page = pagination.page;
	const lastPage = Math.max(1, pagination.lastPage);

	return (
		<div className="admin-pagination" aria-label="People table pagination">
			<span>
				{pagination.total
					? `${pagination.from}-${pagination.to} of ${pagination.total}`
					: "0 people"}
			</span>
			<div>
				<button
					disabled={!pagination.hasPreviousPage}
					onClick={() => onPageChange(Math.max(1, page - 1))}
					type="button"
				>
					<ChevronLeft aria-hidden="true" />
					Previous
				</button>
				<b>
					Page {page} of {lastPage}
				</b>
				<button
					disabled={!pagination.hasNextPage}
					onClick={() => onPageChange(Math.min(lastPage, page + 1))}
					type="button"
				>
					Next
					<ChevronRight aria-hidden="true" />
				</button>
			</div>
		</div>
	);
}

function ReviewersPage({
	applications,
	busyAction,
	onAction,
	onStatusChange,
	status,
}: {
	applications: ReviewerApplicationPreview[];
	busyAction: string;
	onAction: (applicationId: string, action: string) => Promise<void>;
	onStatusChange: (value: string) => void;
	status: ReviewerApplicationStatus;
}) {
	return (
		<section className="admin-console-section">
			<PanelHeader
				description="Approve reviewer trust only when proof and profile match."
				title="Reviewer Trust Queue"
			>
				<SegmentedTabs
					active={status}
					onChange={onStatusChange}
					values={reviewerStatuses}
				/>
			</PanelHeader>
			{applications.length ? (
				<div className="admin-table-wrap">
					<table className="admin-table">
						<thead>
							<tr>
								<th>Applicant</th>
								<th>Claim</th>
								<th>Proof</th>
								<th>Signal</th>
								<th>Updated</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{applications.map((application) => (
								<ReviewerRow
									application={application}
									busyAction={busyAction}
									key={application.id}
									onAction={onAction}
								/>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<EmptyPanel
					description="Applications in this status will appear here."
					title="No trust applications"
				/>
			)}
		</section>
	);
}

function ContentPage({ overview }: { overview: AdminOverview | null }) {
	return (
		<section className="admin-console-section">
			<PanelHeader
				description="Newest submissions and feedback for launch monitoring."
				title="Content Watch"
			/>
			<div className="admin-content-grid">
				<RecentContentList
					items={overview?.activity.recentResumes ?? []}
					kind="resume"
				/>
				<RecentContentList
					items={
						overview?.activity.recentReviews ??
						overview?.activity.recentRoasts ??
						[]
					}
					kind="feedback"
				/>
			</div>
		</section>
	);
}

function AuditPage({ actions }: { actions: ModerationAction[] }) {
	return (
		<section className="admin-console-section">
			<PanelHeader
				description="Recent moderation actions with admin attribution."
				title="Audit Trail"
			/>
			<div className="admin-table-wrap">
				<table className="admin-table">
					<thead>
						<tr>
							<th>Action</th>
							<th>Target</th>
							<th>Admin</th>
							<th>Reason</th>
							<th>Time</th>
						</tr>
					</thead>
					<tbody>
						{actions.map((action) => (
							<ActionLogRow action={action} key={action.id} />
						))}
					</tbody>
				</table>
				{!actions.length ? (
					<EmptyPanel
						description="Actions taken from admin pages will appear here."
						title="No audit entries"
					/>
				) : null}
			</div>
		</section>
	);
}

function DataPage({ inventory }: { inventory: AdminDataInventory | null }) {
	const tables = inventory?.tables ?? [];
	const storage = inventory?.storage ?? [];
	const lifecycle = inventory?.lifecycle ?? [];

	return (
		<section className="admin-console-section">
			<PanelHeader
				description="Operational inventory for data ownership and deletion checks."
				title="Data Control"
			/>
			<div className="admin-data-grid">
				<MetricList metrics={tables} title="Tables" />
				<MetricList metrics={storage} title="Storage" />
				<MetricList metrics={lifecycle} title="User Deletion Path" />
			</div>
		</section>
	);
}

function MetricList({ metrics, title }: { metrics: DataMetric[]; title: string }) {
	return (
		<div className="admin-data-panel">
			<h3>{title}</h3>
			{metrics.map((metric) => (
				<div className="admin-data-row" key={metric.key}>
					<div>
						<strong>{metric.label}</strong>
						{metric.detail ? <span>{metric.detail}</span> : null}
					</div>
					<b>{metric.value}</b>
				</div>
			))}
			{!metrics.length ? <p className="muted-text">No data loaded.</p> : null}
		</div>
	);
}

function PanelHeader({
	children,
	description,
	title,
}: {
	children?: ReactNode;
	description: string;
	title: string;
}) {
	return (
		<div className="admin-panel-header">
			<div>
				<h2>{title}</h2>
				<p>{description}</p>
			</div>
			{children ? <div className="admin-panel-tools">{children}</div> : null}
		</div>
	);
}

function SegmentedTabs({
	active,
	onChange,
	values,
}: {
	active: string;
	onChange: (value: string) => void;
	values: string[];
}) {
	return (
		<div className="admin-tabs">
			{values.map((value) => (
				<button
					aria-pressed={active === value}
					className={active === value ? "active" : ""}
					key={value}
					onClick={() => onChange(value)}
					type="button"
				>
					{value}
				</button>
			))}
		</div>
	);
}

function ReportRow({
	busyAction,
	note,
	onAction,
	onNoteChange,
	report,
}: {
	busyAction: string;
	note: string;
	onAction: (reportId: string, action: string) => Promise<void>;
	onNoteChange: (value: string) => void;
	report: ReportPreview;
}) {
	const reportProfile = report.profile ?? report.reportedUser;
	const reportReview = report.review ?? report.roast;
	const profileActionDisabled = !reportProfile;

	return (
		<tr>
			<td>
				<div className="admin-cell-stack">
					<strong>{getTargetTitle(report)}</strong>
					<span>{report.details || "No extra details provided."}</span>
				</div>
			</td>
			<td>
				<div className="admin-chip-stack">
					<span className="admin-pill admin-pill-warn">
						{formatReason(report.reason)}
					</span>
					<span className="admin-pill">{report.report_count} reports</span>
					<span className="admin-pill">{formatTargetType(report.target_type)}</span>
				</div>
			</td>
			<td>
				<div className="admin-cell-stack">
					<span>From {getProfileLabel(report.reporter)}</span>
					<span>Against {getProfileLabel(reportProfile ?? report.reportedUser)}</span>
				</div>
			</td>
			<td>{formatDate(report.updated_at)}</td>
			<td>
				<textarea
					className="admin-note-field"
					maxLength={800}
					onChange={(event) => onNoteChange(event.target.value)}
					placeholder="Admin note"
					value={note}
				/>
			</td>
			<td>
				<div className="admin-action-row admin-action-column">
					{report.resume ? (
						<Link href={`/resume/${report.resume.id}`}>
							<ExternalLink aria-hidden="true" />
							Context
						</Link>
					) : null}
					{reportProfile ? (
						<Link href={`/profile/${reportProfile.id}`}>
							<UserRound aria-hidden="true" />
							Profile
						</Link>
					) : null}
					<ActionButton
						action="mark_report_reviewing"
						busyAction={busyAction}
						icon={<ShieldCheck aria-hidden="true" />}
						label="Reviewing"
						onClick={() => onAction(report.id, "mark_report_reviewing")}
						scope="report"
						targetId={report.id}
					/>
					<ActionButton
						action="dismiss_report"
						busyAction={busyAction}
						icon={<XCircle aria-hidden="true" />}
						label="Dismiss"
						onClick={() => onAction(report.id, "dismiss_report")}
						scope="report"
						targetId={report.id}
					/>
					<ActionButton
						action="mark_report_actioned"
						busyAction={busyAction}
						icon={<CheckCircle2 aria-hidden="true" />}
						label="Actioned"
						onClick={() => onAction(report.id, "mark_report_actioned")}
						scope="report"
						targetId={report.id}
					/>
					{reportReview ? (
						reportReview.is_deleted ? (
							<ActionButton
								action="restore_roast"
								busyAction={busyAction}
								icon={<RotateCcw aria-hidden="true" />}
								label="Restore"
								onClick={() => onAction(report.id, "restore_roast")}
								scope="report"
								targetId={report.id}
							/>
						) : (
							<ActionButton
								action="remove_roast"
								busyAction={busyAction}
								icon={<Trash2 aria-hidden="true" />}
								label="Remove comment"
								onClick={() => onAction(report.id, "remove_roast")}
								scope="report"
								targetId={report.id}
								tone="danger"
							/>
						)
					) : null}
					{report.target_type === "profile" ? (
						<>
							<ActionButton
								action="clear_public_profile_text"
								busyAction={busyAction}
								disabled={profileActionDisabled}
								icon={<Trash2 aria-hidden="true" />}
								label="Clear text"
								onClick={() => onAction(report.id, "clear_public_profile_text")}
								scope="report"
								targetId={report.id}
								tone="danger"
							/>
							<ActionButton
								action="reset_reviewer_trust"
								busyAction={busyAction}
								disabled={profileActionDisabled}
								icon={<RotateCcw aria-hidden="true" />}
								label="Reset trust"
								onClick={() => onAction(report.id, "reset_reviewer_trust")}
								scope="report"
								targetId={report.id}
							/>
							<ActionButton
								action="clear_reviewer_profile"
								busyAction={busyAction}
								disabled={profileActionDisabled}
								icon={<ShieldAlert aria-hidden="true" />}
								label="Clear reviewer"
								onClick={() => onAction(report.id, "clear_reviewer_profile")}
								scope="report"
								targetId={report.id}
								tone="danger"
							/>
						</>
					) : null}
				</div>
			</td>
		</tr>
	);
}

function ActionButton({
	action,
	busyAction,
	disabled,
	icon,
	label,
	onClick,
	scope,
	targetId,
	tone = "normal",
}: {
	action: string;
	busyAction: string;
	disabled?: boolean;
	icon?: ReactNode;
	label: string;
	onClick: () => Promise<void>;
	scope: "report" | "reviewer" | "user";
	targetId: string;
	tone?: "danger" | "normal";
}) {
	const isBusy = busyAction === `${scope}:${targetId}:${action}`;
	return (
		<button
			className={tone === "danger" ? "admin-danger-action" : undefined}
			disabled={disabled || isBusy}
			onClick={() => void onClick()}
			type="button"
		>
			{icon}
			{isBusy ? "Working..." : label}
		</button>
	);
}

function ReviewerRow({
	application,
	busyAction,
	onAction,
}: {
	application: ReviewerApplicationPreview;
	busyAction: string;
	onAction: (applicationId: string, action: string) => Promise<void>;
}) {
	const requestedType = isReviewerType(application.requested_type)
		? application.requested_type
		: "other";

	return (
		<tr>
			<td>
				<div className="admin-cell-stack">
					<strong>{getProfileLabel(application.profile)}</strong>
					<span>{application.profile?.reviewer_headline || application.note}</span>
				</div>
			</td>
			<td>
				<span className="admin-pill admin-pill-gold">
					{getReviewerTypeLabel(requestedType)}
				</span>
			</td>
			<td>
				<a
					className="admin-inline-link"
					href={application.proof_url}
					rel="noreferrer"
					target="_blank"
				>
					<ExternalLink aria-hidden="true" />
					Open proof
				</a>
			</td>
			<td>
				<div className="admin-cell-stack">
					<span>{application.profile?.helpful_votes ?? 0} lint points</span>
					<span>{application.profile?.roast_count ?? 0} reviews</span>
				</div>
			</td>
			<td>{formatDate(application.updated_at)}</td>
			<td>
				<div className="admin-action-row admin-action-column">
					<Link href={`/profile/${application.user_id}`}>Profile</Link>
					<ActionButton
						action="approve_reviewer"
						busyAction={busyAction}
						icon={<CheckCircle2 aria-hidden="true" />}
						label="Approve"
						onClick={() => onAction(application.id, "approve_reviewer")}
						scope="reviewer"
						targetId={application.id}
					/>
					<ActionButton
						action="reject_reviewer"
						busyAction={busyAction}
						icon={<XCircle aria-hidden="true" />}
						label="Reject"
						onClick={() => onAction(application.id, "reject_reviewer")}
						scope="reviewer"
						targetId={application.id}
					/>
					<ActionButton
						action="reset_reviewer"
						busyAction={busyAction}
						icon={<RotateCcw aria-hidden="true" />}
						label="Reset"
						onClick={() => onAction(application.id, "reset_reviewer")}
						scope="reviewer"
						targetId={application.id}
					/>
				</div>
			</td>
		</tr>
	);
}

function UserRow({
	adminUser,
	busyAction,
	currentAdminUserId,
	onAction,
	onDeleteRequest,
	onMessageRequest,
}: {
	adminUser: AdminUser;
	busyAction: string;
	currentAdminUserId: string;
	onAction: (userId: string, action: string) => Promise<void>;
	onDeleteRequest: (user: AdminUser) => void;
	onMessageRequest: (target: AdminMessageDialogTarget) => void;
}) {
	const profile = adminUser.profile;
	const label = profile ? getProfileLabel(profile) : adminUser.email || adminUser.id;
	const footprint = adminUser.dataFootprint;
	const isSelf = currentAdminUserId === adminUser.id;

	return (
		<tr>
			<td>
				<div className="admin-cell-stack">
					<strong>{label}</strong>
					<span>{adminUser.email ?? "No email"}</span>
				</div>
			</td>
			<td>
				<div className="admin-cell-stack">
					<span>{getProfileSecondary(profile)}</span>
					<span>{profile?.community_role ?? "candidate"}</span>
				</div>
			</td>
			<td>
				<div className="admin-cell-stack">
					<strong>{getFootprintTotal(footprint)} linked records</strong>
					<span>
						{footprint?.resumes ?? 0} resumes, {footprint?.reviews ?? 0} reviews
					</span>
					<span>
						{footprint?.votes ?? 0} votes, {footprint?.attachments ?? 0} uploads
					</span>
				</div>
			</td>
			<td>
				<span className="admin-pill">
					{profile?.reviewer_verification_status ?? "none"}
				</span>
			</td>
			<td>{formatDate(adminUser.last_sign_in_at)}</td>
			<td>
				<div className="admin-action-row admin-people-actions">
					<Link href={`/profile/${adminUser.id}`}>
						<ExternalLink aria-hidden="true" />
						Open
					</Link>
					<button
						onClick={() => onMessageRequest({ mode: "user", user: adminUser })}
						type="button"
					>
						<MessageSquare aria-hidden="true" />
						Message
					</button>
					<ActionButton
						action="reset_reviewer_trust"
						busyAction={busyAction}
						icon={<RotateCcw aria-hidden="true" />}
						label="Reset trust"
						onClick={() => onAction(adminUser.id, "reset_reviewer_trust")}
						scope="user"
						targetId={adminUser.id}
					/>
					<ActionButton
						action="clear_public_profile_text"
						busyAction={busyAction}
						icon={<Trash2 aria-hidden="true" />}
						label="Clear text"
						onClick={() => onAction(adminUser.id, "clear_public_profile_text")}
						scope="user"
						targetId={adminUser.id}
						tone="danger"
					/>
					<ActionButton
						action="clear_reviewer_profile"
						busyAction={busyAction}
						icon={<ShieldAlert aria-hidden="true" />}
						label="Clear reviewer"
						onClick={() => onAction(adminUser.id, "clear_reviewer_profile")}
						scope="user"
						targetId={adminUser.id}
						tone="danger"
					/>
					<ActionButton
						action="delete_user_account"
						busyAction={busyAction}
						disabled={isSelf}
						icon={<UserX aria-hidden="true" />}
						label="Delete user"
						onClick={() => {
							onDeleteRequest(adminUser);
							return Promise.resolve();
						}}
						scope="user"
						targetId={adminUser.id}
						tone="danger"
					/>
				</div>
			</td>
		</tr>
	);
}

function AdminMessageDialog({
	busy,
	onOpenChange,
	onSend,
	target,
}: {
	busy: boolean;
	onOpenChange: (open: boolean) => void;
	onSend: (message: AdminMessageForm) => Promise<void>;
	target: AdminMessageDialogTarget | null;
}) {
	const [form, setForm] = useState<AdminMessageForm>({
		body: "",
		customLinkHref: "",
		linkChoice: DEFAULT_ADMIN_MESSAGE_LINK,
		title: "",
	});
	const [broadcastConfirmed, setBroadcastConfirmed] = useState(false);
	const audienceLabel = getAdminMessageAudienceLabel(target);
	const titleLength = form.title.length;
	const bodyLength = form.body.length;
	const titleReady =
		form.title.trim().length > 0 &&
		form.title.trim().length <= ADMIN_MESSAGE_TITLE_MAX_LENGTH;
	const bodyReady =
		form.body.trim().length > 0 &&
		form.body.trim().length <= ADMIN_MESSAGE_BODY_MAX_LENGTH;
	const linkReady =
		form.linkChoice !== "custom" ||
		isSafeAdminMessageLink(form.customLinkHref);
	const needsBroadcastConfirmation = target?.mode === "all";
	const canSend =
		Boolean(target) &&
		titleReady &&
		bodyReady &&
		linkReady &&
		(!needsBroadcastConfirmation || broadcastConfirmed) &&
		!busy;

	useEffect(() => {
		if (!target) return;

		setForm({
			body: "",
			customLinkHref: "",
			linkChoice: DEFAULT_ADMIN_MESSAGE_LINK,
			title: "",
		});
		setBroadcastConfirmed(false);
	}, [target]);

	function applyTemplate(template: (typeof adminMessageTemplates)[number]) {
		const linkChoice = getAdminMessageLinkChoice(template.linkHref);

		setForm({
			body: template.body,
			customLinkHref: linkChoice === "custom" ? template.linkHref : "",
			linkChoice,
			title: template.title,
		});
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!canSend) return;

		await onSend(form);
	}

	return (
		<Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
			<DialogContent className="admin-message-dialog">
				<DialogHeader>
					<DialogTitle>Message users</DialogTitle>
					<DialogDescription>
						Send a system notification through the existing inbox.
					</DialogDescription>
				</DialogHeader>
				<form className="admin-message-form" onSubmit={handleSubmit}>
					<div className="admin-message-audience">
						<span>Audience</span>
						<strong title={audienceLabel}>{audienceLabel}</strong>
					</div>

					<div className="admin-message-templates" aria-label="Message templates">
						{adminMessageTemplates.map((template) => (
							<button
								key={template.id}
								onClick={() => applyTemplate(template)}
								type="button"
							>
								{template.label}
							</button>
						))}
					</div>

					<label className="admin-message-field">
						<span>
							Title <b>{titleLength}/{ADMIN_MESSAGE_TITLE_MAX_LENGTH}</b>
						</span>
						<input
							maxLength={ADMIN_MESSAGE_TITLE_MAX_LENGTH}
							onChange={(event) =>
								setForm((current) => ({
									...current,
									title: event.target.value,
								}))
							}
							value={form.title}
						/>
					</label>

					<label className="admin-message-field">
						<span>
							Message <b>{bodyLength}/{ADMIN_MESSAGE_BODY_MAX_LENGTH}</b>
						</span>
						<textarea
							maxLength={ADMIN_MESSAGE_BODY_MAX_LENGTH}
							onChange={(event) =>
								setForm((current) => ({
									...current,
									body: event.target.value,
								}))
							}
							value={form.body}
						/>
					</label>

					<label className="admin-message-field">
						<span>Link</span>
						<Select
							onValueChange={(value) =>
								setForm((current) => ({
									...current,
									linkChoice: value,
								}))
							}
							value={form.linkChoice}
						>
							<SelectTrigger className="admin-message-select">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="admin-message-select-content">
								<SelectGroup>
									{adminMessageLinkOptions.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</label>

					{form.linkChoice === "custom" ? (
						<label className="admin-message-field">
							<span>Custom path</span>
							<input
								aria-invalid={
									form.customLinkHref
										? !isSafeAdminMessageLink(form.customLinkHref)
										: undefined
								}
								onChange={(event) =>
									setForm((current) => ({
										...current,
										customLinkHref: event.target.value,
									}))
								}
								placeholder="/feed"
								value={form.customLinkHref}
							/>
						</label>
					) : null}

					{target?.mode === "all" ? (
						<label className="admin-message-confirm">
							<input
								checked={broadcastConfirmed}
								onChange={(event) =>
									setBroadcastConfirmed(event.target.checked)
								}
								type="checkbox"
							/>
							<span>Send this to all users</span>
						</label>
					) : null}

					<DialogFooter>
						<DialogClose asChild>
							<Button disabled={busy} type="button" variant="outline">
								Cancel
							</Button>
						</DialogClose>
						<Button disabled={!canSend} type="submit">
							<Send aria-hidden="true" />
							{busy ? "Sending..." : "Send"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function DeleteUserDialog({
	busy,
	onConfirm,
	onOpenChange,
	user,
}: {
	busy: boolean;
	onConfirm: () => Promise<void>;
	onOpenChange: (open: boolean) => void;
	user: AdminUser | null;
}) {
	const label =
		user?.email || getProfileLabel(user?.profile ?? null) || "this user";
	const footprintTotal = getFootprintTotal(user?.dataFootprint);

	return (
		<AlertDialog open={Boolean(user)} onOpenChange={onOpenChange}>
			<AlertDialogContent size="sm">
				<AlertDialogHeader>
					<AlertDialogTitle>Delete user?</AlertDialogTitle>
					<AlertDialogDescription>
						This will remove {label}, their account, profile, resumes, reviews,
						votes, notifications, uploads, and {footprintTotal} linked records.
						This cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						disabled={busy}
						onClick={(event) => {
							event.preventDefault();
							void onConfirm();
						}}
					>
						{busy ? "Deleting..." : "Delete user"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

function ActionLogRow({ action }: { action: ModerationAction }) {
	return (
		<tr>
			<td>
				<strong>{formatReason(action.action)}</strong>
			</td>
			<td>{formatTargetType(action.target_type)}</td>
			<td>{getProfileLabel(action.adminProfile)}</td>
			<td>{action.reason || "No note"}</td>
			<td>{formatDate(action.created_at)}</td>
		</tr>
	);
}

function RecentContentList({
	items,
	kind,
}: {
	items: Array<AdminResume | AdminReview>;
	kind: "feedback" | "resume";
}) {
	return (
		<div className="admin-content-list">
			<h3>{kind === "resume" ? "Recent resumes" : "Recent feedback"}</h3>
			{items.map((item) => {
				const href =
					kind === "resume"
						? `/resume/${item.id}`
						: `/resume/${(item as AdminReview).resume_id}`;
				const title =
					"title" in item ? item.title : (item as AdminReview).content;
				const detail =
					"status" in item
						? item.status
						: (item as AdminReview).is_deleted
							? "removed"
							: "live";

				return (
					<Link href={href} key={`${kind}-${item.id}`}>
						<strong>{title}</strong>
						<span>
							{detail} - {formatDate(item.created_at)}
						</span>
					</Link>
				);
			})}
			{!items.length ? <p className="muted-text">Nothing to show yet.</p> : null}
		</div>
	);
}

function EmptyPanel({
	description,
	title,
}: {
	description: string;
	title: string;
}) {
	return (
		<div className="admin-empty-panel">
			<strong>{title}</strong>
			<span>{description}</span>
		</div>
	);
}
