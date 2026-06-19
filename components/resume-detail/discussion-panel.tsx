"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { CommentAttachmentOption } from "@/components/CommentMediaToolbar";
import type { GuidedReviewIssueType } from "@/lib/guided-review";
import {
	buildMentionSuggestions,
	extractMentionHandlesFromTexts,
	lookupMentionSuggestionsByHandles,
	mergeMentionSuggestions,
	type MentionSuggestion,
} from "@/lib/comment-mentions";
import type { ThreadReviewNode } from "@/lib/resume-thread";
import { supabase } from "@/lib/supabase/client";
import type { CommentContentFormat } from "@/lib/supabase/types";
import { CommentComposer } from "./comment-composer";
import { GuidedReviewComposer } from "./guided-review-composer";
import { SUPABASE_MIGRATION_MESSAGE } from "./selectors";
import { ThreadReviewItem } from "./thread-review-item";
import type { ThreadReviewControls } from "./types";

type DiscussionPanelProps = ThreadReviewControls & {
	claiming: boolean;
	content: string;
	contentFormat: CommentContentFormat;
	guidedIssue: string;
	guidedIssueType: GuidedReviewIssueType | "";
	guidedSuggestion: string;
	isClaimable: boolean;
	isPremiumClaimed: boolean;
	isOwner: boolean;
	isWaiting: boolean;
	message: string;
	needsGuidedReviewCredit: boolean;
	onClaim: () => void;
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

function getThreadMentionHandles(threadReviews: ThreadReviewNode[]) {
	const reviewTexts: string[] = [];
	const visitReview = (review: ThreadReviewNode) => {
		if (!review.is_deleted) reviewTexts.push(review.content);
		for (const child of review.children) {
			visitReview(child);
		}
	};

	for (const review of threadReviews) {
		visitReview(review);
	}

	return extractMentionHandlesFromTexts(reviewTexts);
}

export function DiscussionPanel({
	attachmentsById,
	authorProfiles,
	claiming,
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
	isClaimable,
	isPremiumClaimed,
	isOwner,
	isWaiting,
	likedReviewIds,
	mediaSchemaReady,
	message,
	needsGuidedReviewCredit,
	onClaim,
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
	const [resolvedMentionSuggestions, setResolvedMentionSuggestions] = useState<
		MentionSuggestion[]
	>([]);
	const wasSubmittingRef = useRef(false);
	const hasDraftContent = Boolean(content.trim()) || Boolean(selectedAttachment);
	const showRootComposer = rootComposerOpen || hasDraftContent;
	const localMentionSuggestions = useMemo(
		() =>
			buildMentionSuggestions(Object.keys(authorProfiles), authorProfiles, {
				excludeUserId: user?.id,
			}),
		[authorProfiles, user?.id],
	);
	const mentionedHandles = useMemo(
		() => getThreadMentionHandles(threadReviews),
		[threadReviews],
	);
	const mentionedHandlesKey = mentionedHandles.join("\u001f");
	const mentionSuggestions = useMemo(
		() =>
			mergeMentionSuggestions(
				localMentionSuggestions,
				resolvedMentionSuggestions,
				120,
			),
		[localMentionSuggestions, resolvedMentionSuggestions],
	);

	useEffect(() => {
		if (!mentionedHandles.length) {
			setResolvedMentionSuggestions([]);
			return;
		}

		const controller = new AbortController();
		let cancelled = false;

		async function loadMentionTargets() {
			const session = await supabase.auth.getSession();
			const accessToken = session.data.session?.access_token;
			const suggestions = await lookupMentionSuggestionsByHandles(
				mentionedHandles,
				{
					accessToken,
					limit: 120,
					signal: controller.signal,
				},
			);

			if (!cancelled) {
				setResolvedMentionSuggestions(suggestions);
			}
		}

		void loadMentionTargets().catch((error) => {
			if (cancelled || controller.signal.aborted) return;
			if (error instanceof DOMException && error.name === "AbortError") return;

			setResolvedMentionSuggestions([]);
		});

		return () => {
			cancelled = true;
			controller.abort();
		};
	}, [mentionedHandles, mentionedHandlesKey]);

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
			{isClaimable && (
				<div className="premium-claim-banner">
					<div className="premium-claim-info">
						<span className="badge premium-badge">Priority review</span>
						<p>This resume needs a verified reviewer. Claim it to get 24 hours to submit your review.</p>
					</div>
					<button
						className="btn-primary premium-claim-btn"
						disabled={claiming}
						onClick={onClaim}
						type="button"
					>
						{claiming ? (
							<><span className="button-spinner" /> Claiming...</>
						) : (
							"Claim this review"
						)}
					</button>
				</div>
			)}

			{isPremiumClaimed && !isClaimable && (
				<div className="premium-claimed-banner">
					A reviewer has been assigned and is working on this. Expect feedback within 24 hours.
				</div>
			)}

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
