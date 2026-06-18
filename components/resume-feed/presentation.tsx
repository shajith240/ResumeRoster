"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	Bookmark,
	BookmarkFilled,
	Check,
	ChevronDown,
	Eye,
	MessageCircle,
	Share2,
} from "@/components/ui/solar-icons";
import FeedResumePreview from "@/components/FeedResumePreview";
import FeedSkeleton from "@/components/feed/FeedSkeleton";
import RecentPostsPanel from "@/components/RecentPostsPanel";
import { PresenceAvatar } from "@/components/user-presence/PresenceAvatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCount, type FeedSort } from "@/lib/feed-ranking";
import {
	getResumeAffiliationLabel,
	getResumePosterLabel,
	getResumeRoleLabel,
} from "@/lib/resume-display";
import {
	getSaveButtonState,
	type SaveButtonPendingAction,
} from "@/lib/saved-resumes";
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
	onShare: (resume: ResumeSummary) => void;
	onToggleSaved: (resume: SavedResumeSummary) => void;
	previewUrl?: string;
	previewUrlsLoading: boolean;
	resume: SavedResumeSummary;
	reviewPreview?: ReviewPreview;
	savePendingAction: SaveButtonPendingAction | null;
};

export { FeedSkeleton };

export function FeedEmptyState({ savedOnly }: FeedEmptyStateProps) {
	if (savedOnly) {
		return (
			<div className="empty-state feed-empty-state">
				<h2>No saved resumes yet</h2>
				<p>
					Save resumes from the Resume Feed when you want to revisit their fixes
					later.
				</p>
				<Link className="btn-primary" href="/feed">
					Browse Resume Feed
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
	const router = useRouter();
	const activeOption = savedOnly
		? { label: "Saved", shortLabel: "Saved", value: "saved" }
		: sortOptions.find((option) => option.value === activeSort) ?? sortOptions[0];

	return (
		<nav className="feed-sortbar feed-toolbar" aria-label="Feed sort">
			<RecentPostsPanel kind="resume" surface="mobile-trigger" />
			<DropdownMenu modal={false}>
				<DropdownMenuTrigger
					aria-label={`Sort resumes by ${activeOption.label}`}
					className="feed-sort-trigger"
				>
					<span>{activeOption.shortLabel ?? activeOption.label}</span>
					<ChevronDown aria-hidden="true" />
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="start"
					className="feed-sort-menu reddit-select-content"
					sideOffset={8}
				>
					{sortOptions.map((option) => {
						const isActive = !savedOnly && activeSort === option.value;

						return (
							<DropdownMenuItem
								aria-current={isActive ? "page" : undefined}
								className={`feed-sort-menu-item${isActive ? " is-active" : ""}`}
								key={option.value}
								onSelect={() => {
									router.push(option.href);
								}}
							>
								<span>{option.label}</span>
								{isActive ? <Check aria-hidden="true" /> : null}
							</DropdownMenuItem>
						);
					})}
					<DropdownMenuItem
						aria-current={savedOnly ? "page" : undefined}
						className={`feed-sort-menu-item${savedOnly ? " is-active" : ""}`}
						onSelect={() => {
							router.push("/feed?saved=1");
						}}
					>
						<span>Saved</span>
						{savedOnly ? <Check aria-hidden="true" /> : null}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</nav>
	);
}

function getResumeAuthorAvatar(
	resume: SavedResumeSummary,
	profile: SavedResumeSummary["author_profile"],
) {
	if (!resume.is_anonymous && profile?.avatar_url?.trim()) {
		return profile.avatar_url.trim();
	}

	const seed =
		(!resume.is_anonymous &&
			(profile?.full_name?.trim() || profile?.username?.trim())) ||
		resume.id;

	return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed)}`;
}

export function ResumeFeedCard({
	copiedId,
	index,
	onShare,
	onToggleSaved,
	previewUrl,
	previewUrlsLoading,
	resume,
	reviewPreview,
	savePendingAction,
}: ResumeFeedCardProps) {
	const authorProfile = resume.author_profile ?? null;
	const posterLabel = getResumePosterLabel(resume, authorProfile);
	const authorAvatar = getResumeAuthorAvatar(resume, authorProfile);
	const isSaving = Boolean(savePendingAction);
	const saveButtonState = getSaveButtonState(resume.is_saved, savePendingAction);
	const SaveIcon = resume.is_saved ? BookmarkFilled : Bookmark;
	const saveIconClass = `post-action-icon save-icon ${
		resume.is_saved ? "save-icon-filled" : "save-icon-outline"
	}`;
	const reviewSignal = getReviewSignal(resume);
	const threadActionLabel = getThreadActionLabel(resume);
	const snippet =
		resume.post_description?.trim() ||
		"Targeting recruiter screens with a resume that needs sharper bullets, clearer proof, and fewer weak first impressions.";
	const authorAvatarImage = (
		<img
			alt=""
			aria-hidden="true"
			className="post-author-avatar"
			height={24}
			src={authorAvatar}
			width={24}
		/>
	);

	return (
		<article
			className="resume-card"
			style={{ animationDelay: `${index * 50}ms` }}
			key={resume.id}
		>
			<div className="post-content">
				<div className="post-meta">
					<div className="post-meta-main">
						<span className="post-author-cluster">
							{resume.is_anonymous ? (
								authorAvatarImage
							) : (
								<PresenceAvatar isOnline={authorProfile?.is_online} size="sm">
									{authorAvatarImage}
								</PresenceAvatar>
							)}
							{resume.is_anonymous ? (
								<span className="post-author-name">{posterLabel}</span>
							) : (
								<Link className="post-author-link" href={`/profile/${resume.user_id}`}>
									{posterLabel}
								</Link>
							)}
						</span>
						<time dateTime={resume.created_at}>{formatDate(resume.created_at)}</time>
						<span
							aria-label={`${formatCount(resume.read_count)} reads`}
							className="post-read-count"
						>
							<Eye className="post-meta-icon" size={15} aria-hidden="true" />
							{formatCount(resume.read_count)}
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
					{resume.is_premium ? (
						<span className="badge premium-badge">Priority review</span>
					) : null}
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
						<Share2 className="post-action-icon" size={16} aria-hidden="true" />
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
						<SaveIcon className={saveIconClass} size={16} aria-hidden="true" />
						<span className="post-action-label">{saveButtonState.label}</span>
					</button>
				</div>
			</div>
		</article>
	);
}
