import Link from "next/link";
import {
	Loader2,
	MessageCircle,
	MoreHorizontal,
	Share2,
	Trash2,
} from "@/components/ui/solar-icons";
import { toast } from "sonner";
import ReactionIcon from "@/components/reactions/ReactionIcon";
import { Button } from "@/components/ui/button";
import type { MentionSuggestion } from "@/lib/comment-mentions";
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

type ThreadReviewItemProps = ThreadReviewControls & {
	mentionSuggestions: MentionSuggestion[];
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
	mentionSuggestions,
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
	const likeButtonClass = `comment-action-button reaction-button is-like${
		voted ? " is-active" : ""
	}`;
	const dislikeButtonClass = `comment-action-button reaction-button is-dislike${
		disliked ? " is-active" : ""
	}`;
	const childReviewProps: Omit<ThreadReviewItemProps, "review"> = {
		attachmentsById,
		authorProfiles,
		collapsedReviewIds,
		deleteSchemaReady,
		deletingReviewId,
		dislikedReviewIds,
		isClosed,
		likedReviewIds,
		mediaSchemaReady,
		mentionSuggestions,
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

	async function shareReviewLink() {
		const anchor = `comment-${review.id}`;
		const shareUrl =
			typeof window === "undefined"
				? `#${anchor}`
				: `${window.location.origin}${window.location.pathname}#${anchor}`;

		try {
			if (typeof navigator !== "undefined" && navigator.share) {
				await navigator.share({
					title: "Linted feedback",
					url: shareUrl,
				});
				toast.success("Share sheet opened.");
				return;
			}

			if (typeof navigator !== "undefined" && navigator.clipboard) {
				await navigator.clipboard.writeText(shareUrl);
				toast.success("Comment link copied.");
				return;
			}
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") {
				return;
			}
		}

		toast.error("Could not share this comment.");
	}

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
						<div className="comment-author-stack">
							<div className="comment-author-primary-row">
								{isDeleted ? (
									<span className="deleted-author-chip">Deleted reviewer</span>
								) : (
									<Button asChild className="comment-author-chip" size="sm">
										<Link href={`/profile/${review.author_id}`}>
											{authorHandle}
										</Link>
									</Button>
								)}
								<time dateTime={review.created_at}>
									&middot; {formatDate(review.created_at)}
								</time>
							</div>
							{isDeleted ? null : (
								<div className="comment-author-badge-row">
									<ReviewerTrustChip profile={authorProfile} />
									{review.helpful_votes > 5 ? (
										<span className="badge badge-open reviewer-meta-chip">
											Verified helpful
										</span>
									) : null}
								</div>
							)}
						</div>
					</header>
					<FormattedReviewContent
						content={review.content}
						format={review.content_format}
						isDeleted={isDeleted}
						mentionSuggestions={mentionSuggestions}
					/>
					<ReviewAttachment attachment={reviewAttachment} />
					<footer>
						{isDeleted ? null : (
							<div className="comment-reactions">
								<button
									aria-label={
										voted
											? "Remove like from this review"
											: "Like this review"
									}
									aria-pressed={voted}
									className={likeButtonClass}
									disabled={reactionDisabled}
									onClick={() => onReactToReview(review, "like")}
									type="button"
									title={reactionBlockReason ?? undefined}
								>
									<ReactionIcon active={voted} direction="up" />
									<span className="reaction-count">{review.helpful_votes}</span>
								</button>
								<button
									aria-label={
										disliked
											? "Remove dislike from this review"
											: "Dislike this review"
									}
									aria-pressed={disliked}
									className={dislikeButtonClass}
									disabled={reactionDisabled}
									onClick={() => onReactToReview(review, "dislike")}
									type="button"
									title={reactionBlockReason ?? undefined}
								>
									<ReactionIcon active={disliked} direction="down" />
									<span className="reaction-count">
										{review.dislike_count ?? 0}
									</span>
								</button>
							</div>
						)}
						{isDeleted ? null : (
							<button
								aria-label={`Reply to ${authorHandle}`}
								className="comment-action-button"
								disabled={!canReply}
								title={replyBlockReason ?? undefined}
								onClick={() => {
									if (!canReply) return;
									onReplyToggle(review.id);
								}}
								type="button"
							>
								<MessageCircle aria-hidden="true" />
								<span className="comment-action-label">Reply</span>
							</button>
						)}
						{isDeleted ? null : (
							<button
								aria-label="Share this comment"
								className="comment-action-button"
								onClick={() => {
									void shareReviewLink();
								}}
								title="Share"
								type="button"
							>
								<Share2 aria-hidden="true" />
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
								aria-label={review.parent_id ? "Delete reply" : "Delete comment"}
								className="comment-action-button comment-delete-button"
								disabled={!deleteSchemaReady || deletingReviewId === review.id}
								onClick={() => onDeleteReviewRequest(review)}
								title={
									deleteSchemaReady
										? undefined
										: `${SUPABASE_MIGRATION_MESSAGE} Deletes are not ready yet.`
								}
								type="button"
							>
								{deletingReviewId === review.id ? (
									<Loader2 className="spin-icon" aria-hidden="true" />
								) : (
									<Trash2 aria-hidden="true" />
								)}
							</button>
						) : null}
						{!isDeleted && !isOwnReview ? (
							<button
								aria-label="More comment actions"
								className="comment-action-button comment-more-button"
								disabled={!reportSchemaReady}
								onClick={() => onOpenReportDialog(review)}
								title={
									reportSchemaReady
										? undefined
										: `${SUPABASE_MIGRATION_MESSAGE} Reports are not ready yet.`
								}
								type="button"
							>
								<MoreHorizontal aria-hidden="true" />
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
								minHeight={56}
								mentionSuggestions={mentionSuggestions}
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
					hidden={isCollapsed}
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
