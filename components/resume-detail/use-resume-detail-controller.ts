"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { CommentAttachmentOption } from "@/components/CommentMediaToolbar";
import { announceRouteTransition } from "@/components/RouteTransitionLoader";
import { getAnonymousProfileUsername } from "@/lib/anonymous-profile";
import { getLoginPath } from "@/lib/auth-redirect";
import { getReviewContentIssue, normalizeCommentContent } from "@/lib/comment-media-validation";
import { buildThreadReviewTree, normalizeReview } from "@/lib/resume-thread";
import { getReportIssue, type ReportReason } from "@/lib/report-validation";
import { supabase } from "@/lib/supabase/client";
import type {
	CommentAttachment,
	CommentContentFormat,
	ResumeAuthorProfile,
	ResumeSummary,
	Review,
} from "@/lib/supabase/types";
import { toast } from "sonner";
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
	SUPABASE_MIGRATION_MESSAGE,
} from "./selectors";
import type { AuthorProfile, Reaction, ResumeOwnerAction, ResumeQueryResult } from "./types";
import { createThreadRenderIndexMap } from "./thread-review-item";
import {
	isAuthorProfileFeatureError,
	isCommentMediaFeatureError,
	isDeleteFeatureError,
	isMissingColumnError,
	isPermissionPolicyError,
	isReadCountFeatureError,
	isReportFeatureError,
	isResumeContextFeatureError,
	withResumeDefaults,
} from "./utils";

