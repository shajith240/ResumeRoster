import type { FormEvent } from "react";
import CommentMediaToolbar, {
	type CommentAttachmentOption,
} from "@/components/CommentMediaToolbar";
import type { CommentContentFormat } from "@/lib/supabase/types";
import type { ThreadReviewNode } from "@/lib/resume-thread";
import { SUPABASE_MIGRATION_MESSAGE } from "./selectors";
import { ThreadReviewItem } from "./thread-review-item";
import type { ThreadReviewControls } from "./types";

type DiscussionPanelProps = ThreadReviewControls & {
	content: string;
	contentFormat: CommentContentFormat;
	isOwner: boolean;
	message: string;
	onContentChange: (value: string) => void;
	onContentFormatChange: (format: CommentContentFormat) => void;
	onReviewSubmit: (event: FormEvent<HTMLFormElement>) => void;
	onSelectedAttachmentChange: (attachment: CommentAttachmentOption | null) => void;
	selectedAttachment: CommentAttachmentOption | null;
	submitting: boolean;
	threadReviews: ThreadReviewNode[];
	visibleReviewCount: number;
};

export function DiscussionPanel({
	attachmentsById,
	authorProfiles,
	collapsedReviewIds,
	content,
	contentFormat,
	deleteSchemaReady,
	deletingReviewId,
	dislikedReviewIds,
	isClosed,
	isOwner,
	likedReviewIds,
	mediaSchemaReady,
	message,
	onCancelReply,
	onContentChange,
	onContentFormatChange,
	onDeleteReviewRequest,
	onOpenReportDialog,
	onReactToReview,
	onReplyAttachmentChange,
	onReplyContentChange,
	onReplyFormatChange,
	onReplySubmit,
	onReplyToggle,
	onRequireLogin,
	onReviewSubmit,
	onSelectedAttachmentChange,
	onToggleReplies,
	renderIndexById,
	replyAttachment,
	replyContent,
	replyContentFormat,
	replyingToId,
	replySchemaReady,
	reportSchemaReady,
	resume,
	selectedAttachment,
	submitting,
	submittingReplyId,
	threadReviews,
	user,
	visibleReviewCount,
}: DiscussionPanelProps) {
	return (
		<section className="thread-discussion-panel" aria-label="Feedback discussion">
			{isClosed || isOwner ? (
				<div className="closed-note">
					<h2>{isOwner ? "Owner view" : "Feedback closed"}</h2>
					<p>
						{isOwner
							? isClosed
								? "You own this resume. Reopen feedback when you want reviewers to add new comments again."
								: "You own this resume. You can reply for clarification, but you cannot mark feedback helpful."
							: "This thread is visible for learning, but no new feedback can be added."}
					</p>
					{message ? <p className="form-message">{message}</p> : null}
				</div>
			) : (
				<form className="roast-form thread-roast-form" onSubmit={onReviewSubmit}>
					<textarea
						value={content}
						onChange={(event) => onContentChange(event.target.value)}
						placeholder="Be specific. What should they rewrite, reorder, quantify, or remove?"
						rows={4}
					/>
					<div className="roast-form-footer">
						<span>Review the resume, not the person</span>
						<div className="roast-form-actions">
							<CommentMediaToolbar
								attachment={selectedAttachment}
								contentFormat={contentFormat}
								disabled={!mediaSchemaReady || submitting}
								onAttachmentChange={onSelectedAttachmentChange}
								onFormatChange={onContentFormatChange}
								onRequireLogin={onRequireLogin}
							/>
							<button className="btn-primary btn-brand" disabled={submitting}>
								{submitting
									? "Posting..."
									: user
										? "Submit feedback"
										: "Sign in to review"}
							</button>
						</div>
					</div>
					{message ? <p className="form-message">{message}</p> : null}
				</form>
			)}

			<div className="thread-list-header">
				<h2>Feedback thread</h2>
				<span>{visibleReviewCount} comments</span>
			</div>
			{!replySchemaReady ? (
				<p className="form-message">
					{SUPABASE_MIGRATION_MESSAGE} Nested replies are not ready yet.
				</p>
			) : null}
			{!deleteSchemaReady ? (
				<p className="form-message">
					{SUPABASE_MIGRATION_MESSAGE} Comment deletes are not ready yet.
				</p>
			) : null}
			{!reportSchemaReady ? (
				<p className="form-message">
					{SUPABASE_MIGRATION_MESSAGE} Reports are not ready yet.
				</p>
			) : null}
			{!mediaSchemaReady ? (
				<p className="form-message">
					{SUPABASE_MIGRATION_MESSAGE} Comment media is not ready yet.
				</p>
			) : null}

			<div className="roast-list" role={threadReviews.length ? "list" : undefined}>
				{threadReviews.map((review) => (
					<ThreadReviewItem
						attachmentsById={attachmentsById}
						authorProfiles={authorProfiles}
						collapsedReviewIds={collapsedReviewIds}
						deleteSchemaReady={deleteSchemaReady}
						deletingReviewId={deletingReviewId}
						dislikedReviewIds={dislikedReviewIds}
						isClosed={isClosed}
						key={review.id}
						likedReviewIds={likedReviewIds}
						mediaSchemaReady={mediaSchemaReady}
						onCancelReply={onCancelReply}
						onDeleteReviewRequest={onDeleteReviewRequest}
						onOpenReportDialog={onOpenReportDialog}
						onReactToReview={onReactToReview}
						onReplyAttachmentChange={onReplyAttachmentChange}
						onReplyContentChange={onReplyContentChange}
						onReplyFormatChange={onReplyFormatChange}
						onReplySubmit={onReplySubmit}
						onReplyToggle={onReplyToggle}
						onRequireLogin={onRequireLogin}
						onToggleReplies={onToggleReplies}
						renderIndexById={renderIndexById}
						replyAttachment={replyAttachment}
						replyContent={replyContent}
						replyContentFormat={replyContentFormat}
						replyingToId={replyingToId}
						replySchemaReady={replySchemaReady}
						reportSchemaReady={reportSchemaReady}
						resume={resume}
						review={review}
						submittingReplyId={submittingReplyId}
						user={user}
					/>
				))}
				{!threadReviews.length ? (
					<p className="muted-text">
						No feedback yet. First useful comment wins the room.
					</p>
				) : null}
			</div>
		</section>
	);
}
