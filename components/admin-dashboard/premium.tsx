"use client";

import { useState } from "react";
import { EmptyPanel, PanelHeader, SegmentedTabs } from "./shared";

// ─── Payout types ──────────────────────────────────────────────────────────

type PayoutRow = {
	id: string;
	reviewer_id: string;
	resume_id: string | null;
	amount_paise: number;
	status: string;
	payout_ref: string | null;
	paid_at: string | null;
	created_at: string;
};

type ReviewerPayoutGroup = {
	reviewer_id: string;
	profile: {
		id: string;
		username: string | null;
		full_name: string | null;
		avatar_url: string | null;
	} | null;
	total_paise: number;
	payout_count: number;
	payouts: PayoutRow[];
};

export type AdminPayoutsData = {
	reviewers: ReviewerPayoutGroup[];
	total_paise: number;
	status: string;
};

// ─── Premium resume types ───────────────────────────────────────────────────

type ProfilePreview = {
	id: string;
	username: string | null;
	full_name: string | null;
};

export type AdminPremiumResume = {
	id: string;
	title: string;
	user_id: string;
	status: string;
	payment_status: string;
	payment_id: string | null;
	is_premium: boolean;
	assigned_reviewer_id: string | null;
	review_deadline: string | null;
	premium_claimed_at: string | null;
	created_at: string;
	candidate: ProfilePreview | null;
	reviewer: ProfilePreview | null;
};

export type AdminPremiumResumesData = {
	resumes: AdminPremiumResume[];
};

// ─── Page props ─────────────────────────────────────────────────────────────

