import type { CommentAttachmentOption } from "@/components/CommentMediaToolbar";
import { getAnonymousProfileUsername } from "@/lib/anonymous-profile";
import type { ResumeSummary } from "@/lib/supabase/types";
import type { AuthorProfile, ResumeRowWithDefaults } from "./types";

export function formatDate(value: string) {
	return new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
	}).format(new Date(value));
}

export function getAuthorHandle(authorId: string, profile?: AuthorProfile) {
	const name =
		profile?.username ||
		profile?.full_name ||
		getAnonymousProfileUsername(authorId);
	return name.startsWith("@") ? name : `@${name}`;
}

export function getAuthorAvatar(authorId: string, profile?: AuthorProfile) {
	const seed = profile?.full_name || profile?.username || authorId;
	return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed)}`;
}

export function isMissingColumnError(error: { message?: string } | null, column: string) {
	return Boolean(error?.message?.toLowerCase().includes(column.toLowerCase()));
}

export function isReadCountFeatureError(error: { message?: string } | null) {
	return /read_count|record_resume_read|schema cache|column|function/i.test(
		error?.message ?? "",
	);
}

export function isDeleteFeatureError(error: { message?: string } | null) {
	return /is_deleted|deleted_at|delete_roast|schema cache|column|function/i.test(
		error?.message ?? "",
	);
}

export function isReportFeatureError(error: { message?: string } | null) {
	return /content_reports|report_content|schema cache|column|function/i.test(
		error?.message ?? "",
	);
}

export function isCommentMediaFeatureError(error: { message?: string } | null) {
	return /comment_attachments|attachment_id|content_format|schema cache|column|relation/i.test(
		error?.message ?? "",
	);
}

export function isPermissionPolicyError(error: { message?: string } | null) {
	return /row-level security|violates row-level|permission denied|policy|not authorized|not allowed/i.test(
		error?.message ?? "",
	);
}

export function isResumeContextFeatureError(error: { message?: string } | null) {
	return /job_description|post_description|read_count|schema cache|column/i.test(
		error?.message ?? "",
	);
}

export function isAuthorProfileFeatureError(error: { message?: string } | null) {
	return /app_status|current_position|avatar_path|community_role|reviewer_|schema cache|column/i.test(
		error?.message ?? "",
	);
}

export function withResumeDefaults(resume: ResumeRowWithDefaults): ResumeSummary {
	return {
		...resume,
		read_count: resume.read_count ?? 0,
		job_description: resume.job_description ?? null,
		post_description: resume.post_description ?? null,
	};
}

export function getAttachmentUrl(attachment?: CommentAttachmentOption | null) {
	return attachment?.publicUrl || "";
}