export function useResumeDetailController(resumeId: string) {
	const router = useRouter();
	const [user, setUser] = useState<User | null>(null);
	const [resume, setResume] = useState<ResumeSummary | null>(null);
	const [resumeAuthorProfile, setResumeAuthorProfile] =
		useState<ResumeAuthorProfile | null>(null);
	const [reviews, setReviews] = useState<Review[]>([]);
	const [authorProfiles, setAuthorProfiles] = useState<
		Record<string, AuthorProfile>
	>({});
	const [likedReviewIds, setLikedReviewIds] = useState<Set<string>>(new Set());
	const [dislikedReviewIds, setDislikedReviewIds] = useState<Set<string>>(
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
	const [deletingReviewId, setDeletingReviewId] = useState("");
	const [deleteTargetReview, setDeleteTargetReview] = useState<Review | null>(null);
	const [pendingResumeAction, setPendingResumeAction] =
		useState<ResumeOwnerAction | null>(null);
	const [resumeActionBusy, setResumeActionBusy] = useState(false);
	const [reportTargetReview, setReportTargetReview] = useState<Review | null>(null);
	const [reportReason, setReportReason] =
		useState<ReportReason>("personal_info");
	const [reportDetails, setReportDetails] = useState("");
	const [submittingReport, setSubmittingReport] = useState(false);
	const [collapsedReviewIds, setCollapsedReviewIds] = useState<Set<string>>(
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

	const threadReviews = useMemo(
		() => buildThreadReviewTree(reviews, collapsedReviewIds),
		[collapsedReviewIds, reviews],
	);
	const threadRenderIndexById = useMemo(
		() => createThreadRenderIndexMap(threadReviews),
		[threadReviews],
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

	function clearFeedbackDrafts() {
		setContent("");
		setContentFormat("plain");
		setSelectedAttachment(null);
		setReplyingToId(null);
		setReplyContent("");
		setReplyContentFormat("plain");
		setReplyAttachment(null);
	}

	function applyClosedResumeState(errorMessage: string) {
		setResume((current) =>
			current ? { ...current, status: "closed" } : current,
		);
		clearFeedbackDrafts();
		reportError(errorMessage);
	}

	async function fetchLatestResumeStatus() {
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

	async function reportFriendlyWriteError(
		error: { message?: string } | null,
		kind: "feedback" | "reply",
	) {
		const latestStatus = await fetchLatestResumeStatus();

		if (latestStatus === "closed") {
			applyClosedResumeState(
				kind === "reply"
					? "This resume is closed, so new replies cannot be posted."
					: "This resume is closed, so new feedback cannot be posted.",
			);
			return true;
		}

		if (isPermissionPolicyError(error)) {
			reportError(
				"We could not save this because your account is not allowed to do that action. Refresh the page and try again.",
			);
			return true;
		}

		return false;
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

	async function loadReviewAttachments(loadedReviews: Review[]) {
		const attachmentIds = Array.from(
			new Set(
				loadedReviews
					.map((review) => review.attachment_id)
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

	async function loadReviewThread(activeUser: User | null) {
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

		setMediaSchemaReady(
			!(
				reviewResultWithMedia.error &&
				isCommentMediaFeatureError(reviewResultWithMedia.error)
			),
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

		setDeleteSchemaReady(
			!(
				reviewResultWithThreads.error &&
				isDeleteFeatureError(reviewResultWithThreads.error)
			),
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

		setReplySchemaReady(
			!(
				reviewResultWithDeleteFallback.error &&
				(isMissingColumnError(reviewResultWithDeleteFallback.error, "parent_id") ||
					isMissingColumnError(reviewResultWithDeleteFallback.error, "reply_count"))
			),
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
			return;
		}

		const loadedReviews = ((reviewResult.data ?? []) as Review[]).map((review) =>
			normalizeReview(review),
		);
		setReviews(loadedReviews);
		await loadReviewAttachments(loadedReviews);

		const authorIds = Array.from(
			new Set(
				loadedReviews
					.filter((review) => !review.is_deleted)
					.map((review) => review.author_id),
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

		const reviewIds = loadedReviews
			.filter((review) => !review.is_deleted)
			.map((review) => review.id);

		if (activeUser && reviewIds.length) {
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

			if (!voteResult.error) {
				setLikedReviewIds(
					new Set(
						voteResult.data
							.filter((vote) => !("reaction" in vote) || vote.reaction === "like")
							.map((vote) => vote.roast_id),
					),
				);
				setDislikedReviewIds(
					new Set(
						voteResult.data
							.filter((vote) => "reaction" in vote && vote.reaction === "dislike")
							.map((vote) => vote.roast_id),
					),
				);
			}
		} else {
			setLikedReviewIds(new Set());
			setDislikedReviewIds(new Set());
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

			await loadReviewThread(activeUser);

			const elapsed = Date.now() - started;
			window.setTimeout(() => setLoading(false), Math.max(0, 300 - elapsed));
		}

		void load();
	}, [resumeId]);

	useEffect(() => {
		const channel = supabase
			.channel(`resume-status:${resumeId}`)
			.on(
				"postgres_changes",
				{
					event: "UPDATE",
					filter: `id=eq.${resumeId}`,
					schema: "public",
					table: "resumes",
				},
				(payload) => {
					const nextStatus = payload.new?.status as
						| ResumeSummary["status"]
						| undefined;

					if (!nextStatus) {
						return;
					}

					setResume((current) =>
						current ? { ...current, status: nextStatus } : current,
					);

					if (nextStatus === "closed") {
						clearFeedbackDrafts();
						setMessage("This resume is closed for new feedback.");
					}
				},
			)
			.on(
				"postgres_changes",
				{
					event: "DELETE",
					filter: `id=eq.${resumeId}`,
					schema: "public",
					table: "resumes",
				},
				() => {
					toast.info("This resume was deleted.");
					announceRouteTransition("/feed");
					router.push("/feed");
				},
			)
			.subscribe();

		return () => {
			void supabase.removeChannel(channel);
		};
	}, [resumeId, router]);

	async function handleReviewSubmit(event: FormEvent<HTMLFormElement>) {
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

		const reviewContent = normalizeCommentContent(content);
		const payloadIssue = getReviewContentIssue({
			attachmentId: selectedAttachment?.id,
			content: reviewContent,
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
		const reviewPayload: {
			author_id: string;
			attachment_id?: string | null;
			content: string;
			content_format?: CommentContentFormat;
			resume_id: string;
		} = {
			resume_id: resumeId,
			author_id: user.id,
			content: reviewContent,
		};

		if (mediaSchemaReady) {
			reviewPayload.attachment_id = selectedAttachment?.id ?? null;
			reviewPayload.content_format = contentFormat;
		}

		const { data, error } = await supabase
			.from("roasts")
			.insert(reviewPayload)
			.select(
				mediaSchemaReady ? REVIEW_SELECT_WITH_MEDIA : REVIEW_SELECT_WITH_THREADS,
			)
			.single();

		setSubmitting(false);

		if (error) {
			if (isCommentMediaFeatureError(error)) {
				setMediaSchemaReady(false);
				reportError(`${SUPABASE_MIGRATION_MESSAGE} Comment media is not ready yet.`);
				return;
			}

			if (await reportFriendlyWriteError(error, "feedback")) {
				return;
			}

			reportError(error.message);
			return;
		}

		setReviews((current) => [normalizeReview(data as unknown as Review), ...current]);
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
				username: getAnonymousProfileUsername(user.id),
				full_name: null,
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
		parentReview: Review,
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

		if (parentReview.author_id === user.id) {
			reportError("You cannot reply to your own feedback.");
			return;
		}

		if (isClosed) {
			reportError("This resume is closed for new replies.");
			return;
		}

		const replyText = normalizeCommentContent(replyContent);
		const payloadIssue = getReviewContentIssue({
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

		setSubmittingReplyId(parentReview.id);
		const replyPayload: {
			author_id: string;
			attachment_id?: string | null;
			content: string;
			content_format?: CommentContentFormat;
			parent_id: string;
			resume_id: string;
		} = {
			resume_id: resumeId,
			parent_id: parentReview.id,
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
			.select(
				mediaSchemaReady ? REVIEW_SELECT_WITH_MEDIA : REVIEW_SELECT_WITH_THREADS,
			)
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

			if (await reportFriendlyWriteError(error, "reply")) {
				return;
			}

			reportError(error.message);
			return;
		}

		const nextReply = normalizeReview(data as unknown as Review);
		setReviews((current) => [
			nextReply,
			...current.map((review) =>
				review.id === parentReview.id
					? { ...review, reply_count: (review.reply_count ?? 0) + 1 }
					: review,
			),
		]);
		if (replyAttachment) {
			setAttachmentsById((current) => ({
				...current,
				[replyAttachment.id]: replyAttachment,
			}));
		}
		setCollapsedReviewIds((current) => {
			const next = new Set(current);
			next.delete(parentReview.id);
			return next;
		});
		setAuthorProfiles((current) => ({
			...current,
			[user.id]: {
				id: user.id,
				username: getAnonymousProfileUsername(user.id),
				full_name: null,
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

	function toggleReviewReplies(reviewId: string) {
		setCollapsedReviewIds((current) => {
			const next = new Set(current);
			if (next.has(reviewId)) {
				next.delete(reviewId);
			} else {
				next.add(reviewId);
			}
			return next;
		});
	}

	async function reactToReview(targetReview: Review, reaction: Reaction) {
		setMessage("");

		if (!user) {
			goToLogin();
			return;
		}

		if (targetReview.author_id === user.id) {
			reportError("You cannot react to your own feedback.");
			return;
		}

		if (isOwner) {
			reportError("Resume owners cannot react to feedback for their own resume.");
			return;
		}

		const currentReaction = likedReviewIds.has(targetReview.id)
			? "like"
			: dislikedReviewIds.has(targetReview.id)
				? "dislike"
				: null;

		const applyLocalReaction = (nextReaction: Reaction | null) => {
			setLikedReviewIds((current) => {
				const next = new Set(current);
				if (nextReaction === "like") {
					next.add(targetReview.id);
				} else {
					next.delete(targetReview.id);
				}
				return next;
			});
			setDislikedReviewIds((current) => {
				const next = new Set(current);
				if (nextReaction === "dislike") {
					next.add(targetReview.id);
				} else {
					next.delete(targetReview.id);
				}
				return next;
			});
			setReviews((current) =>
				current.map((review) => {
					if (review.id !== targetReview.id) return review;

					const removeLike = currentReaction === "like" ? -1 : 0;
					const addLike = nextReaction === "like" ? 1 : 0;
					const removeDislike = currentReaction === "dislike" ? -1 : 0;
					const addDislike = nextReaction === "dislike" ? 1 : 0;

					return {
						...review,
						helpful_votes: Math.max(
							0,
							review.helpful_votes + removeLike + addLike,
						),
						dislike_count: Math.max(
							0,
							(review.dislike_count ?? 0) + removeDislike + addDislike,
						),
					};
				}),
			);
		};

		if (currentReaction === reaction) {
			const { error } = await supabase
				.from("votes")
				.delete()
				.eq("roast_id", targetReview.id)
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
					.eq("roast_id", targetReview.id)
					.eq("voter_id", user.id)
			: supabase.from("votes").insert({
					roast_id: targetReview.id,
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
		toast.success(reaction === "like" ? "Liked feedback." : "Disliked feedback.");
	}

	async function updateResumeStatus(
		nextStatus: Extract<ResumeSummary["status"], "open" | "closed">,
	) {
		setMessage("");

		if (!resume || !isOwner) {
			reportError("Only the resume owner can change this thread status.");
			return false;
		}

		setResumeActionBusy(true);
		const { error } = await supabase
			.from("resumes")
			.update({ status: nextStatus })
			.eq("id", resume.id);
		setResumeActionBusy(false);

		if (error) {
			reportError(
				isPermissionPolicyError(error)
					? "Only the resume owner can change this thread status."
					: "We could not update this resume status. Please try again.",
			);
			return false;
		}

		setResume((current) =>
			current ? { ...current, status: nextStatus } : current,
		);

		if (nextStatus === "closed") {
			clearFeedbackDrafts();
			setMessage("This resume is now closed for new feedback.");
			toast.success("Feedback closed.");
		} else {
			setMessage("This resume is open for feedback again.");
			toast.success("Feedback reopened.");
		}

		return true;
	}

	async function deleteResume() {
		setMessage("");

		if (!resume || !isOwner) {
			reportError("Only the resume owner can delete this submission.");
			return false;
		}

		setResumeActionBusy(true);
		const removeFile = await supabase.storage
			.from("resumes")
			.remove([resume.file_path]);
		if (removeFile.error) {
			setResumeActionBusy(false);
			reportError("We could not delete the resume file. Please try again.");
			return false;
		}

		const { error } = await supabase
			.from("resumes")
			.delete()
			.eq("id", resume.id);
		setResumeActionBusy(false);

		if (error) {
			reportError(
				isPermissionPolicyError(error)
					? "Only the resume owner can delete this submission."
					: "We could not delete this submission. Please try again.",
			);
			return false;
		}

		toast.success("Resume deleted.");
		announceRouteTransition("/feed");
		router.push("/feed");
		return true;
	}

	function requestResumeStatusAction() {
		setMessage("");

		if (!resume || !isOwner) {
			reportError("Only the resume owner can change this thread status.");
			return;
		}

		setPendingResumeAction(isClosed ? "reopen" : "close");
	}

	function requestDeleteResume() {
		setMessage("");

		if (!resume || !isOwner) {
			reportError("Only the resume owner can delete this submission.");
			return;
		}

		setPendingResumeAction("delete");
	}

	async function confirmResumeOwnerAction() {
		if (!pendingResumeAction) {
			return;
		}

		if (pendingResumeAction === "delete") {
			const deleted = await deleteResume();
			if (deleted) {
				setPendingResumeAction(null);
			}
			return;
		}

		const updated = await updateResumeStatus(
			pendingResumeAction === "close" ? "closed" : "open",
		);

		if (updated) {
			setPendingResumeAction(null);
		}
	}

	async function requestDeleteReview(targetReview: Review) {
		setMessage("");

		if (!deleteSchemaReady) {
			reportError(`${SUPABASE_MIGRATION_MESSAGE} Comment deletes are not ready yet.`);
			return;
		}

		if (!user) {
			goToLogin();
			return;
		}

		if (targetReview.author_id !== user.id) {
			reportError("You can only delete comments or replies you wrote.");
			return;
		}

		if (targetReview.is_deleted) {
			reportError("This comment has already been deleted.");
			return;
		}

		setDeleteTargetReview(targetReview);
	}

	async function deleteReview(targetReview: Review | null) {
		setMessage("");

		if (!targetReview) {
			return;
		}

		if (!user) {
			goToLogin();
			return;
		}

		setDeletingReviewId(targetReview.id);

		const { error } = await supabase.rpc("delete_roast", {
			target_roast_id: targetReview.id,
		});

		setDeletingReviewId("");
		setDeleteTargetReview(null);

		if (error) {
			if (isDeleteFeatureError(error)) {
				setDeleteSchemaReady(false);
				reportError(`${SUPABASE_MIGRATION_MESSAGE} Comment deletes are not ready yet.`);
				return;
			}

			reportError(
				isPermissionPolicyError(error)
					? "You can only delete comments or replies you wrote."
					: "We could not delete this comment. Please try again.",
			);
			return;
		}

		setReplyingToId((current) =>
			current === targetReview.id ? null : current,
		);
		setReplyContent("");
		setReplyContentFormat("plain");
		setReplyAttachment(null);
		await loadReviewThread(user);
		setResume((current) =>
			current
				? {
						...current,
						roast_count: Math.max(current.roast_count - 1, 0),
					}
				: current,
		);
		toast.success(targetReview.parent_id ? "Reply deleted." : "Comment deleted.");
	}

	function openReportDialog(targetReview: Review) {
		setMessage("");

		if (!reportSchemaReady) {
			reportError(`${SUPABASE_MIGRATION_MESSAGE} Reports are not ready yet.`);
			return;
		}

		if (!user) {
			goToLogin();
			return;
		}

		if (targetReview.author_id === user.id) {
			reportError("You cannot report your own feedback.");
			return;
		}

		if (targetReview.is_deleted) {
			reportError("Deleted feedback cannot be reported.");
			return;
		}

		setReportReason("personal_info");
		setReportDetails("");
		setReportTargetReview(targetReview);
	}

	async function submitReport(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setMessage("");

		if (!reportTargetReview) {
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
			report_target_type: "review",
			target_resume_id: reportTargetReview.resume_id,
			target_roast_id: reportTargetReview.id,
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
		setReportTargetReview(null);
		setReportDetails("");
		toast.success(
			reportResult?.was_duplicate
				? "Report updated in the moderation queue."
				: "Report sent for moderation review.",
		);
	}

	return {
		attachmentsById,
		authorProfiles,
		collapsedReviewIds,
		confirmResumeOwnerAction,
		content,
		contentFormat,
		deleteReview,
		deleteSchemaReady,
		deleteTargetReview,
		deletingReviewId,
		dislikedReviewIds,
		goToLogin,
		handleReplySubmit,
		handleReviewSubmit,
		isClosed,
		isOwner,
		likedReviewIds,
		loading,
		mediaSchemaReady,
		message,
		openReportDialog,
		openResumeFile,
		pendingResumeAction,
		reactToReview,
		replyAttachment,
		replyContent,
		replyContentFormat,
		replyingToId,
		replySchemaReady,
		reportDetails,
		reportReason,
		reportSchemaReady,
		reportTargetReview,
		requestDeleteResume,
		requestDeleteReview,
		requestResumeStatusAction,
		resume,
		resumeActionBusy,
		resumeAuthorProfile,
		reviews,
		selectedAttachment,
		setContent,
		setContentFormat,
		setDeleteTargetReview,
		setPendingResumeAction,
		setReportDetails,
		setReportReason,
		setReportTargetReview,
		setReplyAttachment,
		setReplyContent,
		setReplyContentFormat,
		setReplyingToId,
		setSelectedAttachment,
		signedUrl,
		signedUrlError,
		submitReport,
		submitting,
		submittingReport,
		submittingReplyId,
		threadRenderIndexById,
		threadReviews,
		toggleReviewReplies,
		user,
	};
}
