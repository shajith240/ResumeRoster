"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { CommentAttachmentOption } from "@/components/CommentMediaToolbar";
import type { GuidedReviewIssueType } from "@/lib/guided-review";
import { buildMentionSuggestions } from "@/lib/comment-mentions";
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
	const [rootComposerOpen, setRootComposerOpen] = useState(false);
	const wasSubmittingRef = useRef(false);
	const hasDraftContent = Boolean(content.trim()) || Boolean(selectedAttachment);
	const showRootComposer = rootComposerOpen || hasDraftContent;
	const mentionSuggestions = useMemo(
		() =>
			buildMentionSuggestions(Object.keys(authorProfiles), authorProfiles, {
				excludeUserId: user?.id,
			}),
		[authorProfiles, user?.id],
	);

	useEffect(() => {
		if (
			wasSubmittingRef.current &&
			!submitting &&
			!content.trim() &&
			!selectedAttachment &&
			!message
		) {
			setRootComposerOpen(false);
		}

		wasSubmittingRef.current = submitting;
	}, [content, message, selectedAttachment, submitting]);

	function handleRootComposerCancel() {
		onContentChange("");
		onContentFormatChange("plain");
		onSelectedAttachmentChange(null);
		setRootComposerOpen(false);
	}

	return (
		<section
			className="thread-discussion-panel resume-comments-panel mobile-thread-comments"
			aria-label="Feedback discussion"
		>
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
			) : needsGuidedReviewCredit ? (
				<form className="roast-form thread-roast-form" onSubmit={onReviewSubmit}>
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
					{message ? <p className="form-message">{message}</p> : null}
				</form>
			) : showRootComposer ? (
				<form
					className="roast-form thread-roast-form resume-root-comment-form resume-root-comment-form-desktop"
					onSubmit={onReviewSubmit}
				>
					<CommentComposer
						attachment={selectedAttachment}
						autoFocus
						cancelLabel="Cancel"
						className="resume-root-comment-composer"
						contentFormat={contentFormat}
						disabledTools={!mediaSchemaReady || submitting}
						maxHeight={160}
						minHeight={44}
						mentionSuggestions={mentionSuggestions}
						onAttachmentChange={onSelectedAttachmentChange}
						onCancel={handleRootComposerCancel}
						onChange={onContentChange}
						onFormatChange={onContentFormatChange}
						onRequireLogin={onRequireLogin}
						placeholder="Join the conversation"
						submitDisabled={
							submitting || (!selectedAttachment && content.trim().length < 2)
						}
						submitLabel={submitting ? "Posting..." : user ? "Comment" : "Sign in"}
						value={content}
					/>
					{message ? <p className="form-message">{message}</p> : null}
				</form>
			) : (
				<>
					<button
						className="resume-comment-join-pill"
						onClick={() => setRootComposerOpen(true)}
						type="button"
					>
						Join the conversation
					</button>
					{message ? <p className="form-message">{message}</p> : null}
				</>
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
						mentionSuggestions={mentionSuggestions}
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
