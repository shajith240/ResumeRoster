import Link from "next/link";
import { Trash } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import SecureResumePreview from "@/components/SecureResumePreview";
import { Button } from "@/components/ui/button";
import {
	getResumeAffiliationLabel,
	getResumeRoleLabel,
} from "@/lib/resume-display";
import type {
	ResumeAuthorProfile,
	ResumeSummary,
} from "@/lib/supabase/types";
import { formatDate } from "./utils";

type ResumePreviewPaneProps = {
	isClosed: boolean;
	isOwner: boolean;
	onLogin: () => void;
	onOpenFile: () => void;
	onRequestDelete: () => void;
	onRequestStatusChange: () => void;
	posterLabel: string;
	resume: ResumeSummary;
	resumeActionBusy: boolean;
	resumeAuthorProfile: ResumeAuthorProfile | null;
	signedUrl: string;
	signedUrlError: string;
	user: User | null;
};

export function ResumePreviewPane({
	isClosed,
	isOwner,
	onLogin,
	onOpenFile,
	onRequestDelete,
	onRequestStatusChange,
	posterLabel,
	resume,
	resumeActionBusy,
	resumeAuthorProfile,
	signedUrl,
	signedUrlError,
	user,
}: ResumePreviewPaneProps) {
	return (
		<article className="thread-viewer-card resume-preview-pane">
			<header className="thread-header">
				<div className="post-meta">
					{resume.is_anonymous ? (
						<span>{posterLabel}</span>
					) : (
						<Link className="post-author-link" href={`/profile/${resume.user_id}`}>
							{posterLabel}
						</Link>
					)}
					<time dateTime={resume.created_at}>
						{formatDate(resume.created_at)}
					</time>
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
									strokeWidth={2}
									aria-hidden="true"
								/>
								Delete submission
							</Button>
						</div>
					) : null}
				</div>
			</header>

			<h1>{resume.title}</h1>
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
