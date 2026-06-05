import type { User } from "@supabase/supabase-js";
import type { CommentAttachmentOption } from "@/components/CommentMediaToolbar";
import { normalizeReview } from "@/lib/resume-thread";
import { supabase } from "@/lib/supabase/client";
import type {
	CommentAttachment,
	ResumeAuthorProfile,
	ResumeSummary,
	Review,
} from "@/lib/supabase/types";
import {
	RESUME_AUTHOR_PROFILE_SELECT_BASE,
	RESUME_AUTHOR_PROFILE_SELECT_WITH_STATUS,
	RESUME_SELECT_BASE,
	RESUME_SELECT_WITH_CONTEXT,
	RESUME_SELECT_WITH_READS,
	REVIEW_SELECT_BASE,
	REVIEW_SELECT_WITH_MEDIA,
	REVIEW_SELECT_WITH_REACTIONS,
	REVIEW_SELECT_WITH_THREADS,
	REVIEW_SELECT_WITH_THREADS_LEGACY,
} from "./selectors";
import type { AuthorProfile, ResumeQueryResult } from "./types";
import {
	isAuthorProfileFeatureError,
	isCommentMediaFeatureError,
	isDeleteFeatureError,
	isMissingColumnError,
	isReadCountFeatureError,
	isResumeContextFeatureError,
	withResumeDefaults,
} from "./utils";

export type ResumeThreadData = {
	attachmentsById: Record<string, CommentAttachmentOption>;
	authorProfiles: Record<string, AuthorProfile>;
	deleteSchemaReady: boolean;
	dislikedReviewIds: Set<string>;
	likedReviewIds: Set<string>;
	mediaSchemaReady: boolean;
	replySchemaReady: boolean;
	reviews: Review[];
};

export async function fetchLatestResumeStatus(resumeId: string) {
	const { data, error } = await supabase
		.from("resumes")
		.select("status")
		.eq("id", resumeId)
		.maybeSingle();

	if (error) {
		return null;
	}

	return (data?.status ?? null) as ResumeSummary["status"] | null;
}

export async function fetchResumeWithFallback(resumeId: string) {
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

	return {
		error: resumeResult.error,
		resume: resumeResult.data ? withResumeDefaults(resumeResult.data) : null,
	};
}

