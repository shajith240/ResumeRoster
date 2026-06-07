import type { FormEvent } from "react";
import type { CommentAttachmentOption } from "@/components/CommentMediaToolbar";
import type { GuidedReviewIssueType } from "@/lib/guided-review";
import type { ThreadReviewNode } from "@/lib/resume-thread";
import type { CommentContentFormat } from "@/lib/supabase/types";
import { CommentComposer } from "./comment-composer";
import { GuidedReviewComposer } from "./guided-review-composer";
import { SUPABASE_MIGRATION_MESSAGE } from "./selectors";
import { ThreadReviewItem } from "./thread-review-item";
import type { ThreadReviewControls } from "./types";

type DiscussionPanelProps = ThreadReviewControls & {
	content: string;
	contentFormat: CommentContentFormat;
	guidedIssue: string;
	guidedIssueType: GuidedReviewIssueType | "";
	guidedSuggestion: string;
	isOwner: boolean;
	isWaiting: boolean;
	message: string;
	needsGuidedReviewCredit: boolean;
	onContentChange: (value: string) => void;
	onContentFormatChange: (format: CommentContentFormat) => void;
	onGuidedIssueChange: (value: string) => void;
	onGuidedIssueTypeChange: (value: GuidedReviewIssueType) => void;
	onGuidedSuggestionChange: (value: string) => void;
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
	guidedIssue,
	guidedIssueType,
	guidedSuggestion,
	deleteSchemaReady,
	deletingReviewId,
	dislikedReviewIds,
	isClosed,
	isOwner,
	isWaiting,
	likedReviewIds,
	mediaSchemaReady,
	message,
	needsGuidedReviewCredit,
	onCancelReply,
	onContentChange,
	onContentFormatChange,
	onGuidedIssueChange,
	onGuidedIssueTypeChange,
	onGuidedSuggestionChange,
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
	const feedbackLocked = isClosed || isWaiting;

	return (
		<section className="thread-discussion-panel" aria-label="Feedback discussion">
			{feedbackLocked || isOwner ? (
				<div className="closed-note">
					<h2>
						{isWaiting
							? "Waiting for activation"
							: isOwner
								? "Owner view"
								: "Feedback closed"}
					</h2>
					<p>
						{isWaiting
							? isOwner
								? "This resume is uploaded, but it will not appear in the public feed until you complete the required guided reviews."
								: "This resume is not open for public feedback yet."
							: isOwner
								? isClosed
									? "You own this resume. Reopen feedback when you want reviewers to add new comments again."
									: "You own this resume. You can reply for clarification, but you cannot mark feedback helpful."
								: "This thread is visible for learning, but no new feedback can be added."}
					</p>
					{message ? <p className="form-message">{message}</p> : null}
				</div>
			) : (
				<form className="roast-form thread-roast-form" onSubmit={onReviewSubmit}>
					{needsGuidedReviewCredit ? (
						<GuidedReviewComposer
							attachment={selectedAttachment}
							disabledTools={!mediaSchemaReady || submitting}
							issue={guidedIssue}
							issueType={guidedIssueType}
							onAttachmentChange={onSelectedAttachmentChange}
							onIssueChange={onGuidedIssueChange}
							onIssueTypeChange={onGuidedIssueTypeChange}
							onRequireLogin={onRequireLogin}
							onSuggestionChange={onGuidedSuggestionChange}
							submitDisabled={submitting}
							submitLabel={submitting ? "Posting..." : user ? "Submit" : "Sign in"}
							suggestion={guidedSuggestion}
						/>
					) : (
						<CommentComposer
							attachment={selectedAttachment}
							contentFormat={contentFormat}
							disabledTools={!mediaSchemaReady || submitting}
							maxHeight={240}
							minHeight={76}
							onAttachmentChange={onSelectedAttachmentChange}
							onChange={onContentChange}
							onFormatChange={onContentFormatChange}
							onRequireLogin={onRequireLogin}
							placeholder="Be specific. What should they rewrite, reorder, quantify, or remove?"
							submitDisabled={submitting}
							submitLabel={submitting ? "Posting..." : user ? "Submit" : "Sign in"}
							value={content}
						/>
					)}
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
						isClosed={feedbackLocked}
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
