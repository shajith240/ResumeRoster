"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { CommentAttachmentOption } from "@/components/CommentMediaToolbar";
import { announceRouteTransition } from "@/components/RouteTransitionLoader";
import { getAnonymousProfileUsername } from "@/lib/anonymous-profile";
import { getLoginPath } from "@/lib/auth-redirect";
import { getReviewContentIssue, normalizeCommentContent } from "@/lib/comment-media-validation";
import { formatCount } from "@/lib/feed-ranking";
import {
	buildGuidedReviewContent,
	getGuidedReviewIssue,
	type GuidedReviewIssueType,
} from "@/lib/guided-review";
import { buildThreadReviewTree, normalizeReview } from "@/lib/resume-thread";
import { capturePrivateError } from "@/lib/monitoring/capture-errors";
import { getResumeRoleLabel } from "@/lib/resume-display";
import { writeRecentPost } from "@/lib/recent-posts";
import { supabase } from "@/lib/supabase/client";
import type {
	CommentContentFormat,
	ResumeAuthorProfile,
	ResumeSummary,
	Review,
} from "@/lib/supabase/types";
import { toast } from "sonner";
import {
	REVIEW_SELECT_WITH_MEDIA,
	REVIEW_SELECT_WITH_THREADS,
	SUPABASE_MIGRATION_MESSAGE,
} from "./selectors";
import type { AuthorProfile } from "./types";
import {
	fetchLatestResumeStatus,
	fetchResumeAuthorProfile,
	fetchResumeWithFallback,
	loadResumeThreadData,
	recordResumeReadCount,
} from "./data";
import { useResumeOwnerActions } from "./use-owner-actions";
import { useReviewReportActions } from "./use-review-report-actions";
import { useReviewReactions } from "./use-review-reactions";
import {
	isCommentMediaFeatureError,
	isDeleteFeatureError,
	isGuidedReviewFeatureError,
	isMissingColumnError,
	isPermissionPolicyError,
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
	const [contentFormat, setContentFormat] =
		useState<CommentContentFormat>("plain");
	const [replyContent, setReplyContent] = useState("");
	const [replyContentFormat, setReplyContentFormat] =
		useState<CommentContentFormat>("plain");
	const [guidedIssueType, setGuidedIssueType] =
		useState<GuidedReviewIssueType | "">("");
	const [guidedIssue, setGuidedIssue] = useState("");
	const [guidedSuggestion, setGuidedSuggestion] = useState("");
	const [selectedAttachment, setSelectedAttachment] =
		useState<CommentAttachmentOption | null>(null);
	const [replyAttachment, setReplyAttachment] =
		useState<CommentAttachmentOption | null>(null);
	const [replyingToId, setReplyingToId] = useState<string | null>(null);
	const [submittingReplyId, setSubmittingReplyId] = useState("");
	const [deletingReviewId, setDeletingReviewId] = useState("");
	const [deleteTargetReview, setDeleteTargetReview] = useState<Review | null>(null);
	const [collapsedReviewIds, setCollapsedReviewIds] = useState<Set<string>>(
		new Set(),
	);
	const [attachmentsById, setAttachmentsById] = useState<
		Record<string, CommentAttachmentOption>
	>({});
	const [replySchemaReady, setReplySchemaReady] = useState(true);
	const [deleteSchemaReady, setDeleteSchemaReady] = useState(true);
	const [mediaSchemaReady, setMediaSchemaReady] = useState(true);
	const [guidedReviewSchemaReady, setGuidedReviewSchemaReady] = useState(true);
	const [needsGuidedReviewCredit, setNeedsGuidedReviewCredit] =
		useState(false);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [claiming, setClaiming] = useState(false);
	const [message, setMessage] = useState("");

	const threadReviews = useMemo(
		() => buildThreadReviewTree(reviews),
		[reviews],
	);
	const isOwner = Boolean(user && resume?.user_id === user.id);
	const isClosed = resume?.status === "closed";
	const isWaiting = resume?.review_queue_status === "waiting";
	const shouldUseGuidedReview = needsGuidedReviewCredit && !isOwner;
	const isClaimable = Boolean(
		resume?.is_premium &&
			resume.payment_status === "paid" &&
			!resume.assigned_reviewer_id &&
			resume.status === "open" &&
			!isOwner,
	);

	function goToLogin() {
		const loginRoute = getLoginPath(`/resume/${resumeId}`);
		announceRouteTransition(loginRoute);
		router.push(loginRoute);
	}

	function reportError(errorMessage: string) {
		setMessage(errorMessage);
		toast.error(errorMessage);
	}

	function captureResumeDetailError(
		error: unknown,
		operation: string,
		extra: Record<string, unknown> = {},
	) {
		capturePrivateError(error, {
			area: "resume_detail",
			operation,
			resumeId,
			route: "/resume/[id]",
			userId: user?.id ?? null,
			...extra,
		});
	}

	function reportInternalError(
		error: unknown,
		userMessage: string,
		operation: string,
		extra: Record<string, unknown> = {},
	) {
		captureResumeDetailError(error, operation, extra);
		reportError(userMessage);
	}

	function clearFeedbackDrafts() {
		setSelectedAttachment(null);
		setContent("");
		setContentFormat("plain");
		setGuidedIssueType("");
		setGuidedIssue("");
		setGuidedSuggestion("");
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

	const {
		confirmResumeOwnerAction,
		pendingResumeAction,
		requestDeleteResume,
		requestResumeStatusAction,
		resumeActionBusy,
		setPendingResumeAction,
	} = useResumeOwnerActions({
		clearFeedbackDrafts,
		isClosed,
		isOwner,
		reportError,
		resume,
		setMessage,
		setResume,
	});
	const {
		openReportDialog,
		reportDetails,
		reportReason,
		reportSchemaReady,
		reportTargetReview,
		setReportDetails,
		setReportReason,
		setReportTargetReview,
		submitReport,
		submittingReport,
	} = useReviewReportActions({
		goToLogin,
		reportError,
		reportInternalError,
		setMessage,
		user,
	});
	const { reactToReview } = useReviewReactions({
		captureResumeDetailError,
		dislikedReviewIds,
		goToLogin,
		isOwner,
		likedReviewIds,
		reportError,
		reportInternalError,
		setDislikedReviewIds,
		setLikedReviewIds,
		setMessage,
		setReviews,
		user,
	});

	async function reportFriendlyWriteError(
		error: { message?: string } | null,
		kind: "feedback" | "reply",
	) {
		const latestStatus = await fetchLatestResumeStatus(resumeId);

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
			captureResumeDetailError(signed.error, "create_resume_signed_url");
			setSignedUrlError("Resume preview could not be loaded.");
			return;
		}

		setSignedUrl(signed.data.signedUrl);
	}

	async function recordResumeRead(
		activeResume: ResumeSummary,
		activeUser: User | null,
	) {
		const { error, readCount } = await recordResumeReadCount(
			activeResume,
			activeUser,
		);

		if (error) {
			captureResumeDetailError(error, "record_resume_read");
			if (process.env.NODE_ENV !== "production") {
				console.warn("Resume read tracking failed:", error.message);
			}
			return;
		}

		if (readCount !== null) {
			setResume((current) =>
				current?.id === activeResume.id
					? { ...current, read_count: readCount }
					: current,
			);
		}
	}

	async function refreshReviewThread(activeUser: User | null) {
		const threadData = await loadResumeThreadData(resumeId, activeUser);

		if (!threadData) {
			return;
		}

		setReviews(threadData.reviews);
		setAttachmentsById(threadData.attachmentsById);
		setAuthorProfiles(threadData.authorProfiles);
		setLikedReviewIds(threadData.likedReviewIds);
		setDislikedReviewIds(threadData.dislikedReviewIds);
		setReplySchemaReady(threadData.replySchemaReady);
		setDeleteSchemaReady(threadData.deleteSchemaReady);
		setMediaSchemaReady(threadData.mediaSchemaReady);
	}

	async function refreshGuidedReviewNeed(activeUser: User | null) {
		if (!activeUser) {
			setNeedsGuidedReviewCredit(false);
			return;
		}

		const { data, error } = await supabase
			.from("resumes")
			.select(
				"id,status,review_queue_status,activation_reviews_required,activation_reviews_completed",
			)
			.eq("user_id", activeUser.id)
			.eq("status", "open")
			.eq("review_queue_status", "waiting")
			.limit(5);

		if (error) {
			if (!isGuidedReviewFeatureError(error)) {
				captureResumeDetailError(error, "load_guided_review_need", {
					activeUserId: activeUser.id,
				});
			}
			setNeedsGuidedReviewCredit(false);
			return;
		}

		setNeedsGuidedReviewCredit(
			(data ?? []).some(
				(row) =>
					(row.activation_reviews_required ?? 0) >
					(row.activation_reviews_completed ?? 0),
			),
		);
	}

	useEffect(() => {
		async function load() {
			const started = Date.now();
			const { data: userData } = await supabase.auth.getUser();
			const activeUser = userData.user;
			setUser(activeUser);

			const resumeResult = await fetchResumeWithFallback(resumeId);

			if (resumeResult.error) {
				captureResumeDetailError(resumeResult.error, "load_resume");
				setMessage("Resume could not be loaded. Refresh and try again.");
				setLoading(false);
				return;
			}

			if (!resumeResult.resume) {
				setMessage("Resume not found.");
				setLoading(false);
				return;
			}

			const loadedResume = resumeResult.resume;
			const loadedAuthorProfile = await fetchResumeAuthorProfile(loadedResume);
			setResume(loadedResume);
			setResumeAuthorProfile(loadedAuthorProfile);
			writeRecentPost({
				author:
					loadedResume.is_anonymous
						? "Anonymous reviewer"
						: loadedAuthorProfile?.full_name?.trim() ||
							loadedAuthorProfile?.username?.trim() ||
							"Community reviewer",
				comments: loadedResume.roast_count,
				createdAt: loadedResume.created_at,
				href: `/resume/${loadedResume.id}`,
				id: loadedResume.id,
				kind: "resume",
				meta: `${getResumeRoleLabel(loadedResume, loadedAuthorProfile)} - ${formatCount(loadedResume.read_count)} reads`,
				title: loadedResume.title,
				visitedAt: new Date().toISOString(),
			});

			if (activeUser) {
				await openResumeFile(loadedResume);
				void recordResumeRead(loadedResume, activeUser);
			}

			await refreshReviewThread(activeUser);
			await refreshGuidedReviewNeed(activeUser);

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
					const nextQueueStatus = payload.new?.review_queue_status as
						| ResumeSummary["review_queue_status"]
						| undefined;
					const nextActivationCompleted =
						typeof payload.new?.activation_reviews_completed === "number"
							? payload.new.activation_reviews_completed
							: undefined;

					if (!nextStatus && !nextQueueStatus) {
						return;
					}

					setResume((current) =>
						current
							? {
									...current,
									activation_reviews_completed:
										nextActivationCompleted ??
										current.activation_reviews_completed,
									review_queue_status:
										nextQueueStatus ?? current.review_queue_status,
									status: nextStatus ?? current.status,
								}
							: current,
					);

					if (nextStatus === "closed") {
						clearFeedbackDrafts();
						setMessage("This resume is closed for new feedback.");
					}

					if (nextQueueStatus === "active") {
						setMessage("");
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

	async function handleClaimResume() {
		if (!user) { goToLogin(); return; }

		setClaiming(true);
		const session = await supabase.auth.getSession();
		const accessToken = session.data.session?.access_token;
		if (!accessToken) {
			setClaiming(false);
			reportError("Your session expired. Sign in again.");
			return;
		}

		const response = await fetch(`/api/resumes/${resumeId}/claim`, {
			method: "POST",
			headers: { Authorization: `Bearer ${accessToken}` },
		});

		const result = (await response.json().catch(() => null)) as {
			claimed?: boolean;
			message?: string;
		} | null;

		setClaiming(false);

		if (!response.ok || !result?.claimed) {
			reportError(result?.message ?? "Could not claim this resume. Please try again.");
			return;
		}

		toast.success("Resume claimed.", {
			description: "You have 24 hours to submit your review.",
		});

		setResume((prev) =>
			prev ? { ...prev, assigned_reviewer_id: user.id } : prev,
		);
	}

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

		if (isWaiting) {
			reportError("This resume is still waiting for activation.");
			return;
		}

		let reviewContent = "";
		let reviewContentFormat: CommentContentFormat = contentFormat;
		let reviewGuidedIssueType: GuidedReviewIssueType | null = null;

		if (shouldUseGuidedReview) {
			const guidedIssueMessage = getGuidedReviewIssue({
				issue: guidedIssue,
				issueType: guidedIssueType,
				suggestion: guidedSuggestion,
			});

			if (guidedIssueMessage) {
				reportError(guidedIssueMessage);
				return;
			}

			if (!guidedIssueType) {
				reportError("Choose the resume issue you are reviewing.");
				return;
			}

			reviewGuidedIssueType = guidedIssueType;
			reviewContent = buildGuidedReviewContent({
				issue: guidedIssue,
				issueType: reviewGuidedIssueType,
				suggestion: guidedSuggestion,
			});
			reviewContentFormat = mediaSchemaReady ? "markdown" : "plain";
		} else {
			reviewContent = normalizeCommentContent(content);
		}

		const payloadIssue = getReviewContentIssue({
			attachmentId: selectedAttachment?.id,
			content: reviewContent,
			contentFormat: reviewContentFormat,
		});

		if (payloadIssue) {
			reportError(payloadIssue);
			return;
		}

		if ((selectedAttachment || reviewContentFormat === "markdown") && !mediaSchemaReady) {
			reportError(`${SUPABASE_MIGRATION_MESSAGE} Comment media is not ready yet.`);
			return;
		}

		setSubmitting(true);
		const reviewPayload: {
			author_id: string;
			attachment_id?: string | null;
			content: string;
			content_format?: CommentContentFormat;
			guided_issue_type?: GuidedReviewIssueType;
			is_guided_review?: boolean;
			resume_id: string;
		} = {
			resume_id: resumeId,
			author_id: user.id,
			content: reviewContent,
		};

		if (mediaSchemaReady) {
			reviewPayload.attachment_id = selectedAttachment?.id ?? null;
			reviewPayload.content_format = reviewContentFormat;
		}

		if (reviewGuidedIssueType && guidedReviewSchemaReady) {
			reviewPayload.guided_issue_type = reviewGuidedIssueType;
			reviewPayload.is_guided_review = true;
		}

		let insertResult = await supabase
			.from("roasts")
			.insert(reviewPayload)
			.select(
				mediaSchemaReady ? REVIEW_SELECT_WITH_MEDIA : REVIEW_SELECT_WITH_THREADS,
			)
			.single();

		if (
			insertResult.error &&
			isGuidedReviewFeatureError(insertResult.error) &&
			Boolean(reviewGuidedIssueType) &&
			guidedReviewSchemaReady
		) {
			setGuidedReviewSchemaReady(false);
			const legacyPayload = { ...reviewPayload };
			delete legacyPayload.guided_issue_type;
			delete legacyPayload.is_guided_review;
			insertResult = await supabase
				.from("roasts")
				.insert(legacyPayload)
				.select(
					mediaSchemaReady ? REVIEW_SELECT_WITH_MEDIA : REVIEW_SELECT_WITH_THREADS,
				)
				.single();
		}

		setSubmitting(false);

		const { data, error } = insertResult;

		if (error) {
			if (isCommentMediaFeatureError(error)) {
				setMediaSchemaReady(false);
				reportError(`${SUPABASE_MIGRATION_MESSAGE} Comment media is not ready yet.`);
				return;
			}

			if (await reportFriendlyWriteError(error, "feedback")) {
				return;
			}

			reportInternalError(
				error,
				"We could not post your feedback. Please try again.",
				"post_feedback",
			);
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
		setGuidedIssueType("");
		setGuidedIssue("");
		setGuidedSuggestion("");
		setSelectedAttachment(null);
		await refreshGuidedReviewNeed(user);
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

		if (isWaiting) {
			reportError("This resume is still waiting for activation.");
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

			reportInternalError(
				error,
				"We could not post your reply. Please try again.",
				"post_reply",
				{ parentReviewId: parentReview.id },
			);
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
		await refreshReviewThread(user);
		setResume((current) =>
			current
				? {
						...current,
						roast_count: Math.max(current.roast_count - 1, 0),
					}
				: current,
		);
		await refreshGuidedReviewNeed(user);
		toast.success(targetReview.parent_id ? "Reply deleted." : "Comment deleted.");
	}

	return {
		attachmentsById,
		authorProfiles,
		collapsedReviewIds,
		confirmResumeOwnerAction,
		deleteReview,
		deleteSchemaReady,
		deleteTargetReview,
		deletingReviewId,
		dislikedReviewIds,
		goToLogin,
		content,
		contentFormat,
		guidedIssue,
		guidedIssueType,
		guidedSuggestion,
		claiming,
		handleClaimResume,
		handleReplySubmit,
		handleReviewSubmit,
		isClosed,
		isClaimable,
		isOwner,
		isWaiting,
		likedReviewIds,
		loading,
		mediaSchemaReady,
		message,
		needsGuidedReviewCredit: shouldUseGuidedReview,
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
		setDeleteTargetReview,
		setContent,
		setContentFormat,
		setGuidedIssue,
		setGuidedIssueType,
		setGuidedSuggestion,
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
		threadReviews,
		toggleReviewReplies,
		user,
	};
}
