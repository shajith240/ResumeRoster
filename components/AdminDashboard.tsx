"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	BadgeCheck,
	FileText,
	Flag,
	MessageSquare,
	RefreshCcw,
	ShieldAlert,
	ShieldCheck,
	UserRound,
	UsersRound,
} from "@/components/ui/solar-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DEFAULT_ADMIN_MESSAGE_LINK } from "@/lib/admin-messages";
import { supabase } from "@/lib/supabase/client";
import type { ContentReportStatus } from "@/lib/supabase/types";
import { useAdminAccess } from "@/lib/use-admin-access";
import type { ReviewerApplicationStatus } from "@/lib/reviewer-validation";
import { adminSections } from "./admin-dashboard/constants";
import { ContentPage } from "./admin-dashboard/content";
import { DataPage } from "./admin-dashboard/data";
import {
	AdminMessageDialog,
	DeleteUserDialog,
} from "./admin-dashboard/dialogs";
import { FeedbackPage } from "./admin-dashboard/feedback";
import {
	AuditPage,
	ReportsPage,
	ReviewersPage,
} from "./admin-dashboard/moderation";
import { AdminSectionNav } from "./admin-dashboard/navigation";
import { MetricCard, OverviewPage } from "./admin-dashboard/overview";
import { PeoplePage } from "./admin-dashboard/people";
import { PremiumPage, type AdminPayoutsData, type AdminPremiumResumesData, type AdminFailedRefund } from "./admin-dashboard/premium";
import { type SuspendedReviewer } from "./admin-dashboard/moderation";
import type {
	ActiveAdminUser,
	AdminDashboardView,
	AdminDataInventory,
	AdminMessageDialogTarget,
	AdminMessageForm,
	AdminMessageResponse,
	AdminFeedbackResponse,
	AdminOverview,
	AdminUser,
	AdminUsersPagination,
	AdminUsersResponse,
	ModerationAction,
	ReportPreview,
	ReviewerApplicationPreview,
	UserFeedbackPreview,
} from "./admin-dashboard/types";

