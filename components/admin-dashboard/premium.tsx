"use client";

import { useState } from "react";
import { EmptyPanel, PanelHeader, SegmentedTabs } from "./shared";

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

type PremiumPageProps = {
	busyAction: string;
	onMarkPaid: (payoutId: string, payoutRef: string) => Promise<void>;
	onStatusChange: (status: string) => void;
	payoutsData: AdminPayoutsData | null;
	status: string;
};

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
	const displayName = group.profile?.full_name ?? group.profile?.username ?? group.reviewer_id.slice(0, 8);

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
										<a
											href={`/resumes/${payout.resume_id}`}
											rel="noreferrer"
											target="_blank"
										>
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
											onChange={(e) =>
												setRefs((r) => ({ ...r, [payout.id]: e.target.value }))
											}
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
											onClick={() =>
												void onMarkPaid(payout.id, refs[payout.id] ?? "")
											}
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

export function PremiumPage({
	busyAction,
	onMarkPaid,
	onStatusChange,
	payoutsData,
	status,
}: PremiumPageProps) {
	return (
		<div className="admin-panel">
			<PanelHeader
				description="Reviewer earnings for completed priority reviews. Mark each payout once you've transferred funds."
				title="Reviewer Payout Queue"
			>
				<SegmentedTabs
					active={status}
					onChange={onStatusChange}
					values={["pending", "paid"]}
				/>
			</PanelHeader>

			{payoutsData && status === "pending" && payoutsData.total_paise > 0 ? (
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
						status === "pending"
							? "No pending payouts. All reviewers are up to date."
							: "No completed payouts recorded yet."
					}
					title={status === "pending" ? "All clear" : "No history"}
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
		</div>
	);
}