export async function fetchResumeAuthorProfile(activeResume: ResumeSummary) {
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

export async function recordResumeReadCount(
	activeResume: ResumeSummary,
	activeUser: User | null,
) {
	if (!activeUser || activeResume.user_id === activeUser.id) {
		return { error: null, readCount: null };
	}

	const { data, error } = await supabase.rpc("record_resume_read", {
		target_resume_id: activeResume.id,
	});

	if (error) {
		return { error, readCount: null };
	}

	const nextReadCount =
		typeof data === "number"
			? data
			: typeof data === "string"
				? Number(data)
				: Number.NaN;

	return {
		error: null,
		readCount: Number.isFinite(nextReadCount) ? nextReadCount : null,
	};
}

async function loadReviewAttachmentMap(loadedReviews: Review[]) {
	const attachmentIds = Array.from(
		new Set(
			loadedReviews
				.map((review) => review.attachment_id)
				.filter((id): id is string => Boolean(id)),
		),
	);

	if (!attachmentIds.length) {
		return {
			attachmentsById: {},
			mediaSchemaReady: null,
		};
	}

	const { data, error } = await supabase
		.from("comment_attachments")
		.select("id,user_id,kind,source,storage_path,title,alt_text,mime_type,file_size,created_at")
		.in("id", attachmentIds);

	if (error) {
		return {
			attachmentsById: {},
			mediaSchemaReady: isCommentMediaFeatureError(error) ? false : null,
		};
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

	return {
		attachmentsById: Object.fromEntries(entries),
		mediaSchemaReady: true,
	};
}

async function loadAuthorProfiles(loadedReviews: Review[]) {
	const authorIds = Array.from(
		new Set(
			loadedReviews
				.filter((review) => !review.is_deleted)
				.map((review) => review.author_id),
		),
	);

	if (!authorIds.length) return {};

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

	if (profileResult.error) return {};

	return Object.fromEntries(
		(profileResult.data ?? []).map((profile) => [
			profile.id,
			profile as AuthorProfile,
		]),
	);
}

async function loadReviewVotes(loadedReviews: Review[], activeUser: User | null) {
	const reviewIds = loadedReviews
		.filter((review) => !review.is_deleted)
		.map((review) => review.id);

	if (!activeUser || !reviewIds.length) {
		return {
			dislikedReviewIds: new Set<string>(),
			likedReviewIds: new Set<string>(),
		};
	}

	const voteResultWithReactions = await supabase
		.from("votes")
		.select("roast_id,reaction")
		.eq("voter_id", activeUser.id)
		.in("roast_id", reviewIds);

	const voteResult =
		voteResultWithReactions.error &&
		voteResultWithReactions.error.message.includes("reaction")
			? await supabase
					.from("votes")
					.select("roast_id")
					.eq("voter_id", activeUser.id)
					.in("roast_id", reviewIds)
			: voteResultWithReactions;

	if (voteResult.error) {
		return {
			dislikedReviewIds: new Set<string>(),
			likedReviewIds: new Set<string>(),
		};
	}

	return {
		dislikedReviewIds: new Set(
			voteResult.data
				.filter((vote) => "reaction" in vote && vote.reaction === "dislike")
				.map((vote) => vote.roast_id),
		),
		likedReviewIds: new Set(
			voteResult.data
				.filter((vote) => !("reaction" in vote) || vote.reaction === "like")
				.map((vote) => vote.roast_id),
		),
	};
}

export async function loadResumeThreadData(
	resumeId: string,
	activeUser: User | null,
): Promise<ResumeThreadData | null> {
	const reviewResultWithMedia = await supabase
		.from("roasts")
		.select(REVIEW_SELECT_WITH_MEDIA)
		.eq("resume_id", resumeId)
		.order("created_at", { ascending: false });

	const reviewResultWithThreads =
		reviewResultWithMedia.error &&
		isCommentMediaFeatureError(reviewResultWithMedia.error)
			? await supabase
					.from("roasts")
					.select(REVIEW_SELECT_WITH_THREADS)
					.eq("resume_id", resumeId)
					.order("created_at", { ascending: false })
			: reviewResultWithMedia;

	const mediaSchemaReady = !(
		reviewResultWithMedia.error &&
		isCommentMediaFeatureError(reviewResultWithMedia.error)
	);

	const reviewResultWithDeleteFallback =
		reviewResultWithThreads.error &&
		isDeleteFeatureError(reviewResultWithThreads.error)
			? await supabase
					.from("roasts")
					.select(REVIEW_SELECT_WITH_THREADS_LEGACY)
					.eq("resume_id", resumeId)
					.order("created_at", { ascending: false })
			: reviewResultWithThreads;

	const deleteSchemaReady = !(
		reviewResultWithThreads.error &&
		isDeleteFeatureError(reviewResultWithThreads.error)
	);

	const reviewResultWithReactions =
		reviewResultWithDeleteFallback.error &&
		(isMissingColumnError(reviewResultWithDeleteFallback.error, "parent_id") ||
			isMissingColumnError(reviewResultWithDeleteFallback.error, "reply_count"))
			? await supabase
					.from("roasts")
					.select(REVIEW_SELECT_WITH_REACTIONS)
					.eq("resume_id", resumeId)
					.order("created_at", { ascending: false })
			: reviewResultWithDeleteFallback;

	const replySchemaReady = !(
		reviewResultWithDeleteFallback.error &&
		(isMissingColumnError(reviewResultWithDeleteFallback.error, "parent_id") ||
			isMissingColumnError(reviewResultWithDeleteFallback.error, "reply_count"))
	);

	const reviewResult =
		reviewResultWithReactions.error &&
		isMissingColumnError(reviewResultWithReactions.error, "dislike_count")
			? await supabase
					.from("roasts")
					.select(REVIEW_SELECT_BASE)
					.eq("resume_id", resumeId)
					.order("created_at", { ascending: false })
			: reviewResultWithReactions;

	if (reviewResult.error) {
		return null;
	}

	const reviews = ((reviewResult.data ?? []) as Review[]).map((review) =>
		normalizeReview(review),
	);
	const [attachmentResult, authorProfiles, votes] = await Promise.all([
		loadReviewAttachmentMap(reviews),
		loadAuthorProfiles(reviews),
		loadReviewVotes(reviews, activeUser),
	]);

	return {
		attachmentsById: attachmentResult.attachmentsById,
		authorProfiles,
		deleteSchemaReady,
		dislikedReviewIds: votes.dislikedReviewIds,
		likedReviewIds: votes.likedReviewIds,
		mediaSchemaReady: attachmentResult.mediaSchemaReady ?? mediaSchemaReady,
		replySchemaReady,
		reviews,
	};
}
