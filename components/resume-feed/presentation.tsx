import Link from "next/link";
import { Bookmark, Eye, Link2, MessageCircle } from "lucide-react";
import FeedResumePreview from "@/components/FeedResumePreview";
import { formatCount, type FeedSort } from "@/lib/feed-ranking";
import {
	getResumeAffiliationLabel,
	getResumePosterLabel,
	getResumeRoleLabel,
} from "@/lib/resume-display";
import { getSaveButtonState } from "@/lib/saved-resumes";
import type { ResumeSummary } from "@/lib/supabase/types";
import {
	formatDate,
	getReviewSignal,
	getThreadActionAria,
	getThreadActionLabel,
	getThreadPrompt,
	sortOptions,
	type ReviewPreview,
	type SavedResumeSummary,
} from "./data";

type FeedSortBarProps = {
	activeSort: FeedSort;
	savedOnly: boolean;
};

type FeedEmptyStateProps = {
	savedOnly: boolean;
};

type ResumeFeedCardProps = {
	copiedId: string;
	index: number;
	isSaving: boolean;
	onShare: (resume: ResumeSummary) => void;
	onToggleSaved: (resume: SavedResumeSummary) => void;
	previewUrl?: string;
	previewUrlsLoading: boolean;
	resume: SavedResumeSummary;
	reviewPreview?: ReviewPreview;
};

export function FeedSkeleton() {
	return (
		<div className="feed-skeleton-list" aria-label="Loading feed">
			{[0, 1, 2].map((item) => (
				<article className="resume-card skeleton-card" key={item}>
					<div className="post-content">
						<span className="skeleton skeleton-line meta" />
						<span className="skeleton skeleton-line title" />
						<span className="skeleton skeleton-line tags" />
						<span className="skeleton skeleton-line preview" />
						<span className="skeleton skeleton-line copy" />
						<span className="skeleton skeleton-line actions" />
					</div>
				</article>
			))}
		</div>
	);
}

export function FeedEmptyState({ savedOnly }: FeedEmptyStateProps) {
	if (savedOnly) {
		return (
			<div className="empty-state feed-empty-state">
				<h2>No saved resumes yet</h2>
				<p>Save resumes from the feed when you want to revisit their fixes later.</p>
				<Link className="btn-primary" href="/feed">
					Browse feed
				</Link>
			</div>
		);
	}

	return (
		<div className="empty-state feed-empty-state">
			<h2>No resumes yet</h2>
			<p>
				Be the first person brave enough to run a resume through the public lint
				pass.
			</p>
			<Link className="btn-primary" href="/submit">
				Submit a resume
			</Link>
		</div>
	);
}

export function FeedSortBar({ activeSort, savedOnly }: FeedSortBarProps) {
	return (
		<nav className="feed-sortbar pill-tabs" aria-label="Feed sort">
			{sortOptions.map((option) => (
				<Link
					aria-current={!savedOnly && activeSort === option.value ? "page" : undefined}
					className={!savedOnly && activeSort === option.value ? "active" : ""}
					href={option.href}
					key={option.value}
				>
					<span className="sort-label-full">{option.label}</span>
					<span className="sort-label-short">
						{option.shortLabel ?? option.label}
					</span>
				</Link>
			))}
			<Link
				aria-current={savedOnly ? "page" : undefined}
				className={savedOnly ? "active" : ""}
				href="/feed?saved=1"
			>
				<span className="sort-label-full">Saved</span>
				<span className="sort-label-short">Saved</span>
			</Link>
		</nav>
	);
}