type PremiumPageProps = {
	busyAction: string;
	onMarkPaid: (payoutId: string, payoutRef: string) => Promise<void>;
	onPremiumResumeAction: (resumeId: string, action: string, extra?: Record<string, string>) => Promise<void>;
	onPayoutStatusChange: (status: string) => void;
	onResumeFilterChange: (status: string) => void;
	payoutsData: AdminPayoutsData | null;
	premiumResumesData: AdminPremiumResumesData | null;
	payoutStatus: string;
	resumeFilter: string;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function paise(amount: number): string {
	return `₹${(amount / 100).toFixed(0)}`;
}

function formatDate(iso: string) {
	return new Date(iso).toLocaleDateString("en-IN", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

function formatDateTime(iso: string) {
	return new Date(iso).toLocaleString("en-IN", {
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function profileName(p: ProfilePreview | null, id: string) {
	if (!p) return id.slice(0, 8) + "…";
	return p.full_name ?? p.username ?? id.slice(0, 8) + "…";
}

// ─── Payout queue ───────────────────────────────────────────────────────────

function PayoutGroupCard({
	busyAction,
	group,
	onMarkPaid,
}: {
	busyAction: string;
	group: ReviewerPayoutGroup;
	onMarkPaid: (payoutId: string, payoutRef: string) => Promise<void>;
}) {
	const [refs, setRefs] = useState<Record<string, string>>({});
	const displayName = profileName(group.profile, group.reviewer_id);

	return (
		<div className="admin-card">
			<div className="admin-card-header">
				<div>
					<strong>{displayName}</strong>
					{group.profile?.username && group.profile.username !== displayName ? (
						<small className="muted-text"> @{group.profile.username}</small>
					) : null}
				</div>
				<div className="admin-card-meta">
					<span className="admin-badge">{group.payout_count} review{group.payout_count !== 1 ? "s" : ""}</span>
					<strong className="payout-total">{paise(group.total_paise)} owed</strong>
				</div>
			</div>

			<table className="admin-table">
				<thead>
					<tr>
						<th>Resume</th>
						<th>Amount</th>
						<th>Date</th>
						<th>Ref</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{group.payouts.map((payout) => {
						const isBusy = busyAction === `payout:${payout.id}:mark_paid`;
						return (
							<tr key={payout.id}>
								<td>
									{payout.resume_id ? (
										<a href={`/resumes/${payout.resume_id}`} rel="noreferrer" target="_blank">
											{payout.resume_id.slice(0, 8)}…
										</a>
									) : (
										<span className="muted-text">deleted</span>
									)}
								</td>
								<td>{paise(payout.amount_paise)}</td>
								<td>{formatDate(payout.created_at)}</td>
								<td>
									{payout.status === "pending" ? (
										<input
											className="admin-input-sm"
											onChange={(e) => setRefs((r) => ({ ...r, [payout.id]: e.target.value }))}
											placeholder="UPI / ref"
											type="text"
											value={refs[payout.id] ?? ""}
										/>
									) : (
										<span className="muted-text">{payout.payout_ref ?? "—"}</span>
									)}
								</td>
								<td>
									{payout.status === "pending" ? (
										<button
											className="admin-action-btn"
											disabled={isBusy}
											onClick={() => void onMarkPaid(payout.id, refs[payout.id] ?? "")}
											type="button"
										>
											{isBusy ? "Saving…" : "Mark paid"}
										</button>
									) : (
										<span className="admin-badge-success">Paid {payout.paid_at ? formatDate(payout.paid_at) : ""}</span>
									)}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

// ─── Premium resumes list ────────────────────────────────────────────────────

function PremiumResumeRow({
	busyAction,
	onAction,
	resume,
}: {
	busyAction: string;
	onAction: (resumeId: string, action: string, extra?: Record<string, string>) => Promise<void>;
	resume: AdminPremiumResume;
}) {
	const [assignReviewerId, setAssignReviewerId] = useState("");

	const isRefunding = busyAction === `premium:${resume.id}:force_refund`;
	const isAssigning = busyAction === `premium:${resume.id}:assign_reviewer`;

	const deadlinePassed = resume.review_deadline && new Date(resume.review_deadline) < new Date();

	return (
		<tr>
			<td>
				<a href={`/resumes/${resume.id}`} rel="noreferrer" target="_blank">
					{resume.title.length > 30 ? resume.title.slice(0, 30) + "…" : resume.title}
				</a>
			</td>
			<td>
				<span className="muted-text">{profileName(resume.candidate, resume.user_id)}</span>
			</td>
			<td>
				<span className={`admin-badge ${resume.payment_status === "paid" ? "admin-badge-success" : resume.payment_status === "refunded" ? "admin-badge-muted" : ""}`}>
					{resume.payment_status}
				</span>
			</td>
			<td>
				{resume.assigned_reviewer_id ? (
					<span className={deadlinePassed ? "admin-badge admin-badge-danger" : "admin-badge"}>
						{profileName(resume.reviewer, resume.assigned_reviewer_id)}
						{resume.review_deadline ? ` · ${formatDateTime(resume.review_deadline)}` : ""}
					</span>
				) : (
					<span className="muted-text">unclaimed</span>
				)}
			</td>
			<td>{formatDate(resume.created_at)}</td>
			<td>
				<div className="admin-row-actions">
					{resume.payment_status === "paid" ? (
						<button
							className="admin-danger-action"
							disabled={isRefunding}
							onClick={() => void onAction(resume.id, "force_refund")}
							title="Force refund and clear reviewer"
							type="button"
						>
							{isRefunding ? "Refunding…" : "Force refund"}
						</button>
					) : null}
					{resume.payment_status === "paid" ? (
						<div className="admin-assign-reviewer">
							<input
								className="admin-input-sm"
								onChange={(e) => setAssignReviewerId(e.target.value)}
								placeholder="Reviewer UUID"
								type="text"
								value={assignReviewerId}
							/>
							<button
								className="admin-action-btn"
								disabled={isAssigning || !assignReviewerId.trim()}
								onClick={() =>
									void onAction(resume.id, "assign_reviewer", {
										reviewer_id: assignReviewerId.trim(),
									}).then(() => setAssignReviewerId(""))
								}
								title="Manually assign this reviewer"
								type="button"
							>
								{isAssigning ? "Assigning…" : "Assign"}
							</button>
						</div>
					) : null}
				</div>
			</td>
		</tr>
	);
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function PremiumPage({
	busyAction,
	onMarkPaid,
	onPremiumResumeAction,
	onPayoutStatusChange,
	onResumeFilterChange,
	payoutsData,
	premiumResumesData,
	payoutStatus,
	resumeFilter,
}: PremiumPageProps) {
	const [activePanel, setActivePanel] = useState<"resumes" | "payouts">("resumes");

	return (
		<div className="admin-panel">
			<PanelHeader
				description="Priority resumes, manual overrides, and reviewer payout queue."
				title="Premium Controls"
			>
				<SegmentedTabs
					active={activePanel}
					onChange={(v) => setActivePanel(v as "resumes" | "payouts")}
					values={["resumes", "payouts"]}
				/>
			</PanelHeader>

			{activePanel === "resumes" ? (
				<>
					<div className="admin-panel-tools">
						<SegmentedTabs
							active={resumeFilter}
							onChange={onResumeFilterChange}
							values={["all", "paid", "pending", "refunded"]}
						/>
					</div>

					{!premiumResumesData || premiumResumesData.resumes.length === 0 ? (
						<EmptyPanel
							description="No premium resumes match this filter."
							title="Nothing here"
						/>
					) : (
						<div className="admin-table-wrap">
							<table className="admin-table">
								<thead>
									<tr>
										<th>Title</th>
										<th>Candidate</th>
										<th>Payment</th>
										<th>Reviewer / Deadline</th>
										<th>Submitted</th>
										<th>Actions</th>
									</tr>
								</thead>
								<tbody>
									{premiumResumesData.resumes.map((resume) => (
										<PremiumResumeRow
											busyAction={busyAction}
											key={resume.id}
											onAction={onPremiumResumeAction}
											resume={resume}
										/>
									))}
								</tbody>
							</table>
						</div>
					)}
				</>
			) : (
				<>
					<div className="admin-panel-tools">
						<SegmentedTabs
							active={payoutStatus}
							onChange={onPayoutStatusChange}
							values={["pending", "paid"]}
						/>
					</div>

					{payoutsData && payoutStatus === "pending" && payoutsData.total_paise > 0 ? (
						<div className="admin-summary-bar">
							Total outstanding:{" "}
							<strong>{paise(payoutsData.total_paise)}</strong>
							{" across "}
							<strong>{payoutsData.reviewers.length}</strong>
							{" reviewer(s)"}
						</div>
					) : null}

					{!payoutsData || payoutsData.reviewers.length === 0 ? (
						<EmptyPanel
							description={
								payoutStatus === "pending"
									? "No pending payouts. All reviewers are up to date."
									: "No completed payouts recorded yet."
							}
							title={payoutStatus === "pending" ? "All clear" : "No history"}
						/>
					) : (
						<div className="admin-card-list">
							{payoutsData.reviewers.map((group) => (
								<PayoutGroupCard
									busyAction={busyAction}
									group={group}
									key={group.reviewer_id}
									onMarkPaid={onMarkPaid}
								/>
							))}
						</div>
					)}
				</>
			)}
		</div>
	);
}
