import type { CSSProperties } from "react";
import Link from "next/link";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	getReactionBlockReason,
	getReplyBlockReason,
	type ThreadReviewNode,
} from "@/lib/resume-thread";
import { CommentComposer } from "./comment-composer";
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
	const hasReplies = replyCount > 0;
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
	const replyNoun = replyCount === 1 ? "reply" : "replies";
	const threadToggleLabel = isCollapsed
		? `Show ${replyCount} ${replyNoun}`
		: `Hide ${replyCount} ${replyNoun}`;
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
			className={`thread-roast-node${review.depth > 0 ? " is-nested" : ""}${
				hasReplies ? " has-replies" : ""
			}${isCollapsed ? " is-collapsed" : ""}`}
			data-thread-collapsed={hasReplies ? String(isCollapsed) : undefined}
			data-thread-depth={review.depth}
			data-thread-has-replies={hasReplies ? "true" : undefined}
			data-thread-parent-id={review.parent_id ?? undefined}
			data-thread-roast-id={review.id}
			id={`comment-${review.id}`}
			key={review.id}
			role="listitem"
		>
			<span aria-hidden="true" className="thread-rail-end-mask" />
			{review.depth > 0 ? (
				<svg
					aria-hidden="true"
					className="thread-branch-curve"
					focusable="false"
					preserveAspectRatio="none"
					viewBox="0 0 44 12"
				>
					<path d="M0 0 C0 6.63 5.37 12 12 12 H44" />
				</svg>
			) : null}
			{hasReplies ? (
				<button
					aria-expanded={!isCollapsed}
					aria-label={threadToggleLabel}
					className="thread-rail-button"
					onClick={() => onToggleReplies(review.id)}
					title={threadToggleLabel}
					type="button"
				>
					<span className="thread-rail-stem" />
				</button>
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
						{hasReplies ? (
							<button
								aria-expanded={!isCollapsed}
								aria-label={threadToggleLabel}
								className="thread-rail-toggle"
								onClick={() => onToggleReplies(review.id)}
								title={threadToggleLabel}
								type="button"
							>
								<span aria-hidden="true">{isCollapsed ? "+" : "-"}</span>
								<span className="sr-only">{threadToggleLabel}</span>
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
							<CommentComposer
								attachment={replyAttachment}
								autoFocus
								className="comment-composer-reply"
								contentFormat={replyContentFormat}
								disabledTools={
									!mediaSchemaReady || submittingReplyId === review.id
								}
								maxHeight={220}
								minHeight={66}
								onAttachmentChange={onReplyAttachmentChange}
								onCancel={onCancelReply}
								onChange={onReplyContentChange}
								onFormatChange={onReplyFormatChange}
								onRequireLogin={onRequireLogin}
								placeholder={`Reply to ${authorHandle}`}
								submitDisabled={submittingReplyId === review.id}
								submitLabel={
									submittingReplyId === review.id ? "Posting..." : "Post reply"
								}
								value={replyContent}
							/>
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
