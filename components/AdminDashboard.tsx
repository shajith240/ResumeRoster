"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, UploadCloud } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAdminAccess } from "@/lib/use-admin-access";
import type { ContentReportStatus, Sticker } from "@/lib/supabase/types";

type AdminStats = {
	activeRoasters: number;
	openResumes: number;
	pendingReports: number;
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

type AdminSticker = Sticker & {
	publicUrl: string;
};

const reportStatuses: ContentReportStatus[] = [
	"pending",
	"reviewing",
	"actioned",
	"dismissed",
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
	const [stickers, setStickers] = useState<AdminSticker[]>([]);
	const [reportStatus, setReportStatus] = useState<ContentReportStatus>("pending");
	const [uploading, setUploading] = useState(false);
	const [dragging, setDragging] = useState(false);
	const [stickerTitle, setStickerTitle] = useState("");
	const [stickerAlt, setStickerAlt] = useState("");

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

		const [overviewData, reportsData, stickersData] = await Promise.all([
			fetchJson<AdminOverview>("/api/admin/overview"),
			fetchJson<{ reports: ReportPreview[] }>(
				`/api/admin/reports?status=${reportStatus}`,
			),
			fetchJson<{ stickers: AdminSticker[] }>("/api/admin/stickers"),
		]);

		setOverview(overviewData);
		setReports(reportsData.reports);
		setStickers(stickersData.stickers);
	}, [accessToken, fetchJson, isAdmin, reportStatus]);

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

	async function uploadSticker(file: File) {
		if (!file) return;
		setUploading(true);

		const formData = new FormData();
		formData.append("file", file);
		formData.append("title", stickerTitle);
		formData.append("altText", stickerAlt);

		try {
			await fetchJson("/api/admin/stickers", {
				body: formData,
				method: "POST",
			});
			toast.success("Sticker uploaded.");
			setStickerTitle("");
			setStickerAlt("");
			await loadAdminData();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Upload failed.");
		} finally {
			setUploading(false);
		}
	}

	async function updateStickerStatus(sticker: AdminSticker) {
		const nextStatus = sticker.status === "active" ? "hidden" : "active";

		try {
			await fetchJson(`/api/admin/stickers/${sticker.id}`, {
				body: JSON.stringify({ status: nextStatus }),
				headers: { "Content-Type": "application/json" },
				method: "PATCH",
			});
			toast.success(nextStatus === "active" ? "Sticker shown." : "Sticker hidden.");
			await loadAdminData();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Sticker update failed.");
		}
	}

	async function deleteSticker(sticker: AdminSticker) {
		try {
			await fetchJson(`/api/admin/stickers/${sticker.id}`, {
				method: "DELETE",
			});
			toast.success("Unused sticker deleted.");
			await loadAdminData();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Sticker delete failed.");
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

				<div className="admin-panel">
					<div className="admin-panel-header">
						<div>
							<h2>Stickers</h2>
							<p>Drag a PNG, WebP, or GIF under 2MB.</p>
						</div>
					</div>
					<label
						className={`admin-sticker-dropzone ${dragging ? "is-dragging" : ""}`}
						onDragEnter={(event) => {
							event.preventDefault();
							setDragging(true);
						}}
						onDragOver={(event) => event.preventDefault()}
						onDragLeave={() => setDragging(false)}
						onDrop={(event) => {
							event.preventDefault();
							setDragging(false);
							const file = event.dataTransfer.files[0];
							if (file) void uploadSticker(file);
						}}
					>
						<UploadCloud size={24} strokeWidth={2} aria-hidden="true" />
						<span>{uploading ? "Uploading..." : "Drop sticker or click to upload"}</span>
						<input
							accept="image/png,image/webp,image/gif"
							disabled={uploading}
							onChange={(event) => {
								const file = event.target.files?.[0];
								if (file) void uploadSticker(file);
								event.currentTarget.value = "";
							}}
							type="file"
						/>
					</label>
					<div className="admin-sticker-fields">
						<input
							onChange={(event) => setStickerTitle(event.target.value)}
							placeholder="Sticker title"
							value={stickerTitle}
						/>
						<input
							onChange={(event) => setStickerAlt(event.target.value)}
							placeholder="Alt text"
							value={stickerAlt}
						/>
					</div>
					<div className="admin-sticker-list">
						{stickers.map((sticker) => (
							<article key={sticker.id}>
								<img alt={sticker.alt_text || sticker.title} src={sticker.publicUrl} />
								<div>
									<strong>{sticker.title}</strong>
									<span>{sticker.status}</span>
								</div>
								<button onClick={() => void updateStickerStatus(sticker)} type="button">
									{sticker.status === "active" ? "Hide" : "Show"}
								</button>
								<button onClick={() => void deleteSticker(sticker)} type="button">
									Delete unused
								</button>
							</article>
						))}
					</div>
				</div>
			</section>
		</main>
	);
}
