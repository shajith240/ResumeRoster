import Link from "next/link";
import {
	CheckCircle2,
	ExternalLink,
	Lock,
	RotateCcw,
	ShieldAlert,
	ShieldCheck,
	Trash2,
	Unlock,
	UserRound,
	XCircle,
} from "@/components/ui/solar-icons";
import type { ContentReportStatus } from "@/lib/supabase/types";
import {
	getReviewerTypeLabel,
	isReviewerType,
	type ReviewerApplicationStatus,
} from "@/lib/reviewer-validation";
import { reportStatuses, reviewerStatuses } from "./constants";
import { ActionButton, EmptyPanel, PanelHeader, SegmentedTabs } from "./shared";
import {
	formatDate,
	formatReason,
	formatTargetType,
	getProfileLabel,
	getTargetTitle,
} from "./utils";
import type { ModerationAction, ReportPreview, ReviewerApplicationPreview } from "./types";

export function ReportsPage({
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

export function ReviewersPage({
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

export function ReportRow({
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
	const reportCommunityPost = report.communityPost;
	const reportCommunityComment = report.communityComment;
	const isCommunityReport =
		report.target_type === "community_post" ||
		report.target_type === "community_comment";
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
					{reportCommunityPost ? (
						<Link href={`/community/${reportCommunityPost.id}`}>
							<ExternalLink aria-hidden="true" />
							Post
						</Link>
					) : null}
					{reportCommunityComment ? (
						<Link href={`/community/${reportCommunityComment.post_id}#comments`}>
							<ExternalLink aria-hidden="true" />
							Thread
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
					{reportCommunityPost ? (
						<>
							{reportCommunityPost.status === "held" ? (
								<ActionButton
									action="restore_community_post"
									busyAction={busyAction}
									icon={<ShieldCheck aria-hidden="true" />}
									label="Approve post"
									onClick={() => onAction(report.id, "restore_community_post")}
									scope="report"
									targetId={report.id}
								/>
							) : reportCommunityPost.status === "removed" ? (
								<ActionButton
									action="restore_community_post"
									busyAction={busyAction}
									icon={<RotateCcw aria-hidden="true" />}
									label="Restore post"
									onClick={() => onAction(report.id, "restore_community_post")}
									scope="report"
									targetId={report.id}
								/>
							) : (
								<ActionButton
									action="remove_community_post"
									busyAction={busyAction}
									icon={<Trash2 aria-hidden="true" />}
									label="Hide post"
									onClick={() => onAction(report.id, "remove_community_post")}
									scope="report"
									targetId={report.id}
									tone="danger"
								/>
							)}
							{reportCommunityPost.status === "locked" ? (
								<ActionButton
									action="unlock_community_post"
									busyAction={busyAction}
									icon={<Unlock aria-hidden="true" />}
									label="Unlock"
									onClick={() => onAction(report.id, "unlock_community_post")}
									scope="report"
									targetId={report.id}
								/>
							) : (
								<ActionButton
									action="lock_community_post"
									busyAction={busyAction}
									disabled={reportCommunityPost.status !== "active"}
									icon={<Lock aria-hidden="true" />}
									label="Lock"
									onClick={() => onAction(report.id, "lock_community_post")}
									scope="report"
									targetId={report.id}
								/>
							)}
						</>
					) : null}
					{reportCommunityComment ? (
						reportCommunityComment.status === "held" ? (
							<ActionButton
								action="restore_community_comment"
								busyAction={busyAction}
								icon={<ShieldCheck aria-hidden="true" />}
								label="Approve comment"
								onClick={() => onAction(report.id, "restore_community_comment")}
								scope="report"
								targetId={report.id}
							/>
						) : reportCommunityComment.status === "removed" ? (
							<ActionButton
								action="restore_community_comment"
								busyAction={busyAction}
								icon={<RotateCcw aria-hidden="true" />}
								label="Restore comment"
								onClick={() => onAction(report.id, "restore_community_comment")}
								scope="report"
								targetId={report.id}
							/>
						) : (
							<ActionButton
								action="remove_community_comment"
								busyAction={busyAction}
								icon={<Trash2 aria-hidden="true" />}
								label="Remove comment"
								onClick={() => onAction(report.id, "remove_community_comment")}
								scope="report"
								targetId={report.id}
								tone="danger"
							/>
						)
					) : null}
					{isCommunityReport ? (
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

export function ReviewerRow({
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

export function AuditPage({ actions }: { actions: ModerationAction[] }) {
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

export function ActionLogRow({ action }: { action: ModerationAction }) {
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
