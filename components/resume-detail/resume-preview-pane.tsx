"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { Trash } from "@/components/ui/solar-icons";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { PresenceAvatar } from "@/components/user-presence/PresenceAvatar";
import {
	getResumeAffiliationLabel,
	getResumeRoleLabel,
} from "@/lib/resume-display";
import type {
	ResumeAuthorProfile,
	ResumeSummary,
} from "@/lib/supabase/types";
import { formatDate } from "./utils";

const SecureResumePreview = dynamic(
	() => import("@/components/SecureResumePreview"),
	{
		loading: () => (
			<div className="secure-resume-loading">
				Preparing protected preview...
			</div>
		),
		ssr: false,
	},
);

type ResumePreviewPaneProps = {
	isClosed: boolean;
	isOwner: boolean;
	onLogin: () => void;
	onOpenFile: () => void;
	onReplacePdf: (file: File) => void;
	onRequestDelete: () => void;
	onRequestStatusChange: () => void;
	posterLabel: string;
	replacingPdf: boolean;
	resume: ResumeSummary;
	resumeActionBusy: boolean;
	resumeAuthorProfile: ResumeAuthorProfile | null;
	signedUrl: string;
	signedUrlError: string;
	user: User | null;
};

function getResumeDetailAuthorAvatar(
	resume: ResumeSummary,
	profile: ResumeAuthorProfile | null,
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

export function ResumePreviewPane({
	isClosed,
	isOwner,
	onLogin,
	onOpenFile,
	onReplacePdf,
	onRequestDelete,
	onRequestStatusChange,
	posterLabel,
	replacingPdf,
	resume,
	resumeActionBusy,
	resumeAuthorProfile,
	signedUrl,
	signedUrlError,
	user,
}: ResumePreviewPaneProps) {
	const authorAvatar = getResumeDetailAuthorAvatar(resume, resumeAuthorProfile);
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
		<article className="thread-viewer-card resume-preview-pane">
			<header className="thread-header">
				<div className="post-meta resume-detail-meta">
					<div className="post-meta-main">
						<span className="post-author-cluster">
							{resume.is_anonymous ? (
								authorAvatarImage
							) : (
								<PresenceAvatar isOnline={resumeAuthorProfile?.is_online} size="sm">
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
					</div>
				</div>
				<div className="thread-header-actions">
					<span className={`badge ${isClosed ? "badge-closed" : "badge-open"}`}>
						{isClosed ? "Closed" : "Open for review"}
					</span>
					{isOwner ? (
						<div className="owner-actions">
							<Button
								disabled={resumeActionBusy}
								onClick={onRequestStatusChange}
								type="button"
								variant="outline"
							>
								{isClosed ? "Reopen feedback" : "Close feedback"}
							</Button>
							<label className="replace-pdf-label">
								<input
									accept=".pdf,application/pdf"
									className="sr-only"
									disabled={replacingPdf || resumeActionBusy}
									onChange={(e) => {
										const file = e.target.files?.[0];
										if (file) onReplacePdf(file);
										e.target.value = "";
									}}
									type="file"
								/>
								<span
									aria-disabled={replacingPdf || resumeActionBusy}
									className={`btn-ghost replace-pdf-btn${replacingPdf ? " busy" : ""}`}
									role="button"
								>
									{replacingPdf ? "Replacing…" : "Replace PDF"}
								</span>
							</label>
							<Button
								className="owner-delete-button"
								disabled={resumeActionBusy}
								onClick={onRequestDelete}
								type="button"
								variant="destructive"
							>
								<Trash
									className="-ms-1 me-2 opacity-70"
									size={16}
									aria-hidden="true"
								/>
								Delete submission
							</Button>
						</div>
					) : null}
				</div>
			</header>

			<h1 className="resume-detail-title">{resume.title}</h1>
			<div className="post-tags">
				<span className="badge role-badge">
					{getResumeRoleLabel(resume, resumeAuthorProfile)}
				</span>
				<span className="badge neutral-badge">
					{getResumeAffiliationLabel(resume, resumeAuthorProfile)}
				</span>
			</div>

			{signedUrl ? (
				<SecureResumePreview
					fileUrl={signedUrl}
					privacyMode={
						resume.privacy_mode ?? (resume.is_anonymous ? "anonymous" : "public")
					}
					title={resume.title}
				/>
			) : user ? (
				<div className="locked-file">
					<p>
						{signedUrlError
							? "We could not open this private resume file yet. If this is a different account, update the Supabase Storage read policy and retry."
							: "Opening the private resume PDF for your signed-in account."}
					</p>
					<button className="btn-primary" onClick={onOpenFile}>
						Retry opening PDF
					</button>
					{signedUrlError ? (
						<p className="form-message">{signedUrlError}</p>
					) : null}
				</div>
			) : (
				<div className="locked-file">
					<p>Sign in to open the private resume PDF.</p>
					<button className="btn-primary" onClick={onLogin}>
						Sign in to continue
					</button>
				</div>
			)}
		</article>
	);
}
