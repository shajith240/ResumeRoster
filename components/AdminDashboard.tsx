"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	BadgeCheck,
	CheckCircle2,
	ExternalLink,
	FileText,
	Flag,
	History,
	MessageSquare,
	RefreshCcw,
	RotateCcw,
	Search,
	ShieldAlert,
	ShieldCheck,
	Trash2,
	UserRound,
	UsersRound,
	XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

type AdminStats = {
	activeRoasters: number;
	openResumes: number;
	pendingReports: number;
	pendingReviewers: number;
	replies: number;
	resumes: number;
	roasts: number;
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

type AdminRoast = {
	id: string;
	resume_id: string;
	content: string;
	is_deleted?: boolean;
	created_at: string;
};

type AdminOverview = {
	activity: {
		recentResumes: AdminResume[];
		recentRoasts: AdminRoast[];
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
	roast: AdminRoast | null;
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

type AdminUser = {
	id: string;
	email: string | null;
	created_at: string | null;
	last_sign_in_at: string | null;
	profile: ProfilePreview | null;
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

function getTargetTitle(report: ReportPreview) {
	if (report.target_type === "profile") {
		return `Profile: ${getProfileLabel(report.profile ?? report.reportedUser)}`;
	}

	if (report.target_type === "roast") {
		return report.roast?.content || "Reported feedback";
	}

	return report.resume?.title || "Reported resume";
}

function getUserSearchText(user: AdminUser) {
	return [
		user.email,
		user.profile?.username,
		user.profile?.full_name,
		user.profile?.reviewer_headline,
		user.profile?.current_position,
		user.profile?.reviewer_verification_status,
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();
}

export default function AdminDashboard() {
	const { email, isAdmin, loading } = useAdminAccess();
	const [accessToken, setAccessToken] = useState("");
	const [overview, setOverview] = useState<AdminOverview | null>(null);
	const [reports, setReports] = useState<ReportPreview[]>([]);
	const [reviewerApplications, setReviewerApplications] = useState<
		ReviewerApplicationPreview[]
	>([]);
	const [users, setUsers] = useState<AdminUser[]>([]);
	const [actions, setActions] = useState<ModerationAction[]>([]);
	const [reportStatus, setReportStatus] = useState<ContentReportStatus>("pending");
	const [reviewerStatus, setReviewerStatus] =
		useState<ReviewerApplicationStatus>("pending");
	const [userQuery, setUserQuery] = useState("");
	const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
	const [busyAction, setBusyAction] = useState("");

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

		const [overviewData, reportsData, reviewerData, usersData, actionsData] =
			await Promise.all([
				fetchJson<AdminOverview>("/api/admin/overview"),
				fetchJson<{ reports: ReportPreview[] }>(
					`/api/admin/reports?status=${reportStatus}`,
				),
				fetchJson<{ applications: ReviewerApplicationPreview[] }>(
					`/api/admin/reviewers?status=${reviewerStatus}`,
				),
				fetchJson<{ users: AdminUser[] }>("/api/admin/users?limit=80"),
				fetchJson<{ actions: ModerationAction[] }>(
					"/api/admin/actions?limit=35",
				),
			]);

		setOverview(overviewData);
		setReports(reportsData.reports);
		setReviewerApplications(reviewerData.applications);
		setUsers(usersData.users);
		setActions(actionsData.actions);
	}, [accessToken, fetchJson, isAdmin, reportStatus, reviewerStatus]);

	useEffect(() => {
		void loadAdminData().catch((error) => {
			toast.error(error instanceof Error ? error.message : "Admin load failed.");
		});
	}, [loadAdminData]);

	const filteredUsers = useMemo(() => {
		const query = userQuery.trim().toLowerCase();
		if (!query) return users;
		return users.filter((user) => getUserSearchText(user).includes(query));
	}, [userQuery, users]);

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
		setBusyAction(actionKey);

		try {
			await fetchJson(`/api/admin/users/${userId}/action`, {
				body: JSON.stringify({ action }),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			});
			toast.success("Profile action saved.");
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
			<header className="admin-console-header">
				<div>
					<span className="admin-eyebrow">Linted Admin</span>
					<h1>Operations Console</h1>
					<p>{email}</p>
				</div>
				<div className="admin-header-actions">
					<a href="#reports">Reports</a>
					<a href="#people">People</a>
					<a href="#audit">Audit</a>
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
					value={stats?.roasts ?? 0}
				/>
				<MetricCard
					icon={<UserRound aria-hidden="true" />}
					label="Active now"
					value={stats?.activeRoasters ?? 0}
				/>
			</section>

			<div className="admin-console-layout">
				<nav className="admin-section-nav" aria-label="Admin sections">
					<a href="#reports">
						<Flag aria-hidden="true" />
						Reports
					</a>
					<a href="#people">
						<UsersRound aria-hidden="true" />
						People
					</a>
					<a href="#reviewers">
						<BadgeCheck aria-hidden="true" />
						Reviewer trust
					</a>
					<a href="#content">
						<FileText aria-hidden="true" />
						Content watch
					</a>
					<a href="#audit">
						<History aria-hidden="true" />
						Audit trail
					</a>
				</nav>

				<div className="admin-console-main">
					<section className="admin-console-section admin-critical-section" id="reports">
						<PanelHeader
							description="Comment and profile reports sorted by risk signal."
							title="Moderation Queue"
						>
							<SegmentedTabs
								active={reportStatus}
								onChange={(value) =>
									setReportStatus(value as ContentReportStatus)
								}
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
												onAction={runReportAction}
												onNoteChange={(value) =>
													setAdminNotes((current) => ({
														...current,
														[report.id]: value,
													}))
												}
												report={report}
											/>
										))}
									</tbody>
								</table>
							</div>
						) : (
							<EmptyPanel
								description="No reports in this status."
								title="Queue clear"
							/>
						)}
					</section>

					<section className="admin-console-section" id="people">
						<PanelHeader
							description="Find users, inspect public identity, and fix profile-level issues."
							title="People Control"
						/>
						<label className="admin-search">
							<Search aria-hidden="true" />
							<input
								onChange={(event) => setUserQuery(event.target.value)}
								placeholder="Search email, username, reviewer claim, trust status"
								value={userQuery}
							/>
						</label>
						<div className="admin-table-wrap">
							<table className="admin-table admin-people-table">
								<thead>
									<tr>
										<th>User</th>
										<th>Public profile</th>
										<th>Trust</th>
										<th>Signal</th>
										<th>Last sign in</th>
										<th>Actions</th>
									</tr>
								</thead>
								<tbody>
									{filteredUsers.slice(0, 16).map((adminUser) => (
										<UserRow
											adminUser={adminUser}
											busyAction={busyAction}
											key={adminUser.id}
											onAction={runUserAction}
										/>
									))}
								</tbody>
							</table>
							{!filteredUsers.length ? (
								<EmptyPanel
									description="Try a different email, username, or role."
									title="No matching users"
								/>
							) : null}
						</div>
					</section>

					<section className="admin-console-section" id="reviewers">
						<PanelHeader
							description="Approve reviewer trust only when proof and profile match."
							title="Reviewer Trust Queue"
						>
							<SegmentedTabs
								active={reviewerStatus}
								onChange={(value) =>
									setReviewerStatus(value as ReviewerApplicationStatus)
								}
								values={reviewerStatuses}
							/>
						</PanelHeader>
						{reviewerApplications.length ? (
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
										{reviewerApplications.map((application) => (
											<ReviewerRow
												application={application}
												busyAction={busyAction}
												key={application.id}
												onAction={runReviewerAction}
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

					<section className="admin-console-section" id="content">
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
								items={overview?.activity.recentRoasts ?? []}
								kind="feedback"
							/>
						</div>
					</section>

					<section className="admin-console-section" id="audit">
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
									description="Actions taken from this console will appear here."
									title="No audit entries"
								/>
							) : null}
						</div>
					</section>
				</div>
			</div>
		</main>
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
					<span className="admin-pill">{report.target_type}</span>
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
						reportId={report.id}
					/>
					<ActionButton
						action="dismiss_report"
						busyAction={busyAction}
						icon={<XCircle aria-hidden="true" />}
						label="Dismiss"
						onClick={() => onAction(report.id, "dismiss_report")}
						reportId={report.id}
					/>
					<ActionButton
						action="mark_report_actioned"
						busyAction={busyAction}
						icon={<CheckCircle2 aria-hidden="true" />}
						label="Actioned"
						onClick={() => onAction(report.id, "mark_report_actioned")}
						reportId={report.id}
					/>
					{report.roast ? (
						report.roast.is_deleted ? (
							<ActionButton
								action="restore_roast"
								busyAction={busyAction}
								icon={<RotateCcw aria-hidden="true" />}
								label="Restore"
								onClick={() => onAction(report.id, "restore_roast")}
								reportId={report.id}
							/>
						) : (
							<ActionButton
								action="remove_roast"
								busyAction={busyAction}
								icon={<Trash2 aria-hidden="true" />}
								label="Remove comment"
								onClick={() => onAction(report.id, "remove_roast")}
								reportId={report.id}
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
								reportId={report.id}
								tone="danger"
							/>
							<ActionButton
								action="reset_reviewer_trust"
								busyAction={busyAction}
								disabled={profileActionDisabled}
								icon={<RotateCcw aria-hidden="true" />}
								label="Reset trust"
								onClick={() => onAction(report.id, "reset_reviewer_trust")}
								reportId={report.id}
							/>
							<ActionButton
								action="clear_reviewer_profile"
								busyAction={busyAction}
								disabled={profileActionDisabled}
								icon={<ShieldAlert aria-hidden="true" />}
								label="Clear reviewer"
								onClick={() => onAction(report.id, "clear_reviewer_profile")}
								reportId={report.id}
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
	reportId,
	tone = "normal",
}: {
	action: string;
	busyAction: string;
	disabled?: boolean;
	icon?: ReactNode;
	label: string;
	onClick: () => Promise<void>;
	reportId: string;
	tone?: "danger" | "normal";
}) {
	const isBusy = busyAction === `report:${reportId}:${action}`;
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
				<a className="admin-inline-link" href={application.proof_url} rel="noreferrer" target="_blank">
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
					<button
						disabled={busyAction === `reviewer:${application.id}:approve_reviewer`}
						onClick={() => void onAction(application.id, "approve_reviewer")}
						type="button"
					>
						<CheckCircle2 aria-hidden="true" />
						Approve
					</button>
					<button
						disabled={busyAction === `reviewer:${application.id}:reject_reviewer`}
						onClick={() => void onAction(application.id, "reject_reviewer")}
						type="button"
					>
						<XCircle aria-hidden="true" />
						Reject
					</button>
					<button
						disabled={busyAction === `reviewer:${application.id}:reset_reviewer`}
						onClick={() => void onAction(application.id, "reset_reviewer")}
						type="button"
					>
						<RotateCcw aria-hidden="true" />
						Reset
					</button>
				</div>
			</td>
		</tr>
	);
}

function UserRow({
	adminUser,
	busyAction,
	onAction,
}: {
	adminUser: AdminUser;
	busyAction: string;
	onAction: (userId: string, action: string) => Promise<void>;
}) {
	const profile = adminUser.profile;
	const label = profile ? getProfileLabel(profile) : adminUser.email || adminUser.id;

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
				<span className="admin-pill">
					{profile?.reviewer_verification_status ?? "none"}
				</span>
			</td>
			<td>
				<div className="admin-cell-stack">
					<span>{profile?.helpful_votes ?? 0} lint points</span>
					<span>{profile?.roast_count ?? 0} reviews</span>
				</div>
			</td>
			<td>{formatDate(adminUser.last_sign_in_at)}</td>
			<td>
				<div className="admin-action-row admin-action-column">
					<Link href={`/profile/${adminUser.id}`}>
						<ExternalLink aria-hidden="true" />
						Open
					</Link>
					<button
						disabled={busyAction === `user:${adminUser.id}:reset_reviewer_trust`}
						onClick={() => void onAction(adminUser.id, "reset_reviewer_trust")}
						type="button"
					>
						<RotateCcw aria-hidden="true" />
						Reset trust
					</button>
					<button
						className="admin-danger-action"
						disabled={busyAction === `user:${adminUser.id}:clear_public_profile_text`}
						onClick={() => void onAction(adminUser.id, "clear_public_profile_text")}
						type="button"
					>
						<Trash2 aria-hidden="true" />
						Clear text
					</button>
				</div>
			</td>
		</tr>
	);
}

function ActionLogRow({ action }: { action: ModerationAction }) {
	return (
		<tr>
			<td>
				<strong>{formatReason(action.action)}</strong>
			</td>
			<td>{action.target_type}</td>
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
	items: Array<AdminResume | AdminRoast>;
	kind: "feedback" | "resume";
}) {
	return (
		<div className="admin-content-list">
			<h3>{kind === "resume" ? "Recent resumes" : "Recent feedback"}</h3>
			{items.map((item) => {
				const href =
					kind === "resume"
						? `/resume/${item.id}`
						: `/resume/${(item as AdminRoast).resume_id}`;
				const title =
					"title" in item ? item.title : (item as AdminRoast).content;
				const detail =
					"status" in item
						? item.status
						: (item as AdminRoast).is_deleted
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