export type { AdminDashboardView } from "./admin-dashboard/types";

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
	const [feedback, setFeedback] = useState<UserFeedbackPreview[]>([]);
	const [feedbackStatusCounts, setFeedbackStatusCounts] = useState<
		Record<string, number>
	>({});
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
	const [dataInventory, setDataInventory] = useState<AdminDataInventory | null>(null);
	const [payoutsData, setPayoutsData] = useState<AdminPayoutsData | null>(null);
	const [payoutStatus, setPayoutStatus] = useState("pending");
	const [premiumResumesData, setPremiumResumesData] = useState<AdminPremiumResumesData | null>(null);
	const [failedRefunds, setFailedRefunds] = useState<AdminFailedRefund[]>([]);
	const [suspendedReviewers, setSuspendedReviewers] = useState<SuspendedReviewer[]>([]);
	const [resumeFilter, setResumeFilter] = useState("all");
	const [reportStatus, setReportStatus] =
		useState<ContentReportStatus>("pending");
	const [feedbackStatus, setFeedbackStatus] = useState("open");
	const [feedbackCategory, setFeedbackCategory] = useState("all");
	const [feedbackPriority, setFeedbackPriority] = useState("all");
	const [reviewerStatus, setReviewerStatus] =
		useState<ReviewerApplicationStatus>("pending");
	const [userQuery, setUserQuery] = useState("");
	const [peoplePage, setPeoplePage] = useState(1);
	const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
	const [feedbackNotes, setFeedbackNotes] = useState<Record<string, string>>(
		{},
	);
	const [feedbackReplies, setFeedbackReplies] = useState<
		Record<string, string>
	>({});
	const [feedbackPriorities, setFeedbackPriorities] = useState<
		Record<string, string>
	>({});
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

	const loadAdminData = useCallback(
		async function loadAdminData() {
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
					if (view === "feedback") {
						const params = new URLSearchParams({
							category: feedbackCategory,
							limit: "100",
							priority: feedbackPriority,
							status: feedbackStatus,
						});
						return fetchJson<AdminFeedbackResponse>(
							`/api/admin/feedback?${params.toString()}`,
						);
					}
					if (view === "reviewers") {
						return Promise.all([
							fetchJson<{ applications: ReviewerApplicationPreview[] }>(
								`/api/admin/reviewers?status=${reviewerStatus}&limit=100`,
							),
							fetchJson<{ reviewers: SuspendedReviewer[] }>("/api/admin/suspended-reviewers"),
						]).then(([applicationsResult, suspendedResult]) => ({ applicationsResult, suspendedResult }));
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
					if (view === "premium") {
						return Promise.all([
							fetchJson<AdminPayoutsData>(`/api/admin/payouts?status=${payoutStatus}&limit=200`),
							fetchJson<AdminPremiumResumesData>(
								`/api/admin/premium-resumes?payment_status=${resumeFilter}&limit=100`,
							),
							fetchJson<{ failed: AdminFailedRefund[] }>("/api/admin/failed-refunds"),
						]).then(([payoutsResult, resumesResult, failedResult]) => ({ payoutsResult, resumesResult, failedResult }));
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
				if (view === "feedback") {
					const feedbackData = sectionData as AdminFeedbackResponse | null;
					setFeedback(feedbackData?.feedback ?? []);
					setFeedbackStatusCounts(feedbackData?.statusCounts ?? {});
				}
				if (view === "reviewers") {
					const reviewerData = sectionData as { applicationsResult: { applications: ReviewerApplicationPreview[] }; suspendedResult: { reviewers: SuspendedReviewer[] } } | null;
					setReviewerApplications(reviewerData?.applicationsResult?.applications ?? []);
					setSuspendedReviewers(reviewerData?.suspendedResult?.reviewers ?? []);
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
				if (view === "premium") {
					const premiumData = sectionData as { payoutsResult: AdminPayoutsData; resumesResult: AdminPremiumResumesData; failedResult: { failed: AdminFailedRefund[] } } | null;
					setPayoutsData(premiumData?.payoutsResult ?? null);
					setPremiumResumesData(premiumData?.resumesResult ?? null);
					setFailedRefunds(premiumData?.failedResult?.failed ?? []);
				}
			} finally {
				setPageLoading(false);
			}
		},
		[
			accessToken,
			fetchJson,
			feedbackCategory,
			feedbackPriority,
			feedbackStatus,
			isAdmin,
			payoutStatus,
			peoplePage,
			reportStatus,
			resumeFilter,
			reviewerStatus,
			userQuery,
			view,
		],
	);

	useEffect(() => {
		void loadAdminData().catch((error) => {
			toast.error(
				error instanceof Error ? error.message : "Admin load failed.",
			);
		});
	}, [loadAdminData]);

	useEffect(() => {
		if (view !== "people" || !accessToken || !isAdmin) return;

		const timer = window.setInterval(() => {
			void loadAdminData().catch((error) => {
				toast.error(
					error instanceof Error ? error.message : "Admin refresh failed.",
				);
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

	async function runFeedbackAction(
		ticket: UserFeedbackPreview,
		action: string,
		payload: Record<string, string> = {},
	) {
		const actionKey = `feedback:${ticket.id}:${action}`;
		setBusyAction(actionKey);

		try {
			await fetchJson(`/api/admin/feedback/${ticket.id}/action`, {
				body: JSON.stringify({
					action,
					...payload,
				}),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			});
			toast.success(
				action === "reply_feedback_ticket"
					? "Reply sent to user."
					: "Feedback action saved.",
			);
			if (action === "reply_feedback_ticket") {
				setFeedbackReplies((current) => ({ ...current, [ticket.id]: "" }));
			}
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
						requestId: message.requestId,
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
			toast.success(
				`Message sent to ${response.delivered} users.${skippedText}`,
			);
			setMessageTarget(null);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Message failed.");
		} finally {
			setMessageSending(false);
		}
	}

	async function runPayoutAction(payoutId: string, payoutRef: string) {
		const actionKey = `payout:${payoutId}:mark_paid`;
		setBusyAction(actionKey);
		try {
			await fetchJson(`/api/admin/payouts/${payoutId}`, {
				body: JSON.stringify({ payoutRef }),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			});
			toast.success("Payout marked as paid.");
			await loadAdminData();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Action failed.");
		} finally {
			setBusyAction("");
		}
	}

	async function runPremiumResumeAction(resumeId: string, action: string, extra?: Record<string, string>) {
		const actionKey = `premium:${resumeId}:${action}`;
		setBusyAction(actionKey);
		try {
			await fetchJson(`/api/admin/premium-resumes/${resumeId}`, {
				body: JSON.stringify({ action, ...extra }),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			});
			toast.success(action === "force_refund" ? "Refund issued." : "Reviewer assigned.");
			await loadAdminData();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Action failed.");
		} finally {
			setBusyAction("");
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
		return (
			<main className="admin-route page-enter">Checking admin access...</main>
		);
	}

	if (!isAdmin) {
		return (
			<main className="admin-route page-enter">
				<section className="admin-access-card">
					<ShieldCheck size={28} strokeWidth={2} aria-hidden="true" />
					<h1>Admin access required</h1>
					<p>This area is limited to emails listed in ADMIN_EMAILS.</p>
					<Link className="btn-primary" href={DEFAULT_ADMIN_MESSAGE_LINK}>
						Return to app
					</Link>
				</section>
			</main>
		);
	}

	const stats = overview?.stats;
	const attentionCount =
		(stats?.pendingReports ?? 0) +
		(stats?.pendingReviewers ?? 0) +
		(stats?.feedbackOpen ?? 0);

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
					icon={<MessageSquare aria-hidden="true" />}
					label="Open feedback"
					tone={stats?.feedbackOpen ? "danger" : "normal"}
					value={stats?.feedbackOpen ?? 0}
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
					{view === "overview" ? <OverviewPage stats={stats} /> : null}
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
					{view === "feedback" ? (
						<FeedbackPage
							busyAction={busyAction}
							category={feedbackCategory}
							feedback={feedback}
							notes={feedbackNotes}
							onAction={runFeedbackAction}
							onCategoryChange={setFeedbackCategory}
							onNoteChange={(ticketId, value) =>
								setFeedbackNotes((current) => ({
									...current,
									[ticketId]: value,
								}))
							}
							onPriorityChange={(ticketId, value) =>
								setFeedbackPriorities((current) => ({
									...current,
									[ticketId]: value,
								}))
							}
							onPriorityFilterChange={setFeedbackPriority}
							onReplyChange={(ticketId, value) =>
								setFeedbackReplies((current) => ({
									...current,
									[ticketId]: value,
								}))
							}
							onStatusChange={setFeedbackStatus}
							priority={feedbackPriority}
							priorityDrafts={feedbackPriorities}
							replies={feedbackReplies}
							status={feedbackStatus}
							statusCounts={feedbackStatusCounts}
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
							onUnsuspend={(userId) => runUserAction(userId, "unsuspend_reviewer")}
							status={reviewerStatus}
							suspendedReviewers={suspendedReviewers}
						/>
					) : null}
					{view === "content" ? <ContentPage overview={overview} /> : null}
					{view === "audit" ? <AuditPage actions={actions} /> : null}
					{view === "data" ? <DataPage inventory={dataInventory} /> : null}
					{view === "premium" ? (
						<PremiumPage
							busyAction={busyAction}
							failedRefunds={failedRefunds}
							onMarkPaid={runPayoutAction}
							onPayoutStatusChange={(value) => setPayoutStatus(value)}
							onPremiumResumeAction={runPremiumResumeAction}
							onResumeFilterChange={(value) => setResumeFilter(value)}
							payoutsData={payoutsData}
							payoutStatus={payoutStatus}
							premiumResumesData={premiumResumesData}
							resumeFilter={resumeFilter}
						/>
					) : null}
				</div>
			</div>
			<DeleteUserDialog
				busy={Boolean(
					deleteTarget &&
					busyAction === `user:${deleteTarget.id}:delete_user_account`,
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
