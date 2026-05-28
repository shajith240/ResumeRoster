"use client";

import {
	type CSSProperties,
	FormEvent,
	type ReactNode,
	useEffect,
	useMemo,
	useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThumbsDown, ThumbsUp, Trash } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import CommentMediaToolbar, {
	type CommentAttachmentOption,
} from "@/components/CommentMediaToolbar";
import { announceRouteTransition } from "@/components/RouteTransitionLoader";
import SecureResumePreview from "@/components/SecureResumePreview";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	getReportIssue,
	REPORT_DETAILS_MAX_LENGTH,
	REPORT_REASON_OPTIONS,
	type ReportReason,
} from "@/lib/report-validation";
import { getRoastContentIssue } from "@/lib/comment-media-validation";
import {
	getResumeAffiliationLabel,
	getResumePosterLabel,
	getResumeRoleLabel,
} from "@/lib/resume-display";
import {
	canShowReviewerProfile,
	getReviewerDisplayLabel,
	isTrustedReviewer,
} from "@/lib/reviewer-validation";
import {
	buildThreadRoastTree,
	getReactionBlockReason,
	getReplyBlockReason,
	normalizeRoast,
	type ThreadRoastNode,
} from "@/lib/resume-thread";
import { getLoginPath } from "@/lib/auth-redirect";
import { supabase } from "@/lib/supabase/client";
import type {
	CommentAttachment,
	CommentContentFormat,
	CommunityRole,
	ResumeAuthorProfile,
	ResumeSummary,
	ReviewerType,
	ReviewerVerificationStatus,
	Roast,
} from "@/lib/supabase/types";
import { toast } from "sonner";

type ResumeDetailProps = {
	resumeId: string;
};

type Reaction = "like" | "dislike";

type AuthorProfile = {
	id: string;
	username: string | null;
	full_name: string | null;
	community_role?: CommunityRole | null;
	reviewer_type?: ReviewerType | null;
	reviewer_headline?: string | null;
	reviewer_expertise?: string[] | null;
	reviewer_verification_status?: ReviewerVerificationStatus | null;
};

type ResumeRowWithDefaults = Omit<
	ResumeSummary,
	"read_count" | "job_description" | "post_description"
> &
	Partial<
		Pick<ResumeSummary, "read_count" | "job_description" | "post_description">
	>;

type ResumeQueryResult = {
	data: ResumeRowWithDefaults | null;
	error: { message?: string } | null;
};

const ROAST_SELECT_WITH_MEDIA =
	"id,resume_id,parent_id,author_id,content,attachment_id,content_format,helpful_votes,dislike_count,reply_count,is_deleted,deleted_at,created_at";
const ROAST_SELECT_WITH_THREADS =
	"id,resume_id,parent_id,author_id,content,helpful_votes,dislike_count,reply_count,is_deleted,deleted_at,created_at";
const ROAST_SELECT_WITH_THREADS_LEGACY =
	"id,resume_id,parent_id,author_id,content,helpful_votes,dislike_count,reply_count,created_at";
const ROAST_SELECT_WITH_REACTIONS =
	"id,resume_id,author_id,content,helpful_votes,dislike_count,created_at";
const ROAST_SELECT_BASE =
	"id,resume_id,author_id,content,helpful_votes,created_at";
const RESUME_SELECT_WITH_CONTEXT =
	"id,user_id,title,file_path,is_anonymous,privacy_mode,status,roast_count,read_count,job_description,post_description,created_at";
const RESUME_SELECT_WITH_READS =
	"id,user_id,title,file_path,is_anonymous,privacy_mode,status,roast_count,read_count,created_at";
const RESUME_SELECT_BASE =
	"id,user_id,title,file_path,is_anonymous,status,roast_count,created_at";
const RESUME_AUTHOR_PROFILE_SELECT_WITH_STATUS =
	"id,username,full_name,avatar_url,avatar_path,college,target_role,current_position,app_status,community_role,reviewer_type,reviewer_headline,reviewer_expertise,reviewer_verification_status";
const RESUME_AUTHOR_PROFILE_SELECT_BASE =
	"id,username,full_name,avatar_url,college,target_role";
const SUPABASE_MIGRATION_MESSAGE =
	"Run the pending Supabase migrations, then refresh.";

function formatDate(value: string) {
	return new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
	}).format(new Date(value));
}

function getAuthorHandle(authorId: string, profile?: AuthorProfile) {
	const name =
		profile?.username ||
		profile?.full_name ||
		`reviewer-${authorId.slice(0, 8)}`;
	return name.startsWith("@") ? name : `@${name}`;
}