export function ResumeFeedCard({
	copiedId,
	index,
	isSaving,
	onShare,
	onToggleSaved,
	previewUrl,
	previewUrlsLoading,
	resume,
	reviewPreview,
}: ResumeFeedCardProps) {
	const authorProfile = resume.author_profile ?? null;
	const posterLabel = getResumePosterLabel(resume, authorProfile);
	const saveButtonState = getSaveButtonState(resume.is_saved, isSaving);
	const reviewSignal = getReviewSignal(resume);
	const threadActionLabel = getThreadActionLabel(resume);
	const snippet =
		resume.post_description?.trim() ||
		"Targeting recruiter screens with a resume that needs sharper bullets, clearer proof, and fewer weak first impressions.";

	return (
		<article
			className="resume-card"
			style={{ animationDelay: `${index * 50}ms` }}
			key={resume.id}
		>
			<div className="post-content">
				<div className="post-meta">
					<div className="post-meta-main">
						{resume.is_anonymous ? (
							<span>{posterLabel}</span>
						) : (
							<Link className="post-author-link" href={`/profile/${resume.user_id}`}>
								{posterLabel}
							</Link>
						)}
						<time dateTime={resume.created_at}>{formatDate(resume.created_at)}</time>
						<span className="post-read-count">
							<Eye className="post-meta-icon" size={15} aria-hidden="true" />
							{formatCount(resume.read_count)} reads
						</span>
					</div>
					<span className={`feed-status-pill ${reviewSignal.className}`}>
						{reviewSignal.label}
					</span>
				</div>
				<div className="feed-title-row">
					<Link className="post-title-link" href={`/resume/${resume.id}`}>
						<h2>{resume.title}</h2>
					</Link>
				</div>

				<div className="post-tags">
					<span className="badge role-badge">
						{getResumeRoleLabel(resume, authorProfile)}
					</span>
					<span className="badge neutral-badge">
						{getResumeAffiliationLabel(resume, authorProfile)}
					</span>
				</div>

				<div className="feed-card-body">
					<div className="feed-review-summary">
						<span className="feed-section-label">Review request</span>
						<p className="feed-snippet">{snippet}</p>
						<Link
							className={`feed-thread-preview ${
								reviewPreview ? "has-review" : "needs-review"
							}`}
							href={`/resume/${resume.id}`}
						>
							<span className="feed-thread-label">
								{reviewPreview?.label ??
									(resume.roast_count > 0
										? "Discussion started"
										: "Needs reviewer")}
							</span>
							<p>{reviewPreview?.excerpt ?? getThreadPrompt(resume)}</p>
						</Link>
					</div>

					<Link
						aria-label={`Open resume preview for ${resume.title}`}
						className="feed-preview-link"
						href={`/resume/${resume.id}`}
					>
						<FeedResumePreview
							fileUrl={previewUrl}
							isLoading={previewUrlsLoading}
							title={resume.title}
						/>
					</Link>
				</div>

				<div className="post-actions">
					<Link
						className="post-action-button"
						href={`/resume/${resume.id}`}
						aria-label={getThreadActionAria(resume)}
					>
						<MessageCircle
							className="post-action-icon"
							size={16}
							aria-hidden="true"
						/>
						{resume.roast_count > 0 ? (
							<span className="post-action-count">
								{formatCount(resume.roast_count)}
							</span>
						) : null}
						<span className="post-action-label">{threadActionLabel}</span>
					</Link>
					<button
						className="post-action-button copy-button"
						type="button"
						onClick={() => onShare(resume)}
						aria-label="Share resume"
					>
						<Link2 className="post-action-icon" size={16} aria-hidden="true" />
						<span className="post-action-label">Share</span>
						{copiedId === resume.id ? <em>Copied!</em> : null}
					</button>
					<button
						aria-label={saveButtonState.ariaLabel}
						aria-pressed={resume.is_saved}
						className={`post-action-button save-button ${
							resume.is_saved ? "is-saved" : ""
						}`}
						disabled={isSaving}
						onClick={() => onToggleSaved(resume)}
						type="button"
					>
						<Bookmark className="post-action-icon" size={16} aria-hidden="true" />
						<span className="post-action-label">{saveButtonState.label}</span>
					</button>
				</div>
			</div>
		</article>
	);
}
