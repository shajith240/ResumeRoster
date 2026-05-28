"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAdminAccess } from "@/lib/use-admin-access";
import type { ContentReportStatus } from "@/lib/supabase/types";
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
	resume: AdminResume | null;
	roast: AdminRoast | null;
	status: ContentReportStatus;
	target_type: "resume" | "roast";
	updated_at: string;
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

function formatDate(value: string) {
	return new Intl.DateTimeFormat("en", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function getProfileLabel(profile: ProfilePreview | null) {
	if (!profile) return "Unknown";
	return profile.username || profile.full_name || profile.id.slice(0, 8);
}

export default function AdminDashboard() {
	const { email, isAdmin, loading } = useAdminAccess();
	const [accessToken, setAccessToken] = useState("");
	const [overview, setOverview] = useState<AdminOverview | null>(null);
	const [reports, setReports] = useState<ReportPreview[]>([]);
	const [reviewerApplications, setReviewerApplications] = useState<
		ReviewerApplicationPreview[]
	>([]);
	const [reportStatus, setReportStatus] = useState<ContentReportStatus>("pending");
	const [reviewerStatus, setReviewerStatus] =
		useState<ReviewerApplicationStatus>("pending");

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

		const [overviewData, reportsData, reviewerData] = await Promise.all([
			fetchJson<AdminOverview>("/api/admin/overview"),
			fetchJson<{ reports: ReportPreview[] }>(
				`/api/admin/reports?status=${reportStatus}`,
			),
			fetchJson<{ applications: ReviewerApplicationPreview[] }>(
				`/api/admin/reviewers?status=${reviewerStatus}`,
			),
		]);

		setOverview(overviewData);
		setReports(reportsData.reports);
		setReviewerApplications(reviewerData.applications);
	}, [accessToken, fetchJson, isAdmin, reportStatus, reviewerStatus]);

	useEffect(() => {
		void loadAdminData().catch((error) => {
			toast.error(error instanceof Error ? error.message : "Admin load failed.");
		});
	}, [loadAdminData]);

	async function runReportAction(reportId: string, action: string) {
		try {
			await fetchJson(`/api/admin/reports/${reportId}/action`, {
				body: JSON.stringify({ action }),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			});
			toast.success("Moderation action saved.");
			await loadAdminData();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Action failed.");
		}
	}

	async function runReviewerAction(applicationId: string, action: string) {
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

	return (
		<main className="admin-route page-enter">
			<header className="admin-header">
				<div>
					<span>Admin</span>
					<h1>Moderation dashboard</h1>
					<p>Signed in as {email}</p>
				</div>
				<button className="btn-primary" onClick={() => void loadAdminData()} type="button">
					Refresh
				</button>
			</header>

			<section className="admin-stat-grid" aria-label="Site overview">
				{overview
					? Object.entries({
							Users: overview.stats.users,
							Resumes: overview.stats.resumes,
							"Open resumes": overview.stats.openResumes,
							Roasts: overview.stats.roasts,
							Replies: overview.stats.replies,
							"Pending reports": overview.stats.pendingReports,
							"Reviewer apps": overview.stats.pendingReviewers,
							"Active roasters": overview.stats.activeRoasters,
						}).map(([label, value]) => (
							<div className="admin-stat" key={label}>
								<strong>{value}</strong>
								<span>{label}</span>
							</div>
						))
					: null}
			</section>

			<section className="admin-panel">
				<div className="admin-panel-header">
					<div>
						<h2>Reviewer applications</h2>
						<p>Approve trust labels only when the proof and profile make sense.</p>
					</div>
					<div className="admin-tabs">
						{reviewerStatuses.map((status) => (
							<button
								className={reviewerStatus === status ? "active" : ""}
								key={status}
								onClick={() => setReviewerStatus(status)}
								type="button"
							>
								{status}
							</button>
						))}
					</div>
				</div>
				<div className="admin-report-list">
					{reviewerApplications.map((application) => (
						<article className="admin-report" key={application.id}>
							<div>
								<span className="badge neutral-badge">
									{getReviewerTypeLabel(
										isReviewerType(application.requested_type)
											? application.requested_type
											: "other",
									)}
								</span>
								<span className="badge role-badge">{application.status}</span>
							</div>
							<h3>{getProfileLabel(application.profile)}</h3>
							<p>{application.profile?.reviewer_headline || application.note}</p>
							<dl>
								<div>
									<dt>Helpful votes</dt>
									<dd>{application.profile?.helpful_votes ?? 0}</dd>
								</div>
								<div>
									<dt>Roasts</dt>
									<dd>{application.profile?.roast_count ?? 0}</dd>
								</div>
								<div>
									<dt>Updated</dt>
									<dd>{formatDate(application.updated_at)}</dd>
								</div>
							</dl>
							{application.expertise.length ? (
								<p>{application.expertise.join(", ")}</p>
							) : null}
							<div className="admin-action-row">
								<Link href={`/profile/${application.user_id}`}>Open profile</Link>
								<a href={application.proof_url} rel="noreferrer" target="_blank">
									Open proof
								</a>
								<button
									onClick={() =>
										void runReviewerAction(application.id, "approve_reviewer")
									}
									type="button"
								>
									Approve trust
								</button>
								<button
									onClick={() =>
										void runReviewerAction(application.id, "reject_reviewer")
									}
									type="button"
								>
									Reject
								</button>
								<button
									onClick={() =>
										void runReviewerAction(application.id, "reset_reviewer")
									}
									type="button"
								>
									Reset pending
								</button>
							</div>
						</article>
					))}
					{!reviewerApplications.length ? (
						<p className="muted-text">No reviewer applications in this queue.</p>
					) : null}
				</div>
			</section>

			<section className="admin-panel">
				<div className="admin-panel-header">
					<div>
						<h2>Reports queue</h2>
						<p>Review the highest-signal reports first.</p>
					</div>
					<div className="admin-tabs">
						{reportStatuses.map((status) => (
							<button
								className={reportStatus === status ? "active" : ""}
								key={status}
								onClick={() => setReportStatus(status)}
								type="button"
							>
								{status}
							</button>
						))}
					</div>
				</div>
				<div className="admin-report-list">
					{reports.map((report) => (
						<article className="admin-report" key={report.id}>
							<div>
								<span className="badge neutral-badge">
									{report.reason.replaceAll("_", " ")}
								</span>
								<span className="badge role-badge">{report.report_count} reports</span>
							</div>
							<h3>
								{report.target_type === "roast"
									? report.roast?.content || "Reported roast"
									: report.resume?.title || "Reported resume"}
							</h3>
							<p>{report.details || "No extra details provided."}</p>
							<dl>
								<div>
									<dt>Reporter</dt>
									<dd>{getProfileLabel(report.reporter)}</dd>
								</div>
								<div>
									<dt>Reported</dt>
									<dd>{getProfileLabel(report.reportedUser)}</dd>
								</div>
								<div>
									<dt>Updated</dt>
									<dd>{formatDate(report.updated_at)}</dd>
								</div>
							</dl>
							<div className="admin-action-row">
								{report.resume ? (
									<Link href={`/resume/${report.resume.id}`}>Open context</Link>
								) : null}
								<button onClick={() => void runReportAction(report.id, "dismiss_report")} type="button">
									Dismiss
								</button>
								<button onClick={() => void runReportAction(report.id, "mark_report_reviewing")} type="button">
									Reviewing
								</button>
								<button onClick={() => void runReportAction(report.id, "mark_report_actioned")} type="button">
									Actioned
								</button>
								{report.roast ? (
									report.roast.is_deleted ? (
										<button onClick={() => void runReportAction(report.id, "restore_roast")} type="button">
											Restore roast
										</button>
									) : (
										<button onClick={() => void runReportAction(report.id, "remove_roast")} type="button">
											Remove roast
										</button>
									)
								) : null}
								{report.resume ? (
									<>
										<button onClick={() => void runReportAction(report.id, "close_resume")} type="button">
											Close resume
										</button>
										<button onClick={() => void runReportAction(report.id, "reopen_resume")} type="button">
											Reopen resume
										</button>
									</>
								) : null}
							</div>
						</article>
					))}
					{!reports.length ? <p className="muted-text">No reports in this queue.</p> : null}
				</div>
			</section>

			<section className="admin-grid">
				<div className="admin-panel">
					<div className="admin-panel-header">
						<div>
							<h2>Recent activity</h2>
							<p>Useful context without tracking unnecessary private data.</p>
						</div>
					</div>
					<div className="admin-activity-list">
						{overview?.activity.recentResumes.map((resume) => (
							<Link href={`/resume/${resume.id}`} key={resume.id}>
								<strong>{resume.title}</strong>
								<span>{resume.status} · {formatDate(resume.created_at)}</span>
							</Link>
						))}
						{overview?.activity.recentRoasts.map((roast) => (
							<Link href={`/resume/${roast.resume_id}`} key={roast.id}>
								<strong>{roast.content}</strong>
								<span>{roast.is_deleted ? "removed" : "live"} · {formatDate(roast.created_at)}</span>
							</Link>
						))}
					</div>
				</div>
			</section>
		</main>
	);
}
