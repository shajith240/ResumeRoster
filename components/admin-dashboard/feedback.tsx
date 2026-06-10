import Link from "next/link";
import {
	CheckCircle2,
	ExternalLink,
	MessageSquareReply,
	RefreshCcw,
	Send,
	Sparkles,
	XCircle,
} from "@/components/ui/solar-icons";
import {
	USER_FEEDBACK_CATEGORIES,
	USER_FEEDBACK_CATEGORY_LABELS,
	USER_FEEDBACK_PRIORITIES,
	USER_FEEDBACK_PRIORITY_LABELS,
	USER_FEEDBACK_STATUS_LABELS,
} from "@/lib/user-feedback";
import { ActionButton, EmptyPanel, PanelHeader, SegmentedTabs } from "./shared";
import { formatDate, formatRelativeAdminTime, getProfileLabel } from "./utils";
import type { UserFeedbackPreview } from "./types";

type FeedbackFilter = "all" | "open" | string;

const feedbackStatusFilters = [
	"all",
	"open",
	"new",
	"reviewing",
	"needs_user_reply",
	"planned",
	"resolved",
	"closed",
];

export function FeedbackPage({
	busyAction,
	category,
	feedback,
	notes,
	onAction,
	onCategoryChange,
	onNoteChange,
	onPriorityChange,
	onPriorityFilterChange,
	onReplyChange,
	onStatusChange,
	priority,
	priorityDrafts,
	replies,
	status,
	statusCounts,
}: {
	busyAction: string;
	category: string;
	feedback: UserFeedbackPreview[];
	notes: Record<string, string>;
	onAction: (
		ticket: UserFeedbackPreview,
		action: string,
		payload?: Record<string, string>,
	) => Promise<void>;
	onCategoryChange: (value: string) => void;
	onNoteChange: (ticketId: string, value: string) => void;
	onPriorityChange: (ticketId: string, value: string) => void;
	onPriorityFilterChange: (value: string) => void;
	onReplyChange: (ticketId: string, value: string) => void;
	onStatusChange: (value: string) => void;
	priority: string;
	priorityDrafts: Record<string, string>;
	replies: Record<string, string>;
	status: FeedbackFilter;
	statusCounts: Record<string, number>;
}) {
	const openCount =
		(statusCounts.new ?? 0) +
		(statusCounts.reviewing ?? 0) +
		(statusCounts.needs_user_reply ?? 0) +
		(statusCounts.planned ?? 0);

	return (
		<div className="admin-feedback-workspace">
			<section className="admin-console-section admin-feedback-hero">
				<PanelHeader
					description="Product feedback, bugs, UI requests, and support notes from signed-in users."
					title="Feedback Inbox"
				>
					<span className="admin-live-count">
						<Sparkles aria-hidden="true" />
						{openCount} open
					</span>
				</PanelHeader>
				<div className="admin-feedback-filter-grid">
					<div className="admin-filter-block">
						<span>Status</span>
						<SegmentedTabs
							active={status}
							onChange={onStatusChange}
							values={feedbackStatusFilters}
						/>
					</div>
					<label className="admin-filter-select">
						<span>Category</span>
						<select
							onChange={(event) => onCategoryChange(event.target.value)}
							value={category}
						>
							<option value="all">All categories</option>
							{USER_FEEDBACK_CATEGORIES.map((item) => (
								<option key={item} value={item}>
									{USER_FEEDBACK_CATEGORY_LABELS[item]}
								</option>
							))}
						</select>
					</label>
					<label className="admin-filter-select">
						<span>Priority</span>
						<select
							onChange={(event) => onPriorityFilterChange(event.target.value)}
							value={priority}
						>
							<option value="all">All priorities</option>
							{USER_FEEDBACK_PRIORITIES.map((item) => (
								<option key={item} value={item}>
									{USER_FEEDBACK_PRIORITY_LABELS[item]}
								</option>
							))}
						</select>
					</label>
				</div>
			</section>

			<section className="admin-feedback-list" aria-label="Feedback tickets">
				{feedback.map((ticket) => (
					<FeedbackTicketRow
						busyAction={busyAction}
						key={ticket.id}
						note={notes[ticket.id] ?? ticket.admin_note ?? ""}
						onAction={onAction}
						onNoteChange={onNoteChange}
						onPriorityChange={onPriorityChange}
						onReplyChange={onReplyChange}
						priorityDraft={priorityDrafts[ticket.id] ?? ticket.priority}
						reply={replies[ticket.id] ?? ""}
						ticket={ticket}
					/>
				))}
				{!feedback.length ? (
					<EmptyPanel
						description="Try another filter or wait for users to send product feedback."
						title="No feedback tickets"
					/>
				) : null}
			</section>
		</div>
	);
}