function getAuthorAvatar(authorId: string, profile?: AuthorProfile) {
	const seed = profile?.full_name || profile?.username || authorId;
	return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed)}`;
}

function ReviewerTrustChip({ profile }: { profile?: AuthorProfile }) {
	if (!canShowReviewerProfile(profile?.community_role, profile?.reviewer_type)) {
		return null;
	}

	const trusted = isTrustedReviewer(profile?.reviewer_verification_status);

	return (
		<span
			className={`reviewer-trust-chip${trusted ? " is-trusted" : ""}`}
			title={
				trusted
					? "Admin-approved trusted reviewer"
					: "Self-described reviewer role"
			}
		>
			{getReviewerDisplayLabel(profile ?? {})}
		</span>
	);
}

function isMissingColumnError(error: { message?: string } | null, column: string) {
	return Boolean(error?.message?.toLowerCase().includes(column.toLowerCase()));
}

function isReadCountFeatureError(error: { message?: string } | null) {
	return /read_count|record_resume_read|schema cache|column|function/i.test(
		error?.message ?? "",
	);
}

function isDeleteFeatureError(error: { message?: string } | null) {
	return /is_deleted|deleted_at|delete_roast|schema cache|column|function/i.test(
		error?.message ?? "",
	);
}

function isReportFeatureError(error: { message?: string } | null) {
	return /content_reports|report_content|schema cache|column|function/i.test(
		error?.message ?? "",
	);
}

function isCommentMediaFeatureError(error: { message?: string } | null) {
	return /comment_attachments|attachment_id|content_format|schema cache|column|relation/i.test(
		error?.message ?? "",
	);
}

function isResumeContextFeatureError(error: { message?: string } | null) {
	return /job_description|post_description|read_count|schema cache|column/i.test(
		error?.message ?? "",
	);
}

function isAuthorProfileFeatureError(error: { message?: string } | null) {
	return /app_status|current_position|avatar_path|community_role|reviewer_|schema cache|column/i.test(
		error?.message ?? "",
	);
}

function withResumeDefaults(resume: ResumeRowWithDefaults): ResumeSummary {
	return {
		...resume,
		read_count: resume.read_count ?? 0,
		job_description: resume.job_description ?? null,
		post_description: resume.post_description ?? null,
	};
}

function ResumeContextCard({
	eyebrow,
	title,
	content,
	emptyMessage,
}: {
	eyebrow: string;
	title: string;
	content: string;
	emptyMessage: string;
}) {
	const normalizedContent = content.trim();

	return (
		<section
			className={`resume-context-card${normalizedContent ? "" : " is-empty"}`}
		>
			<span>{eyebrow}</span>
			<h2>{title}</h2>
			<p>{normalizedContent || emptyMessage}</p>
		</section>
	);
}

function renderInlineMarkdown(text: string, keyPrefix: string) {
	const parts: ReactNode[] = [];
	const pattern =
		/(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	while ((match = pattern.exec(text))) {
		if (match.index > lastIndex) {
			parts.push(text.slice(lastIndex, match.index));
		}

		const key = `${keyPrefix}-${match.index}`;
		if (match[2] && match[3]) {
			parts.push(
				<a
					href={match[3]}
					key={key}
					rel="noopener noreferrer"
					target="_blank"
				>
					{match[2]}
				</a>,
			);
		} else if (match[4]) {
			parts.push(<code key={key}>{match[4]}</code>);
		} else if (match[5]) {
			parts.push(<strong key={key}>{match[5]}</strong>);
		} else if (match[6]) {
			parts.push(<em key={key}>{match[6]}</em>);
		}

		lastIndex = pattern.lastIndex;
	}

	if (lastIndex < text.length) {
		parts.push(text.slice(lastIndex));
	}

	return parts;
}

function FormattedRoastContent({
	content,
	format,
	isDeleted,
}: {
	content: string;
	format?: CommentContentFormat;
	isDeleted: boolean;
}) {
	if (isDeleted) {
		return (
			<p className="deleted-roast-copy">
				This comment was deleted by its author.
			</p>
		);
	}

	if (format !== "markdown") {
		return <p>{content}</p>;
	}

	const lines = content.split(/\r?\n/);
	const nodes: ReactNode[] = [];
	let bulletItems: string[] = [];

	function flushBullets(index: number) {
		if (!bulletItems.length) return;

		nodes.push(
			<ul key={`ul-${index}`}>
				{bulletItems.map((item, itemIndex) => (
					<li key={`${index}-${itemIndex}`}>
						{renderInlineMarkdown(item, `${index}-${itemIndex}`)}
					</li>
				))}
			</ul>,
		);
		bulletItems = [];
	}

	lines.forEach((line, index) => {
		const trimmed = line.trim();

		if (!trimmed) {
			flushBullets(index);
			return;
		}

		if (trimmed.startsWith("- ")) {
			bulletItems.push(trimmed.slice(2).trim());
			return;
		}

		flushBullets(index);

		if (trimmed.startsWith("> ")) {
			nodes.push(
				<blockquote key={`quote-${index}`}>
					{renderInlineMarkdown(trimmed.slice(2).trim(), `quote-${index}`)}
				</blockquote>,
			);
			return;
		}

		nodes.push(
			<p key={`p-${index}`}>
				{renderInlineMarkdown(trimmed, `p-${index}`)}
			</p>,
		);
	});

	flushBullets(lines.length);

	return <div className="comment-markdown">{nodes}</div>;
}

function getAttachmentUrl(attachment?: CommentAttachmentOption | null) {
	return attachment?.publicUrl || "";
}

function RoastAttachment({
	attachment,
}: {
	attachment?: CommentAttachmentOption | null;
}) {
	const url = getAttachmentUrl(attachment);
	if (!attachment || !url) return null;

	return (
		<figure className="roast-attachment">
			<img alt={attachment.alt_text || attachment.title} src={url} />
		</figure>
	);
}

export default function ResumeDetail({ resumeId }: ResumeDetailProps) {
	const router = useRouter();
	const [user, setUser] = useState<User | null>(null);
	const [resume, setResume] = useState<ResumeSummary | null>(null);
	const [resumeAuthorProfile, setResumeAuthorProfile] =
		useState<ResumeAuthorProfile | null>(null);
	const [roasts, setRoasts] = useState<Roast[]>([]);
	const [authorProfiles, setAuthorProfiles] = useState<
		Record<string, AuthorProfile>
	>({});
	const [votedRoastIds, setVotedRoastIds] = useState<Set<string>>(new Set());
	const [dislikedRoastIds, setDislikedRoastIds] = useState<Set<string>>(
		new Set(),
	);
	const [signedUrl, setSignedUrl] = useState("");
	const [signedUrlError, setSignedUrlError] = useState("");
	const [content, setContent] = useState("");
	const [replyContent, setReplyContent] = useState("");
	const [contentFormat, setContentFormat] =
		useState<CommentContentFormat>("plain");
	const [replyContentFormat, setReplyContentFormat] =
		useState<CommentContentFormat>("plain");
	const [selectedAttachment, setSelectedAttachment] =
		useState<CommentAttachmentOption | null>(null);
	const [replyAttachment, setReplyAttachment] =
		useState<CommentAttachmentOption | null>(null);
	const [replyingToId, setReplyingToId] = useState<string | null>(null);
	const [submittingReplyId, setSubmittingReplyId] = useState("");
	const [deletingRoastId, setDeletingRoastId] = useState("");
	const [deleteTargetRoast, setDeleteTargetRoast] = useState<Roast | null>(null);
	const [reportTargetRoast, setReportTargetRoast] = useState<Roast | null>(null);
	const [reportReason, setReportReason] =
		useState<ReportReason>("personal_info");
	const [reportDetails, setReportDetails] = useState("");
	const [submittingReport, setSubmittingReport] = useState(false);
	const [collapsedRoastIds, setCollapsedRoastIds] = useState<Set<string>>(
		new Set(),
	);
	const [attachmentsById, setAttachmentsById] = useState<
		Record<string, CommentAttachmentOption>
	>({});
	const [replySchemaReady, setReplySchemaReady] = useState(true);
	const [deleteSchemaReady, setDeleteSchemaReady] = useState(true);
	const [reportSchemaReady, setReportSchemaReady] = useState(true);
	const [mediaSchemaReady, setMediaSchemaReady] = useState(true);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [message, setMessage] = useState("");

	const threadRoasts = useMemo(
		() => buildThreadRoastTree(roasts, collapsedRoastIds),
		[collapsedRoastIds, roasts],
	);
	const isOwner = Boolean(user && resume?.user_id === user.id);
	const isClosed = resume?.status === "closed";

	function goToLogin() {
		const loginRoute = getLoginPath(`/resume/${resumeId}`);
		announceRouteTransition(loginRoute);
		router.push(loginRoute);
	}

	function reportError(errorMessage: string) {
		setMessage(errorMessage);
		toast.error(errorMessage);
	}

	async function openResumeFile(activeResume = resume) {
		setSignedUrlError("");

		const { data: userData } = await supabase.auth.getUser();
		const activeUser = userData.user;
		setUser(activeUser);

		if (!activeUser || !activeResume) {
			return;
		}

		const signed = await supabase.storage
			.from("resumes")
			.createSignedUrl(activeResume.file_path, 60 * 20);

		if (signed.error) {
			setSignedUrl("");
			setSignedUrlError(signed.error.message);
			return;
		}

		setSignedUrl(signed.data.signedUrl);
	}

	async function recordResumeRead(
		activeResume: ResumeSummary,
		activeUser: User | null,
	) {
		if (!activeUser || activeResume.user_id === activeUser.id) {
			return;
		}

		const { data, error } = await supabase.rpc("record_resume_read", {
			target_resume_id: activeResume.id,
		});

		if (error) {
			if (process.env.NODE_ENV !== "production") {
				console.warn("Resume read tracking failed:", error.message);
			}
			return;
		}

		const nextReadCount =
			typeof data === "number"
				? data
				: typeof data === "string"
					? Number(data)
					: Number.NaN;

		if (Number.isFinite(nextReadCount)) {
			setResume((current) =>
				current?.id === activeResume.id
					? { ...current, read_count: nextReadCount }
					: current,
			);
		}
	}

	async function fetchResumeAuthorProfile(activeResume: ResumeSummary) {
		if (activeResume.is_anonymous) return null;

		const primaryResult = await supabase
			.from("profiles")
			.select(RESUME_AUTHOR_PROFILE_SELECT_WITH_STATUS)
			.eq("id", activeResume.user_id)
			.maybeSingle();

		if (primaryResult.error && isAuthorProfileFeatureError(primaryResult.error)) {
			const fallbackResult = await supabase
				.from("profiles")
				.select(RESUME_AUTHOR_PROFILE_SELECT_BASE)
				.eq("id", activeResume.user_id)
				.maybeSingle();

			if (fallbackResult.error) return null;
			return (fallbackResult.data ?? null) as ResumeAuthorProfile | null;
		}

		if (primaryResult.error) return null;

		return (primaryResult.data ?? null) as ResumeAuthorProfile | null;
	}

	async function loadRoastAttachments(loadedRoasts: Roast[]) {
		const attachmentIds = Array.from(
			new Set(
				loadedRoasts
					.map((roast) => roast.attachment_id)
					.filter((id): id is string => Boolean(id)),
			),
		);

		if (!attachmentIds.length) {
			setAttachmentsById({});
			return;
		}

		const { data, error } = await supabase
			.from("comment_attachments")
			.select("id,user_id,kind,source,storage_path,title,alt_text,mime_type,file_size,created_at")
			.in("id", attachmentIds);

		if (error) {
			if (isCommentMediaFeatureError(error)) {
				setMediaSchemaReady(false);
			}
			return;
		}

		const entries = ((data ?? []) as CommentAttachment[]).map((attachment) => {
			const publicUrl = attachment.storage_path
				? supabase.storage.from("comment-media").getPublicUrl(attachment.storage_path)
						.data.publicUrl
				: undefined;

			return [
				attachment.id,
				{
					...attachment,
					publicUrl,
				},
			] as const;
		});

		setMediaSchemaReady(true);
		setAttachmentsById(Object.fromEntries(entries));
	}

	async function loadRoastThread(activeUser: User | null) {
		const roastResultWithMedia = await supabase
			.from("roasts")
			.select(ROAST_SELECT_WITH_MEDIA)
			.eq("resume_id", resumeId)
			.order("created_at", { ascending: false });

		const roastResultWithThreads =
			roastResultWithMedia.error &&
			isCommentMediaFeatureError(roastResultWithMedia.error)
				? await supabase
						.from("roasts")
						.select(ROAST_SELECT_WITH_THREADS)
						.eq("resume_id", resumeId)
						.order("created_at", { ascending: false })
				: roastResultWithMedia;

		setMediaSchemaReady(
			!(
				roastResultWithMedia.error &&
				isCommentMediaFeatureError(roastResultWithMedia.error)
			),
		);

		const roastResultWithDeleteFallback =
			roastResultWithThreads.error &&
			isDeleteFeatureError(roastResultWithThreads.error)
				? await supabase
						.from("roasts")
						.select(ROAST_SELECT_WITH_THREADS_LEGACY)
						.eq("resume_id", resumeId)
						.order("created_at", { ascending: false })
				: roastResultWithThreads;

		setDeleteSchemaReady(
			!(
				roastResultWithThreads.error &&
				isDeleteFeatureError(roastResultWithThreads.error)
			),
		);

		const roastResultWithReactions =
			roastResultWithDeleteFallback.error &&
			(isMissingColumnError(roastResultWithDeleteFallback.error, "parent_id") ||
				isMissingColumnError(roastResultWithDeleteFallback.error, "reply_count"))
				? await supabase
						.from("roasts")
						.select(ROAST_SELECT_WITH_REACTIONS)
						.eq("resume_id", resumeId)
						.order("created_at", { ascending: false })
				: roastResultWithDeleteFallback;

		setReplySchemaReady(
			!(
				roastResultWithDeleteFallback.error &&
				(isMissingColumnError(roastResultWithDeleteFallback.error, "parent_id") ||
					isMissingColumnError(roastResultWithDeleteFallback.error, "reply_count"))
			),
		);

		const roastResult =
			roastResultWithReactions.error &&
			isMissingColumnError(roastResultWithReactions.error, "dislike_count")
				? await supabase
						.from("roasts")
						.select(ROAST_SELECT_BASE)
						.eq("resume_id", resumeId)
						.order("created_at", { ascending: false })
				: roastResultWithReactions;

		if (roastResult.error) {
			return;
		}

		const loadedRoasts = ((roastResult.data ?? []) as Roast[]).map((roast) =>
			normalizeRoast(roast),
		);
		setRoasts(loadedRoasts);
		await loadRoastAttachments(loadedRoasts);

		const authorIds = Array.from(
			new Set(
				loadedRoasts
					.filter((roast) => !roast.is_deleted)
					.map((roast) => roast.author_id),
			),
		);

		if (authorIds.length) {
			const profileResultWithReviewerFields = await supabase
				.from("profiles")
				.select(
					"id,username,full_name,community_role,reviewer_type,reviewer_headline,reviewer_expertise,reviewer_verification_status",
				)
				.in("id", authorIds);
			const profileResult =
				profileResultWithReviewerFields.error &&
				isAuthorProfileFeatureError(profileResultWithReviewerFields.error)
					? await supabase
							.from("profiles")
							.select("id,username,full_name")
							.in("id", authorIds)
					: profileResultWithReviewerFields;

			if (!profileResult.error) {
				setAuthorProfiles(
					Object.fromEntries(
						(profileResult.data ?? []).map((profile) => [
							profile.id,
							profile,
						]),
					),
				);
			}
		}

		const roastIds = loadedRoasts
			.filter((roast) => !roast.is_deleted)
			.map((roast) => roast.id);

		if (activeUser && roastIds.length) {
			const voteResultWithReactions = await supabase
				.from("votes")
				.select("roast_id,reaction")
				.eq("voter_id", activeUser.id)
				.in("roast_id", roastIds);

			const voteResult =
				voteResultWithReactions.error &&
				voteResultWithReactions.error.message.includes("reaction")
					? await supabase
							.from("votes")
							.select("roast_id")
							.eq("voter_id", activeUser.id)
							.in("roast_id", roastIds)
					: voteResultWithReactions;

			if (!voteResult.error) {
				setVotedRoastIds(
					new Set(
						voteResult.data
							.filter((vote) => !("reaction" in vote) || vote.reaction === "like")
							.map((vote) => vote.roast_id),
					),
				);
				setDislikedRoastIds(
					new Set(
						voteResult.data
							.filter((vote) => "reaction" in vote && vote.reaction === "dislike")
							.map((vote) => vote.roast_id),
					),
				);
			}
		} else {
			setVotedRoastIds(new Set());
			setDislikedRoastIds(new Set());
		}
	}

	useEffect(() => {
		async function load() {
			const started = Date.now();
			const { data: userData } = await supabase.auth.getUser();
			const activeUser = userData.user;
			setUser(activeUser);

			const resumeResultWithContext = await supabase
				.from("resumes")
				.select(RESUME_SELECT_WITH_CONTEXT)
				.eq("id", resumeId)
				.single();

			let resumeResult = resumeResultWithContext as ResumeQueryResult;

			if (
				resumeResultWithContext.error &&
				isResumeContextFeatureError(resumeResultWithContext.error)
			) {
				const resumeResultWithReads = (await supabase
					.from("resumes")
					.select(RESUME_SELECT_WITH_READS)
					.eq("id", resumeId)
					.single()) as ResumeQueryResult;

				if (
					resumeResultWithReads.error &&
					isReadCountFeatureError(resumeResultWithReads.error)
				) {
					resumeResult = (await supabase
						.from("resumes")
						.select(RESUME_SELECT_BASE)
						.eq("id", resumeId)
						.single()) as ResumeQueryResult;
				} else {
					resumeResult = resumeResultWithReads;
				}
			}

			if (resumeResult.error) {
				setMessage(resumeResult.error.message ?? "Resume could not be loaded.");
				setLoading(false);
				return;
			}

			if (!resumeResult.data) {
				setMessage("Resume not found.");
				setLoading(false);
				return;
			}

			const loadedResume = withResumeDefaults(resumeResult.data);
			setResume(loadedResume);
			setResumeAuthorProfile(await fetchResumeAuthorProfile(loadedResume));

			if (activeUser) {
				await openResumeFile(loadedResume);
				void recordResumeRead(loadedResume, activeUser);
			}

			await loadRoastThread(activeUser);

			const elapsed = Date.now() - started;
			window.setTimeout(() => setLoading(false), Math.max(0, 300 - elapsed));
		}

		void load();
	}, [resumeId]);

	async function handleRoastSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setMessage("");

		if (!user) {
			goToLogin();
			return;
		}

		if (isOwner) {
			reportError("You cannot review your own resume. Let the community help.");
			return;
		}

		if (isClosed) {
			reportError("This resume is closed for new feedback.");
			return;
		}

		const roastContent = content.trim();
		const payloadIssue = getRoastContentIssue({
			attachmentId: selectedAttachment?.id,
			content: roastContent,
			contentFormat,
		});

		if (payloadIssue) {
			reportError(payloadIssue);
			return;
		}

		if ((selectedAttachment || contentFormat === "markdown") && !mediaSchemaReady) {
			reportError(`${SUPABASE_MIGRATION_MESSAGE} Comment media is not ready yet.`);
			return;
		}

		setSubmitting(true);
		const roastPayload: {
			author_id: string;
			attachment_id?: string | null;
			content: string;
			content_format?: CommentContentFormat;
			resume_id: string;
		} = {
			resume_id: resumeId,
			author_id: user.id,
			content: roastContent,
		};

		if (mediaSchemaReady) {
			roastPayload.attachment_id = selectedAttachment?.id ?? null;
			roastPayload.content_format = contentFormat;
		}

		const { data, error } = await supabase
			.from("roasts")
			.insert(roastPayload)
			.select(mediaSchemaReady ? ROAST_SELECT_WITH_MEDIA : ROAST_SELECT_WITH_THREADS)
			.single();

		setSubmitting(false);

		if (error) {
			if (isCommentMediaFeatureError(error)) {
				setMediaSchemaReady(false);
				reportError(`${SUPABASE_MIGRATION_MESSAGE} Comment media is not ready yet.`);
				return;
			}

			reportError(error.message);
			return;
		}

		setRoasts((current) => [normalizeRoast(data as unknown as Roast), ...current]);
		if (selectedAttachment) {
			setAttachmentsById((current) => ({
				...current,
				[selectedAttachment.id]: selectedAttachment,
			}));
		}
		setAuthorProfiles((current) => ({
			...current,
			[user.id]: {
				id: user.id,
				username: user.email?.split("@")[0] ?? null,
				full_name: user.user_metadata?.full_name ?? null,
			},
		}));
		setResume((current) =>
			current ? { ...current, roast_count: current.roast_count + 1 } : current,
		);
		setContent("");
		setContentFormat("plain");
		setSelectedAttachment(null);
		toast.success("Feedback submitted.");
	}

	async function handleReplySubmit(
		event: FormEvent<HTMLFormElement>,
		parentRoast: Roast,
	) {
		event.preventDefault();
		setMessage("");

		if (!replySchemaReady) {
			reportError(`${SUPABASE_MIGRATION_MESSAGE} Replies are not ready yet.`);
			return;
		}

		if (!user) {
			goToLogin();
			return;
		}

		if (parentRoast.author_id === user.id) {
			reportError("You cannot reply to your own roast.");
			return;
		}

		if (isClosed) {
			reportError("This resume is closed for new replies.");
			return;
		}

		const replyText = replyContent.trim();
		const payloadIssue = getRoastContentIssue({
			attachmentId: replyAttachment?.id,
			content: replyText,
			contentFormat: replyContentFormat,
		});

		if (payloadIssue) {
			reportError(payloadIssue.replace("feedback", "reply context"));
			return;
		}

		if ((replyAttachment || replyContentFormat === "markdown") && !mediaSchemaReady) {
			reportError(`${SUPABASE_MIGRATION_MESSAGE} Comment media is not ready yet.`);
			return;
		}

		setSubmittingReplyId(parentRoast.id);
		const replyPayload: {
			author_id: string;
			attachment_id?: string | null;
			content: string;
			content_format?: CommentContentFormat;
			parent_id: string;
			resume_id: string;
		} = {
			resume_id: resumeId,
			parent_id: parentRoast.id,
			author_id: user.id,
			content: replyText,
		};

		if (mediaSchemaReady) {
			replyPayload.attachment_id = replyAttachment?.id ?? null;
			replyPayload.content_format = replyContentFormat;
		}

		const { data, error } = await supabase
			.from("roasts")
			.insert(replyPayload)
			.select(mediaSchemaReady ? ROAST_SELECT_WITH_MEDIA : ROAST_SELECT_WITH_THREADS)
			.single();

		setSubmittingReplyId("");

		if (error) {
			if (
				isMissingColumnError(error, "parent_id") ||
				isMissingColumnError(error, "reply_count")
			) {
				setReplySchemaReady(false);
				reportError(`${SUPABASE_MIGRATION_MESSAGE} Replies are not ready yet.`);
				return;
			}

			if (isCommentMediaFeatureError(error)) {
				setMediaSchemaReady(false);
				reportError(`${SUPABASE_MIGRATION_MESSAGE} Comment media is not ready yet.`);
				return;
			}

			reportError(error.message);
			return;
		}

		const nextReply = normalizeRoast(data as unknown as Roast);
		setRoasts((current) => [
			nextReply,
			...current.map((roast) =>
				roast.id === parentRoast.id
					? { ...roast, reply_count: (roast.reply_count ?? 0) + 1 }
					: roast,
			),
		]);
		if (replyAttachment) {
			setAttachmentsById((current) => ({
				...current,
				[replyAttachment.id]: replyAttachment,
			}));
		}
		setCollapsedRoastIds((current) => {
			const next = new Set(current);
			next.delete(parentRoast.id);
			return next;
		});
		setAuthorProfiles((current) => ({
			...current,
			[user.id]: {
				id: user.id,
				username: user.email?.split("@")[0] ?? null,
				full_name: user.user_metadata?.full_name ?? null,
			},
		}));
		setResume((current) =>
			current ? { ...current, roast_count: current.roast_count + 1 } : current,
		);
		setReplyingToId(null);
		setReplyContent("");
		setReplyContentFormat("plain");
		setReplyAttachment(null);
		toast.success("Reply posted.");
	}

	function toggleRoastReplies(roastId: string) {
		setCollapsedRoastIds((current) => {
			const next = new Set(current);
			if (next.has(roastId)) {
				next.delete(roastId);
			} else {
				next.add(roastId);
			}
			return next;
		});
	}

	async function reactToRoast(targetRoast: Roast, reaction: Reaction) {
		setMessage("");

		if (!user) {
			goToLogin();
			return;
		}

		if (targetRoast.author_id === user.id) {
			reportError("You cannot react to your own roast.");
			return;
		}

		if (isOwner) {
			reportError("Resume owners cannot react to feedback for their own resume.");
			return;
		}

		const currentReaction = votedRoastIds.has(targetRoast.id)
			? "like"
			: dislikedRoastIds.has(targetRoast.id)
				? "dislike"
				: null;

		const applyLocalReaction = (nextReaction: Reaction | null) => {
			setVotedRoastIds((current) => {
				const next = new Set(current);
				if (nextReaction === "like") {
					next.add(targetRoast.id);
				} else {
					next.delete(targetRoast.id);
				}
				return next;
			});
			setDislikedRoastIds((current) => {
				const next = new Set(current);
				if (nextReaction === "dislike") {
					next.add(targetRoast.id);
				} else {
					next.delete(targetRoast.id);
				}
				return next;
			});
			setRoasts((current) =>
				current.map((roast) => {
					if (roast.id !== targetRoast.id) return roast;

					const removeLike = currentReaction === "like" ? -1 : 0;
					const addLike = nextReaction === "like" ? 1 : 0;
					const removeDislike = currentReaction === "dislike" ? -1 : 0;
					const addDislike = nextReaction === "dislike" ? 1 : 0;

					return {
						...roast,
						helpful_votes: Math.max(
							0,
							roast.helpful_votes + removeLike + addLike,
						),
						dislike_count: Math.max(
							0,
							(roast.dislike_count ?? 0) + removeDislike + addDislike,
						),
					};
				}),
			);
		};

		if (currentReaction === reaction) {
			const { error } = await supabase
				.from("votes")
				.delete()
				.eq("roast_id", targetRoast.id)
				.eq("voter_id", user.id);

			if (error) {
				reportError(error.message);
				return;
			}

			applyLocalReaction(null);
			toast.info(reaction === "like" ? "Like removed." : "Dislike removed.");
			return;
		}

		const voteQuery = currentReaction
			? supabase
					.from("votes")
					.update({ reaction })
					.eq("roast_id", targetRoast.id)
					.eq("voter_id", user.id)
			: supabase.from("votes").insert({
					roast_id: targetRoast.id,
					voter_id: user.id,
					reaction,
				});

		const { error } = await voteQuery;

		if (error) {
			reportError(
				error.message.includes("reaction")
					? `${SUPABASE_MIGRATION_MESSAGE} Reactions are not ready yet.`
					: error.message,
			);
			return;
		}

		applyLocalReaction(reaction);
		toast.success(reaction === "like" ? "Liked roast." : "Disliked roast.");
	}

	async function closeResume() {
		setMessage("");

		if (!resume || !isOwner) {
			reportError("Only the resume owner can close this thread.");
			return;
		}

		const { error } = await supabase
			.from("resumes")
			.update({ status: "closed" })
			.eq("id", resume.id);

		if (error) {
			reportError(error.message);
			return;
		}

		setResume({ ...resume, status: "closed" });
		setMessage("This resume is now closed for new feedback.");
		toast.success("Resume thread closed.");
	}

	async function deleteResume() {
		setMessage("");

		if (!resume || !isOwner) {
			reportError("Only the resume owner can delete this submission.");
			return;
		}

		const removeFile = await supabase.storage
			.from("resumes")
			.remove([resume.file_path]);
		if (removeFile.error) {
			reportError(removeFile.error.message);
			return;
		}

		const { error } = await supabase
			.from("resumes")
			.delete()
			.eq("id", resume.id);
		if (error) {
			reportError(error.message);
			return;
		}

		toast.success("Resume deleted.");
		announceRouteTransition("/feed");
		router.push("/feed");
	}

	async function requestDeleteRoast(targetRoast: Roast) {
		setMessage("");

		if (!deleteSchemaReady) {
			reportError(`${SUPABASE_MIGRATION_MESSAGE} Comment deletes are not ready yet.`);
			return;
		}

		if (!user) {
			goToLogin();
			return;
		}

		if (targetRoast.author_id !== user.id) {
			reportError("You can only delete comments or replies you wrote.");
			return;
		}

		if (targetRoast.is_deleted) {
			reportError("This roast has already been deleted.");
			return;
		}

		setDeleteTargetRoast(targetRoast);
	}

	async function deleteRoast(targetRoast: Roast | null) {
		setMessage("");

		if (!targetRoast) {
			return;
		}

		if (!user) {
			goToLogin();
			return;
		}

		setDeletingRoastId(targetRoast.id);

		const { error } = await supabase.rpc("delete_roast", {
			target_roast_id: targetRoast.id,
		});

		setDeletingRoastId("");
		setDeleteTargetRoast(null);

		if (error) {
			if (isDeleteFeatureError(error)) {
				setDeleteSchemaReady(false);
				reportError(`${SUPABASE_MIGRATION_MESSAGE} Comment deletes are not ready yet.`);
				return;
			}

			reportError(error.message);
			return;
		}

		setReplyingToId((current) =>
			current === targetRoast.id ? null : current,
		);
		setReplyContent("");
		setReplyContentFormat("plain");
		setReplyAttachment(null);
		await loadRoastThread(user);
		setResume((current) =>
			current
				? {
						...current,
						roast_count: Math.max(current.roast_count - 1, 0),
					}
				: current,
		);
		toast.success(targetRoast.parent_id ? "Reply deleted." : "Roast deleted.");
	}

	function openReportDialog(targetRoast: Roast) {
		setMessage("");

		if (!reportSchemaReady) {
			reportError(`${SUPABASE_MIGRATION_MESSAGE} Reports are not ready yet.`);
			return;
		}

		if (!user) {
			goToLogin();
			return;
		}

		if (targetRoast.author_id === user.id) {
			reportError("You cannot report your own roast.");
			return;
		}

		if (targetRoast.is_deleted) {
			reportError("Deleted feedback cannot be reported.");
			return;
		}

		setReportReason("personal_info");
		setReportDetails("");
		setReportTargetRoast(targetRoast);
	}

	async function submitReport(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setMessage("");

		if (!reportTargetRoast) {
			return;
		}

		if (!user) {
			goToLogin();
			return;
		}

		const issue = getReportIssue({
			reason: reportReason,
			details: reportDetails,
		});

		if (issue) {
			reportError(issue);
			return;
		}

		setSubmittingReport(true);

		const { data, error } = await supabase.rpc("report_content", {
			report_target_type: "roast",
			target_resume_id: reportTargetRoast.resume_id,
			target_roast_id: reportTargetRoast.id,
			report_reason: reportReason,
			report_details: reportDetails.trim(),
		});

		setSubmittingReport(false);

		if (error) {
			if (isReportFeatureError(error)) {
				setReportSchemaReady(false);
				reportError(`${SUPABASE_MIGRATION_MESSAGE} Reports are not ready yet.`);
				return;
			}

			reportError(error.message);
			return;
		}

		const reportResult = Array.isArray(data) ? data[0] : null;
		setReportTargetRoast(null);
		setReportDetails("");
		toast.success(
			reportResult?.was_duplicate
				? "Report updated in the moderation queue."
				: "Report sent for moderation review.",
		);
	}

	if (loading) {
		return (
			<section className="resume-thread">
				<div className="thread-viewer-card">
					<span className="skeleton skeleton-line title" />
					<span className="skeleton skeleton-line copy" />
					<span className="skeleton skeleton-line actions" />
				</div>
			</section>
		);
	}

	if (!resume) {
		return <p className="form-message">{message || "Resume not found."}</p>;
	}

	const jobDescription = resume.job_description ?? "";
	const postDescription = resume.post_description ?? "";
	const visibleRoastCount = roasts.filter((roast) => !roast.is_deleted).length;
	const deleteTargetIsReply = Boolean(deleteTargetRoast?.parent_id);
	const posterLabel = getResumePosterLabel(resume, resumeAuthorProfile);
	const reportTargetAuthorHandle = reportTargetRoast
		? getAuthorHandle(
				reportTargetRoast.author_id,
				authorProfiles[reportTargetRoast.author_id],
			)
		: "";
	const reportDetailsRemaining =
		REPORT_DETAILS_MAX_LENGTH - reportDetails.length;
	let threadRenderIndex = 0;

	function renderThreadRoast(roast: ThreadRoastNode) {
		const voted = votedRoastIds.has(roast.id);
		const disliked = dislikedRoastIds.has(roast.id);
		const authorProfile = authorProfiles[roast.author_id];
		const authorHandle = getAuthorHandle(roast.author_id, authorProfile);
		const reactionBlockReason = getReactionBlockReason(user, resume, roast);
		const reactionDisabled = Boolean(reactionBlockReason);
		const replyCount = Math.max(roast.reply_count ?? 0, roast.childCount);
		const isCollapsed = collapsedRoastIds.has(roast.id);
		const isDeleted = Boolean(roast.is_deleted);
		const roastAttachment =
			!isDeleted && roast.attachment_id
				? attachmentsById[roast.attachment_id]
				: null;
		const isOwnRoast = user?.id === roast.author_id;
		const replyBlockReason = getReplyBlockReason({
			isClosed,
			isDeleted,
			isOwnRoast,
			migrationMessage: SUPABASE_MIGRATION_MESSAGE,
			replySchemaReady,
		});
		const canReply = !replyBlockReason;
		const roastStyle = {
			animationDelay: `${threadRenderIndex * 32}ms`,
		} as CSSProperties;
		threadRenderIndex += 1;

		return (
			<div
				className="thread-roast-node"
				data-thread-parent-id={roast.parent_id ?? undefined}
				data-thread-roast-id={roast.id}
				key={roast.id}
				role="listitem"
			>
				{roast.depth > 0 ? (
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
					className={`thread-roast ${roast.depth ? "is-reply" : ""}${
						isDeleted ? " is-deleted" : ""
					}`}
					style={roastStyle}
				>
					<div className="thread-roast-avatar-cell" aria-hidden="true">
						{isDeleted ? (
							<span className="thread-roast-avatar is-deleted">D</span>
						) : (
							<img
								className="thread-roast-avatar"
								src={getAuthorAvatar(roast.author_id, authorProfile)}
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
									<Link href={`/profile/${roast.author_id}`}>
										{authorHandle}
									</Link>
								</Button>
							)}
							{isDeleted ? null : (
								<ReviewerTrustChip profile={authorProfile} />
							)}
							<time dateTime={roast.created_at}>
								&middot; {formatDate(roast.created_at)}
							</time>
							{!isDeleted && roast.helpful_votes > 5 ? (
								<span className="badge badge-open">Verified helpful</span>
							) : null}
						</header>
						<FormattedRoastContent
							content={roast.content}
							format={roast.content_format}
							isDeleted={isDeleted}
						/>
						<RoastAttachment attachment={roastAttachment} />
						<footer>
							{isDeleted ? null : (
								<div className="comment-reactions">
									<Button
										className="reaction-button py-0 pe-0"
										variant={voted ? "secondary" : "outline"}
										disabled={reactionDisabled}
										onClick={() => void reactToRoast(roast, "like")}
										type="button"
										aria-label={
											voted
												? "Remove like from this roast"
												: "Like this roast"
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
										<span className="reaction-count">
											{roast.helpful_votes}
										</span>
									</Button>
									<Button
										className="reaction-button py-0 pe-0"
										variant={disliked ? "secondary" : "outline"}
										disabled={reactionDisabled}
										onClick={() => void reactToRoast(roast, "dislike")}
										type="button"
										aria-label={
											disliked
												? "Remove dislike from this roast"
												: "Dislike this roast"
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
											{roast.dislike_count ?? 0}
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
										setReplyingToId((current) =>
											current === roast.id ? null : roast.id,
										);
										setReplyContent("");
										setReplyContentFormat("plain");
										setReplyAttachment(null);
									}}
									type="button"
								>
									Reply
								</button>
							)}
							{replyCount > 0 ? (
								<button
									className="reply-collapse-button"
									onClick={() => toggleRoastReplies(roast.id)}
									type="button"
								>
									{isCollapsed
										? `Show ${replyCount} ${
												replyCount === 1 ? "reply" : "replies"
											}`
										: "Hide replies"}
								</button>
							) : null}
							{!isDeleted && isOwnRoast ? (
								<button
									className="comment-delete-button"
									disabled={!deleteSchemaReady || deletingRoastId === roast.id}
									onClick={() => void requestDeleteRoast(roast)}
									title={
										deleteSchemaReady
											? undefined
											: `${SUPABASE_MIGRATION_MESSAGE} Deletes are not ready yet.`
									}
									type="button"
								>
									{deletingRoastId === roast.id ? "Deleting..." : "Delete"}
								</button>
							) : null}
							{!isDeleted && !isOwnRoast ? (
								<button
									className="comment-report-button"
									disabled={!reportSchemaReady}
									onClick={() => openReportDialog(roast)}
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
						{!isDeleted && replyingToId === roast.id ? (
							<form
								className="inline-reply-form"
								onSubmit={(event) => handleReplySubmit(event, roast)}
							>
								<textarea
									autoFocus
									onChange={(event) => setReplyContent(event.target.value)}
									placeholder={`Reply to ${authorHandle}`}
									rows={3}
									value={replyContent}
								/>
								<CommentMediaToolbar
									attachment={replyAttachment}
									contentFormat={replyContentFormat}
									disabled={!mediaSchemaReady || submittingReplyId === roast.id}
									onAttachmentChange={setReplyAttachment}
									onFormatChange={setReplyContentFormat}
									onRequireLogin={goToLogin}
								/>
								<div className="inline-reply-actions">
									<button
										className="reply-cancel-button"
										onClick={() => {
											setReplyingToId(null);
											setReplyContent("");
											setReplyContentFormat("plain");
											setReplyAttachment(null);
										}}
										type="button"
									>
										Cancel
									</button>
									<button
										className="btn-primary btn-brand reply-submit-button"
										disabled={submittingReplyId === roast.id}
										type="submit"
									>
										{submittingReplyId === roast.id ? "Posting..." : "Post reply"}
									</button>
								</div>
							</form>
						) : null}
					</div>
				</article>
				{roast.children.length ? (
					<div
						aria-label={`Replies to ${authorHandle}`}
						className="thread-children"
						role="list"
					>
						{roast.children.map((child) => renderThreadRoast(child))}
					</div>
				) : null}
			</div>
		);
	}

	return (
		<>
		<section className="resume-thread">
			<div className="resume-detail-main-scroll">
			<article className="thread-viewer-card resume-preview-pane">
				<header className="thread-header">
					<div className="post-meta">
						{resume.is_anonymous ? (
							<span>{posterLabel}</span>
						) : (
							<Link
								className="post-author-link"
								href={`/profile/${resume.user_id}`}
							>
								{posterLabel}
							</Link>
						)}
						<time dateTime={resume.created_at}>
							{formatDate(resume.created_at)}
						</time>
					</div>
					<div className="thread-header-actions">
						<span
							className={`badge ${isClosed ? "badge-closed" : "badge-open"}`}
						>
							{isClosed ? "Closed" : "Open for review"}
						</span>
						{isOwner ? (
							<div className="owner-actions">
								<Button
									disabled={isClosed}
									onClick={() => void closeResume()}
									type="button"
									variant="outline"
								>
									{isClosed ? "Closed" : "Close feedback"}
								</Button>
								<Button
									className="owner-delete-button"
									onClick={() => void deleteResume()}
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
							resume.privacy_mode ??
							(resume.is_anonymous ? "anonymous" : "public")
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
						<button
							className="btn-primary"
							onClick={() => void openResumeFile()}
						>
							Retry opening PDF
						</button>
						{signedUrlError ? (
							<p className="form-message">{signedUrlError}</p>
						) : null}
					</div>
				) : (
					<div className="locked-file">
						<p>Sign in to open the private resume PDF.</p>
						<button
							className="btn-primary"
							onClick={goToLogin}
						>
							Sign in to continue
						</button>
					</div>
				)}
			</article>

			<section className="thread-discussion-panel" aria-label="Feedback discussion">
					{isClosed || isOwner ? (
						<div className="closed-note">
							<h2>{isOwner ? "Owner view" : "Feedback closed"}</h2>
							<p>
								{isOwner
									? "You own this resume. You can reply for clarification, but you cannot mark feedback helpful."
									: "This thread is visible for learning, but no new feedback can be added."}
							</p>
							{message ? <p className="form-message">{message}</p> : null}
						</div>
					) : (
						<form
							className="roast-form thread-roast-form"
							onSubmit={handleRoastSubmit}
						>
							<textarea
								value={content}
								onChange={(event) => setContent(event.target.value)}
								placeholder="Be specific. What should they rewrite, reorder, quantify, or remove?"
								rows={4}
							/>
							<div className="roast-form-footer">
								<span>Review the resume, not the person</span>
								<div className="roast-form-actions">
									<CommentMediaToolbar
										attachment={selectedAttachment}
										contentFormat={contentFormat}
										disabled={!mediaSchemaReady || submitting}
										onAttachmentChange={setSelectedAttachment}
										onFormatChange={setContentFormat}
										onRequireLogin={goToLogin}
									/>
									<button className="btn-primary btn-brand" disabled={submitting}>
										{submitting
											? "Posting..."
											: user
												? "Submit feedback"
												: "Sign in to review"}
									</button>
								</div>
							</div>
							{message ? <p className="form-message">{message}</p> : null}
						</form>
					)}

					<div className="thread-list-header">
						<h2>Feedback thread</h2>
						<span>{visibleRoastCount} comments</span>
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

					<div
						className="roast-list"
						role={threadRoasts.length ? "list" : undefined}
					>
						{threadRoasts.map((roast) => renderThreadRoast(roast))}
						{!threadRoasts.length ? (
							<p className="muted-text">
								No feedback yet. First useful comment wins the room.
							</p>
						) : null}
					</div>
				</section>
			</div>
			<aside className="thread-context-panel" aria-label="Resume context">
				<div className="thread-context-grid" aria-label="Resume context">
					<ResumeContextCard
						eyebrow="Ask"
						title="What they want help with"
						content={postDescription}
						emptyMessage="No post description was attached to this older post."
					/>
					<ResumeContextCard
						eyebrow="JD"
						title="Job description"
						content={jobDescription}
						emptyMessage="No JD was attached to this older post."
					/>
				</div>
			</aside>
		</section>
		<Dialog
			open={Boolean(reportTargetRoast)}
			onOpenChange={(open) => {
				if (!open && !submittingReport) {
					setReportTargetRoast(null);
					setReportDetails("");
				}
			}}
		>
			<DialogContent className="report-dialog-content">
				<DialogHeader>
					<DialogTitle>Report comment</DialogTitle>
					<DialogDescription>
						Send this to the moderation queue. Reports are private and help us
						keep feedback useful.
					</DialogDescription>
				</DialogHeader>
				<form className="report-form" onSubmit={submitReport}>
					{reportTargetRoast ? (
						<div className="report-target-preview">
							<span>{reportTargetAuthorHandle}</span>
							<p>{reportTargetRoast.content}</p>
						</div>
					) : null}
					<div className="report-reason-grid" aria-label="Report reason">
						{REPORT_REASON_OPTIONS.map((option) => (
							<button
								aria-pressed={reportReason === option.value}
								className={reportReason === option.value ? "is-selected" : ""}
								key={option.value}
								onClick={() => setReportReason(option.value)}
								type="button"
							>
								<span>{option.label}</span>
								<small>{option.description}</small>
							</button>
						))}
					</div>
					<label className="report-details-field">
						<span>Context for moderators</span>
						<textarea
							maxLength={REPORT_DETAILS_MAX_LENGTH}
							onChange={(event) => setReportDetails(event.target.value)}
							placeholder="Optional, unless you choose Other."
							rows={4}
							value={reportDetails}
						/>
					</label>
					<div className="report-form-meta">
						<span>{reportDetailsRemaining} characters left</span>
					</div>
					<DialogFooter>
						<Button
							disabled={submittingReport}
							onClick={() => {
								setReportTargetRoast(null);
								setReportDetails("");
							}}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
						<Button
							className="btn-brand"
							disabled={submittingReport}
							type="submit"
						>
							{submittingReport ? "Sending..." : "Send report"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
		<AlertDialog
			open={Boolean(deleteTargetRoast)}
			onOpenChange={(open) => {
				if (!open && !deletingRoastId) {
					setDeleteTargetRoast(null);
				}
			}}
		>
			<AlertDialogContent size="sm">
				<AlertDialogHeader>
					<AlertDialogTitle>
						{deleteTargetIsReply ? "Delete reply?" : "Delete comment?"}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{deleteTargetIsReply
							? "This reply will be removed from the thread. The rest of the conversation will stay visible."
							: "This comment will be removed. Replies from other users will stay visible so the thread still makes sense."}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={Boolean(deletingRoastId)}>
						Cancel
					</AlertDialogCancel>
					<AlertDialogAction
						disabled={Boolean(deletingRoastId)}
						onClick={(event) => {
							event.preventDefault();
							void deleteRoast(deleteTargetRoast);
						}}
					>
						{deletingRoastId
							? "Deleting..."
							: deleteTargetIsReply
								? "Delete reply"
								: "Delete comment"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
		</>
	);
}
