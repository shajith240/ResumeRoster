import type { CSSProperties } from "react";
import Link from "next/link";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import CommentMediaToolbar from "@/components/CommentMediaToolbar";
import { Button } from "@/components/ui/button";
import {
	getReactionBlockReason,
	getReplyBlockReason,
	type ThreadReviewNode,
} from "@/lib/resume-thread";
import {
	FormattedReviewContent,
	ReviewAttachment,
	ReviewerTrustChip,
} from "./content";
import { SUPABASE_MIGRATION_MESSAGE } from "./selectors";
import type { ThreadReviewControls } from "./types";
import { formatDate, getAuthorAvatar, getAuthorHandle } from "./utils";

export function createThreadRenderIndexMap(reviews: ThreadReviewNode[]) {
	const indexById = new Map<string, number>();
	let index = 0;

	function visit(review: ThreadReviewNode) {
		indexById.set(review.id, index);
		index += 1;
		review.children.forEach(visit);
	}

	reviews.forEach(visit);
	return indexById;
}

type ThreadReviewItemProps = ThreadReviewControls & {
	review: ThreadReviewNode;
};

export function ThreadReviewItem({
	attachmentsById,
	authorProfiles,
	collapsedReviewIds,
	deleteSchemaReady,
	deletingReviewId,
	dislikedReviewIds,
	isClosed,
	likedReviewIds,
	mediaSchemaReady,
	onCancelReply,
	onDeleteReviewRequest,
	onOpenReportDialog,
	onReactToReview,
	onReplyAttachmentChange,
	onReplyContentChange,
	onReplyFormatChange,
	onReplySubmit,
	onReplyToggle,
	onRequireLogin,
	onToggleReplies,
	renderIndexById,
	replyAttachment,
	replyContent,
	replyContentFormat,
	replyingToId,
	replySchemaReady,
	reportSchemaReady,
	resume,
	review,
	submittingReplyId,
	user,
}: ThreadReviewItemProps) {
	const voted = likedReviewIds.has(review.id);
	const disliked = dislikedReviewIds.has(review.id);
	const authorProfile = authorProfiles[review.author_id];
	const authorHandle = getAuthorHandle(review.author_id, authorProfile);
	const reactionBlockReason = getReactionBlockReason(user, resume, review);
	const reactionDisabled = Boolean(reactionBlockReason);
	const replyCount = Math.max(review.reply_count ?? 0, review.childCount);
	const isCollapsed = collapsedReviewIds.has(review.id);
	const isDeleted = Boolean(review.is_deleted);
	const reviewAttachment =
		!isDeleted && review.attachment_id
			? attachmentsById[review.attachment_id]
			: null;
	const isOwnReview = user?.id === review.author_id;
	const replyBlockReason = getReplyBlockReason({
		isClosed,
		isDeleted,
		isOwnReview,
		migrationMessage: SUPABASE_MIGRATION_MESSAGE,
		replySchemaReady,
	});
	const canReply = !replyBlockReason;
	const reviewStyle = {
		animationDelay: `${(renderIndexById.get(review.id) ?? 0) * 32}ms`,
	} as CSSProperties;
	const childReviewProps: ThreadReviewControls = {
		attachmentsById,
		authorProfiles,
		collapsedReviewIds,
		deleteSchemaReady,
		deletingReviewId,
		dislikedReviewIds,
		isClosed,
		likedReviewIds,
		mediaSchemaReady,
		onCancelReply,
		onDeleteReviewRequest,
		onOpenReportDialog,
		onReactToReview,
		onReplyAttachmentChange,
		onReplyContentChange,
		onReplyFormatChange,
		onReplySubmit,
		onReplyToggle,
		onRequireLogin,
		onToggleReplies,
		renderIndexById,
		replyAttachment,
		replyContent,
		replyContentFormat,
		replyingToId,
		replySchemaReady,
		reportSchemaReady,
		resume,
		submittingReplyId,
		user,
	};

	return (
		<div
			className="thread-roast-node"
			data-thread-parent-id={review.parent_id ?? undefined}
			data-thread-roast-id={review.id}
			id={`comment-${review.id}`}
			key={review.id}
			role="listitem"
		>
			{review.depth > 0 ? (
				<svg
					aria-hidden="true"
					className="thread-branch-curve"
					focusable="false"
					preserveAspectRatio="none"
					viewBox="0 0 48 32"
				>
					<path d="M0.5 0 V16 C0.5 24.5 7 31.5 15.5 31.5 H31" />
				</svg>
			) : null}
			<article
				className={`thread-roast ${review.depth ? "is-reply" : ""}${
					isDeleted ? " is-deleted" : ""
				}`}
				style={reviewStyle}
			>
				<div className="thread-roast-avatar-cell" aria-hidden="true">
					{isDeleted ? (
						<span className="thread-roast-avatar is-deleted">D</span>
					) : (
						<img
							className="thread-roast-avatar"
							src={getAuthorAvatar(review.author_id, authorProfile)}
							alt=""
							width={32}
							height={32}
							aria-hidden="true"
						/>
					)}
				</div>
				<div className="thread-roast-body">
					<header>
						{isDeleted ? (
							<span className="deleted-author-chip">Deleted reviewer</span>
						) : (
							<Button asChild className="comment-author-chip" size="sm">
								<Link href={`/profile/${review.author_id}`}>
									{authorHandle}
								</Link>
							</Button>
						)}
						{isDeleted ? null : <ReviewerTrustChip profile={authorProfile} />}
						<time dateTime={review.created_at}>
							&middot; {formatDate(review.created_at)}
						</time>
						{!isDeleted && review.helpful_votes > 5 ? (
							<span className="badge badge-open">Verified helpful</span>
						) : null}
					</header>
					<FormattedReviewContent
						content={review.content}
						format={review.content_format}
						isDeleted={isDeleted}
					/>
					<ReviewAttachment attachment={reviewAttachment} />
					<footer>
						{isDeleted ? null : (
							<div className="comment-reactions">
								<Button
									className="reaction-button py-0 pe-0"
									variant={voted ? "secondary" : "outline"}
									disabled={reactionDisabled}
									onClick={() => onReactToReview(review, "like")}
									type="button"
									aria-label={
										voted
											? "Remove like from this review"
											: "Like this review"
									}
									title={reactionBlockReason ?? undefined}
								>
									<ThumbsUp
										className="me-2 opacity-60"
										size={16}
										strokeWidth={2}
										aria-hidden="true"
									/>
									Like
									<span className="reaction-count">{review.helpful_votes}</span>
								</Button>
								<Button
									className="reaction-button py-0 pe-0"
									variant={disliked ? "secondary" : "outline"}
									disabled={reactionDisabled}
									onClick={() => onReactToReview(review, "dislike")}
									type="button"
									aria-label={
										disliked
											? "Remove dislike from this review"
											: "Dislike this review"
									}
									title={reactionBlockReason ?? undefined}
								>
									<ThumbsDown
										className="me-2 opacity-60"
										size={16}
										strokeWidth={2}
										aria-hidden="true"
									/>
									Dislike
									<span className="reaction-count">
										{review.dislike_count ?? 0}
									</span>
								</Button>
							</div>
						)}
						{isDeleted ? null : (
							<button
								disabled={!canReply}
								title={replyBlockReason ?? undefined}
								onClick={() => {
									if (!canReply) return;
									onReplyToggle(review.id);
								}}
								type="button"
							>
								Reply
							</button>
						)}
						{replyCount > 0 ? (
							<button
								className="reply-collapse-button"
								onClick={() => onToggleReplies(review.id)}
								type="button"
							>
								{isCollapsed
									? `Show ${replyCount} ${
											replyCount === 1 ? "reply" : "replies"
										}`
									: "Hide replies"}
							</button>
						) : null}
						{!isDeleted && isOwnReview ? (
							<button
								className="comment-delete-button"
								disabled={!deleteSchemaReady || deletingReviewId === review.id}
								onClick={() => onDeleteReviewRequest(review)}
								title={
									deleteSchemaReady
										? undefined
										: `${SUPABASE_MIGRATION_MESSAGE} Deletes are not ready yet.`
								}
								type="button"
							>
								{deletingReviewId === review.id ? "Deleting..." : "Delete"}
							</button>
						) : null}
						{!isDeleted && !isOwnReview ? (
							<button
								className="comment-report-button"
								disabled={!reportSchemaReady}
								onClick={() => onOpenReportDialog(review)}
								title={
									reportSchemaReady
										? undefined
										: `${SUPABASE_MIGRATION_MESSAGE} Reports are not ready yet.`
								}
								type="button"
							>
								Report
							</button>
						) : null}
					</footer>
					{!isDeleted && canReply && replyingToId === review.id ? (
						<form
							className="inline-reply-form"
							onSubmit={(event) => onReplySubmit(event, review)}
						>
							<textarea
								autoFocus
								onChange={(event) => onReplyContentChange(event.target.value)}
								placeholder={`Reply to ${authorHandle}`}
								rows={3}
								value={replyContent}
							/>
							<CommentMediaToolbar
								attachment={replyAttachment}
								contentFormat={replyContentFormat}
								disabled={!mediaSchemaReady || submittingReplyId === review.id}
								onAttachmentChange={onReplyAttachmentChange}
								onFormatChange={onReplyFormatChange}
								onRequireLogin={onRequireLogin}
							/>
							<div className="inline-reply-actions">
								<button
									className="reply-cancel-button"
									onClick={onCancelReply}
									type="button"
								>
									Cancel
								</button>
								<button
									className="btn-primary btn-brand reply-submit-button"
									disabled={submittingReplyId === review.id}
									type="submit"
								>
									{submittingReplyId === review.id ? "Posting..." : "Post reply"}
								</button>
							</div>
						</form>
					) : null}
				</div>
			</article>
			{review.children.length ? (
				<div
					aria-label={`Replies to ${authorHandle}`}
					className="thread-children"
					role="list"
				>
					{review.children.map((child) => (
						<ThreadReviewItem {...childReviewProps} key={child.id} review={child} />
					))}
				</div>
			) : null}
		</div>
	);
}