function FeedbackTicketRow({
	busyAction,
	note,
	onAction,
	onNoteChange,
	onPriorityChange,
	onReplyChange,
	priorityDraft,
	reply,
	ticket,
}: {
	busyAction: string;
	note: string;
	onAction: (
		ticket: UserFeedbackPreview,
		action: string,
		payload?: Record<string, string>,
	) => Promise<void>;
	onNoteChange: (ticketId: string, value: string) => void;
	onPriorityChange: (ticketId: string, value: string) => void;
	onReplyChange: (ticketId: string, value: string) => void;
	priorityDraft: string;
	reply: string;
	ticket: UserFeedbackPreview;
}) {
	const userLabel = getProfileLabel(ticket.userProfile ?? null);
	const statusLabel =
		USER_FEEDBACK_STATUS_LABELS[
			ticket.status as keyof typeof USER_FEEDBACK_STATUS_LABELS
		] ?? ticket.status;
	const categoryLabel =
		USER_FEEDBACK_CATEGORY_LABELS[
			ticket.category as keyof typeof USER_FEEDBACK_CATEGORY_LABELS
		] ?? ticket.category;
	const priorityLabel =
		USER_FEEDBACK_PRIORITY_LABELS[
			ticket.priority as keyof typeof USER_FEEDBACK_PRIORITY_LABELS
		] ?? ticket.priority;

	return (
		<article className="admin-feedback-ticket">
			<header>
				<div className="admin-feedback-ticket-title">
					<div className="admin-feedback-avatar">
						{userLabel.slice(0, 1).toUpperCase()}
					</div>
					<div>
						<span>
							{userLabel} - {formatRelativeAdminTime(ticket.created_at)}
						</span>
						<h3>{ticket.title}</h3>
					</div>
				</div>
				<div className="admin-feedback-tags">
					<span className={`admin-pill admin-priority-${ticket.priority}`}>
						{priorityLabel}
					</span>
					<span className="admin-pill">{categoryLabel}</span>
					<span className="admin-pill">{statusLabel}</span>
				</div>
			</header>

			<p>{ticket.body}</p>

			<div className="admin-feedback-meta">
				{ticket.source_path ? (
					<Link href={ticket.source_path}>
						<ExternalLink aria-hidden="true" />
						{ticket.source_path}
					</Link>
				) : null}
				<span>{formatDate(ticket.updated_at)}</span>
				{ticket.viewport ? <span>{ticket.viewport}</span> : null}
			</div>

			<div className="admin-feedback-control-grid">
				<label>
					<span>Priority</span>
					<select
						onChange={(event) => onPriorityChange(ticket.id, event.target.value)}
						value={priorityDraft}
					>
						{USER_FEEDBACK_PRIORITIES.map((item) => (
							<option key={item} value={item}>
								{USER_FEEDBACK_PRIORITY_LABELS[item]}
							</option>
						))}
					</select>
				</label>
				<label>
					<span>Admin note</span>
					<textarea
						maxLength={1000}
						onChange={(event) => onNoteChange(ticket.id, event.target.value)}
						placeholder="Decision context, duplicate link, or next step"
						value={note}
					/>
				</label>
				<label>
					<span>Reply to user</span>
					<textarea
						maxLength={800}
						onChange={(event) => onReplyChange(ticket.id, event.target.value)}
						placeholder="Short reply sent as an in-app notification"
						value={reply}
					/>
				</label>
			</div>

			<footer className="admin-action-row">
				<ActionButton
					action="mark_feedback_reviewing"
					busyAction={busyAction}
					icon={<RefreshCcw aria-hidden="true" />}
					label="Reviewing"
					onClick={() =>
						onAction(ticket, "mark_feedback_reviewing", { note })
					}
					scope="feedback"
					targetId={ticket.id}
				/>
				<ActionButton
					action="update_feedback_priority"
					busyAction={busyAction}
					icon={<Sparkles aria-hidden="true" />}
					label="Save priority"
					onClick={() =>
						onAction(ticket, "update_feedback_priority", {
							note,
							priority: priorityDraft,
						})
					}
					scope="feedback"
					targetId={ticket.id}
				/>
				<ActionButton
					action="mark_feedback_planned"
					busyAction={busyAction}
					icon={<CheckCircle2 aria-hidden="true" />}
					label="Planned"
					onClick={() => onAction(ticket, "mark_feedback_planned", { note })}
					scope="feedback"
					targetId={ticket.id}
				/>
				<ActionButton
					action="mark_feedback_resolved"
					busyAction={busyAction}
					icon={<CheckCircle2 aria-hidden="true" />}
					label="Resolve"
					onClick={() => onAction(ticket, "mark_feedback_resolved", { note })}
					scope="feedback"
					targetId={ticket.id}
				/>
				<ActionButton
					action="reply_feedback_ticket"
					busyAction={busyAction}
					icon={<Send aria-hidden="true" />}
					label="Reply"
					onClick={() =>
						onAction(ticket, "reply_feedback_ticket", { note, reply })
					}
					scope="feedback"
					targetId={ticket.id}
				/>
				{ticket.status === "closed" ? (
					<ActionButton
						action="reopen_feedback_ticket"
						busyAction={busyAction}
						icon={<MessageSquareReply aria-hidden="true" />}
						label="Reopen"
						onClick={() => onAction(ticket, "reopen_feedback_ticket", { note })}
						scope="feedback"
						targetId={ticket.id}
					/>
				) : (
					<ActionButton
						action="close_feedback_ticket"
						busyAction={busyAction}
						icon={<XCircle aria-hidden="true" />}
						label="Close"
						onClick={() => onAction(ticket, "close_feedback_ticket", { note })}
						scope="feedback"
						targetId={ticket.id}
						tone="danger"
					/>
				)}
			</footer>
		</article>
	);
}
