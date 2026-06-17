"use client";

import {
	type CSSProperties,
	type FormEvent,
	type MouseEvent as ReactMouseEvent,
	type PointerEvent as ReactPointerEvent,
	type WheelEvent as ReactWheelEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DotsThree as MoreHorizontal, X } from "@phosphor-icons/react";
import {
	ChevronLeft,
	ChevronUp,
	Check,
	Download,
	Edit3,
	Flag,
	Forward,
	Lock,
	MessageCircle,
	Share2,
	Trash2,
	Unlock,
} from "@/components/ui/solar-icons";
import { toast } from "sonner";
import type { CommentAttachmentOption } from "@/components/CommentMediaToolbar";
import CommunityMarkdown from "@/components/community/CommunityMarkdown";
import CommunityMediaGallery from "@/components/community/CommunityMediaGallery";
import LoadingScreen from "@/components/LoadingScreen";
import { announceRouteTransition } from "@/components/RouteTransitionLoader";
import ReactionIcon from "@/components/reactions/ReactionIcon";
import { CommentComposer } from "@/components/resume-detail/comment-composer";
import { PresenceAvatar } from "@/components/user-presence/PresenceAvatar";
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
import { getFreshAuthSession } from "@/lib/auth-session";
import {
	buildMentionSuggestions,
	buildMentionTargetMap,
	extractMentionHandlesFromTexts,
	getMentionHandleKey,
	lookupMentionSuggestionsByHandles,
	MENTION_TEXT_PATTERN,
	mergeMentionSuggestions,
	type MentionSuggestion,
} from "@/lib/comment-mentions";
import { COMMUNITY_POST_TYPE_LABELS, type CommunityPostType } from "@/lib/community";
import {
	canDeleteCommunityPost,
	canEditCommunityPost,
	getCommunityCommentReactionBlockReason,
	getCommunityCommentReplyBlockReason,
	getCommunityPollVoteBlockReason,
	getCommunityPostReactionBlockReason,
} from "@/lib/community-guardrails";
import {
	buildCommunityCommentTree,
	COMMUNITY_COMMENT_MAX_DEPTH,
	type CommunityCommentNode,
} from "@/lib/community-threading";
import { formatCount } from "@/lib/feed-ranking";
import { filterCommunityInlineAttachments } from "@/lib/community-markdown";
import { getOptimisticCommunityVoteCounts } from "@/lib/community-optimistic";
import {
	getReportIssue,
	REPORT_REASON_OPTIONS,
	type ReportReason,
} from "@/lib/report-validation";
import { removeRecentPost, writeRecentPost } from "@/lib/recent-posts";
import { loadOnlineProfileIds } from "@/lib/online-presence";
import { resolveProfileAvatarUrl } from "@/lib/supabase/avatars";
import { supabase } from "@/lib/supabase/client";
import type {
	CommentAttachment,
	CommunityPostAttachment,
	CommunityPostComment,
	CommunityPostPoll,
	CommunityPostPollOption,
	CommunityPostStatus,
	CommunityVoteReaction,
	CommentContentFormat,
	ResumeAuthorProfile,
} from "@/lib/supabase/types";
import { useAdminAccess } from "@/lib/use-admin-access";
import reportStyles from "./CommunityReportDialog.module.css";

type CommunityPost = {
	author_id: string;
	body: string;
	comment_count: number;
	created_at: string;
	downvote_count: number;
	id: string;
	post_type: CommunityPostType;
	status: CommunityPostStatus;
	title: string;
	topic_id: string;
	upvote_count: number;
	updated_at: string;
};

type CommunityTopic = {
	id: string;
	name: string;
	slug: string;
};

type CommunityPostDetailProps = {
	postId: string;
};

type PublicAttachment = CommunityPostAttachment & {
	publicUrl: string;
};

type CommunityCommentLoadResult = {
	data: CommunityPostComment[];
	error: { message?: string } | null;
};

type ProfilePreview = Pick<
	ResumeAuthorProfile,
	"avatar_path" | "avatar_url" | "full_name" | "id" | "is_online" | "username"
>;

type SubmitCommentResponse = {
	id?: string;
	message?: string;
	status?: CommunityPostComment["status"];
};

type VoteActionResponse = {
	downvoteCount?: number;
	message?: string;
	reaction?: CommunityVoteReaction | null;
	upvoteCount?: number;
};

type PollVoteActionResponse = {
	message?: string;
	optionId?: string;
	pollId?: string;
};

type PostEditResponse = {
	message?: string;
	post?: {
		body: string;
		id: string;
		status: CommunityPostStatus;
		title: string;
		updatedAt: string;
	};
};

type PostDeleteResponse = {
	message?: string;
	post?: {
		deletedAt: string | null;
		id: string;
		status: "deleted";
	};
};

type CommentEditResponse = {
	comment?: {
		body: string;
		id: string;
		status: CommunityPostComment["status"];
		updatedAt: string;
	};
	message?: string;
};

type CommentDeleteResponse = {
	comment?: {
		deletedAt: string | null;
		id: string;
		status: CommunityPostComment["status"];
	};
	message?: string;
};

type PostLockResponse = {
	message?: string;
	post?: {
		id: string;
		status: CommunityPostStatus;
		updatedAt: string;
	};
};

type CommunityReportTarget =
	| {
			id: string;
			type: "post";
	  }
	| {
			id: string;
			postId: string;
			type: "comment";
	  };

type CommunityPollView = CommunityPostPoll & {
	options: CommunityPostPollOption[];
	selectedOptionId: string;
};

type MobileSheetState = "open" | "peek";

const COMMUNITY_COMMENT_SELECT =
	"id,post_id,parent_id,author_id,body,status,reply_count,upvote_count,downvote_count,deleted_at,created_at,updated_at";
const COMMUNITY_COMMENT_WITH_ATTACHMENT_SELECT = `${COMMUNITY_COMMENT_SELECT},attachment_id`;

function formatDate(value: string) {
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function formatFeedDate(value: string) {
	const date = new Date(value);
	const currentYear = new Date().getFullYear();
	const showYear = date.getFullYear() !== currentYear;

	return new Intl.DateTimeFormat(undefined, {
		day: "numeric",
		month: "short",
		year: showYear ? "numeric" : undefined,
	}).format(date);
}

function getAuthorName(profile: ProfilePreview | null) {
	return profile?.full_name?.trim() || profile?.username?.trim() || "Community member";
}

function getCommunityAuthorHandle(authorId: string, profile: ProfilePreview | null) {
	const name =
		profile?.username?.trim() ||
		profile?.full_name?.trim() ||
		`member-${authorId.slice(0, 6)}`;
	return name.startsWith("@") ? name : `@${name}`;
}

function getCommunityAuthorAvatar(authorId: string, profile: ProfilePreview | null) {
	return resolveProfileAvatarUrl(profile, authorId);
}

function applyCommunityPollSelection(
	poll: CommunityPollView,
	nextOptionId: string,
) {
	const previousOptionId = poll.selectedOptionId;

	return {
		...poll,
		options: poll.options.map((option) => {
			if (option.id === previousOptionId && previousOptionId !== nextOptionId) {
				return {
					...option,
					vote_count: Math.max(0, option.vote_count - 1),
				};
			}

			if (option.id === nextOptionId && previousOptionId !== nextOptionId) {
				return {
					...option,
					vote_count: option.vote_count + 1,
				};
			}

			return option;
		}),
		selectedOptionId: nextOptionId,
	};
}

async function getAccessToken() {
	const { session } = await getFreshAuthSession();
	return session?.access_token ?? "";
}

function isMobileViewport() {
	return (
		typeof window !== "undefined" &&
		window.matchMedia("(max-width: 760px)").matches
	);
}

function isMobileGestureBlocked(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) return false;

	if (target.closest("[data-mobile-body-toggle]")) return false;
	if (target.closest(".community-comments-sheet-handle")) return false;
	if (target.closest(".community-mobile-sheet-grabber")) return false;

	return Boolean(
		target.closest(
			"button,a,input,textarea,select,label,[role='button'],[data-mobile-gesture-block]",
		),
	);
}

function getScore(row: { downvote_count: number; upvote_count: number }) {
	return row.upvote_count - row.downvote_count;
}

function getRecentCommunityPostImage(attachments: PublicAttachment[]) {
	const imageAttachment = attachments.find((attachment) =>
		attachment.mime_type?.startsWith("image/"),
	);

	return imageAttachment?.publicUrl ?? null;
}

function findCommunityCommentNode(
	nodes: CommunityCommentNode[],
	commentId: string,
): CommunityCommentNode | null {
	for (const node of nodes) {
		if (node.id === commentId) return node;

		const child = findCommunityCommentNode(node.children, commentId);
		if (child) return child;
	}

	return null;
}

function isCommunityCommentMediaFeatureError(error: { message?: string } | null) {
	return /attachment_id|comment_attachments|schema cache|column/i.test(
		error?.message ?? "",
	);
}

async function fetchCommunityComments(
	postId: string,
): Promise<CommunityCommentLoadResult> {
	const commentResult = await supabase
		.from("community_post_comments")
		.select(COMMUNITY_COMMENT_WITH_ATTACHMENT_SELECT)
		.eq("post_id", postId)
		.order("created_at", { ascending: true });

	if (!commentResult.error || !isCommunityCommentMediaFeatureError(commentResult.error)) {
		return {
			data: (commentResult.data ?? []) as CommunityPostComment[],
			error: commentResult.error ?? null,
		};
	}

	const fallbackResult = await supabase
		.from("community_post_comments")
		.select(COMMUNITY_COMMENT_SELECT)
		.eq("post_id", postId)
		.order("created_at", { ascending: true });
	const fallbackComments = ((fallbackResult.data ?? []) as CommunityPostComment[]).map(
		(comment) => ({
			...comment,
			attachment_id: null,
		}),
	);

	return {
		data: fallbackComments,
		error: fallbackResult.error ?? null,
	};
}

function CommunityCommentAttachment({
	attachment,
}: {
	attachment?: CommentAttachmentOption | null;
}) {
	if (!attachment?.publicUrl) return null;

	return (
		<figure className="roast-attachment">
			<img
				alt={attachment.alt_text || attachment.title}
				decoding="async"
				loading="lazy"
				src={attachment.publicUrl}
			/>
		</figure>
	);
}

function isMissingPollSchema(message: string) {
	return /community_post_polls|community_post_poll_options|community_post_poll_votes|schema cache|relation .* does not exist/i.test(
		message,
	);
}

export default function CommunityPostDetail({ postId }: CommunityPostDetailProps) {
	const router = useRouter();
	const { isAdmin } = useAdminAccess();
	const [actionBusy, setActionBusy] = useState("");
	const [attachments, setAttachments] = useState<PublicAttachment[]>([]);
	const [commentAttachment, setCommentAttachment] =
		useState<CommentAttachmentOption | null>(null);
	const [commentAttachmentsById, setCommentAttachmentsById] = useState<
		Record<string, CommentAttachmentOption>
	>({});
	const [commentBody, setCommentBody] = useState("");
	const [commentContentFormat, setCommentContentFormat] =
		useState<CommentContentFormat>("plain");
	const [rootCommentComposerOpen, setRootCommentComposerOpen] = useState(false);
	const [commentReactions, setCommentReactions] = useState<
		Record<string, CommunityVoteReaction | null>
	>({});
	const [comments, setComments] = useState<CommunityPostComment[]>([]);
	const [collapsedCommentIds, setCollapsedCommentIds] = useState<Set<string>>(
		() => new Set(),
	);
	const [currentUserId, setCurrentUserId] = useState("");
	const [editingCommentId, setEditingCommentId] = useState("");
	const [editingPost, setEditingPost] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");
	const [loading, setLoading] = useState(true);
	const [keyboardInset, setKeyboardInset] = useState(0);
	const [mobileActionSheetOpen, setMobileActionSheetOpen] = useState(false);
	const [mobileComposerOpen, setMobileComposerOpen] = useState(false);
	const mobileComposerFormRef = useRef<HTMLFormElement | null>(null);
	const [mobileCommentsSheetDrag, setMobileCommentsSheetDrag] = useState(0);
	const [mobileCommentsSheetState, setMobileCommentsSheetState] =
		useState<MobileSheetState>("peek");
	const hasAutoOpenedSheetRef = useRef(false);
	const [mobilePostBodyExpanded, setMobilePostBodyExpanded] = useState(false);
	const [post, setPost] = useState<CommunityPost | null>(null);
	const [postDeleteConfirmOpen, setPostDeleteConfirmOpen] = useState(false);
	const [postEditBody, setPostEditBody] = useState("");
	const [postEditTitle, setPostEditTitle] = useState("");
	const [poll, setPoll] = useState<CommunityPollView | null>(null);
	const [postReaction, setPostReaction] = useState<CommunityVoteReaction | null>(
		null,
	);
	const [profiles, setProfiles] = useState<Record<string, ProfilePreview>>({});
	const [resolvedMentionSuggestions, setResolvedMentionSuggestions] = useState<
		MentionSuggestion[]
	>([]);
	const [replyBodies, setReplyBodies] = useState<Record<string, string>>({});
	const [replyAttachments, setReplyAttachments] = useState<
		Record<string, CommentAttachmentOption | null>
	>({});
	const [replyContentFormat, setReplyContentFormat] =
		useState<CommentContentFormat>("plain");
	const [replyingToId, setReplyingToId] = useState("");
	const [reportDetails, setReportDetails] = useState("");
	const [reportReason, setReportReason] =
		useState<ReportReason>("personal_info");
	const [reportTarget, setReportTarget] = useState<CommunityReportTarget | null>(
		null,
	);
	const [submittingReport, setSubmittingReport] = useState(false);
	const [commentEditBody, setCommentEditBody] = useState("");
	const [pendingDeleteComment, setPendingDeleteComment] =
		useState<CommunityPostComment | null>(null);
	const [topic, setTopic] = useState<CommunityTopic | null>(null);

	const loadPost = useCallback(async () => {
		setLoading(true);
		setErrorMessage("");

		const { session } = await getFreshAuthSession();
		const userId = session?.user?.id ?? "";
		setCurrentUserId(userId);

		const { data, error } = await supabase
			.from("community_posts")
			.select(
				"id,author_id,title,body,post_type,status,topic_id,comment_count,upvote_count,downvote_count,created_at,updated_at",
			)
			.eq("id", postId)
			.maybeSingle();

		if (error || !data) {
			removeRecentPost("community", postId);
			setPost(null);
			setLoading(false);
			return;
		}

		const nextPost = data as CommunityPost;
		if (nextPost.status === "deleted" || nextPost.status === "removed") {
			removeRecentPost("community", postId);
			setPost(null);
			setLoading(false);
			return;
		}

		setPost(nextPost);
		setPostEditTitle(nextPost.title);
		setPostEditBody(nextPost.body);

		const [
			topicResult,
			attachmentResult,
			commentResult,
			postVoteResult,
		] =
			await Promise.all([
				supabase
					.from("community_topics")
					.select("id,slug,name")
					.eq("id", nextPost.topic_id)
					.maybeSingle(),
				supabase
					.from("community_post_attachments")
					.select(
						"id,post_id,user_id,kind,source,storage_path,title,alt_text,mime_type,file_size,display_order,created_at",
					)
					.eq("post_id", postId)
					.order("display_order", { ascending: true }),
				fetchCommunityComments(postId),
				userId
					? supabase
							.from("community_post_votes")
							.select("reaction")
							.eq("post_id", postId)
							.eq("voter_id", userId)
							.maybeSingle()
					: Promise.resolve({ data: null, error: null }),
			]);

		if (commentResult.error) {
			setErrorMessage("Comments could not be loaded.");
		}

		const nextComments = (commentResult.data ?? []) as CommunityPostComment[];
		const commentIds = nextComments.map((comment) => comment.id);
		const commentVoteResult =
			userId && commentIds.length
				? await supabase
						.from("community_comment_votes")
						.select("comment_id,reaction")
						.eq("voter_id", userId)
						.in("comment_id", commentIds)
				: { data: [], error: null };

		const authorIds = Array.from(
			new Set([
				nextPost.author_id,
				...nextComments.map((comment) => comment.author_id),
			]),
		);
		const [profileResult, onlineProfileIds] = authorIds.length
			? await Promise.all([
					supabase
						.from("profiles")
						.select("id,username,full_name,avatar_url,avatar_path")
						.in("id", authorIds),
					loadOnlineProfileIds(authorIds),
				])
			: [{ data: [], error: null }, new Set<string>()] as const;

		const nextProfiles = ((profileResult.data ?? []) as ProfilePreview[]).reduce<
			Record<string, ProfilePreview>
		>((profileMap, profile) => {
			profileMap[profile.id] = {
				...profile,
				is_online: onlineProfileIds.has(profile.id),
			};
			return profileMap;
		}, {});

		const nextCommentReactions = (
			(commentVoteResult.data ?? []) as Array<{
				comment_id: string;
				reaction: CommunityVoteReaction;
			}>
		).reduce<Record<string, CommunityVoteReaction>>((reactionMap, vote) => {
			reactionMap[vote.comment_id] = vote.reaction;
			return reactionMap;
		}, {});

		const nextTopic = (topicResult.data as CommunityTopic | null) ?? null;
		const nextAttachments = (
			(attachmentResult.data ?? []) as CommunityPostAttachment[]
		).map((attachment) => ({
			...attachment,
			publicUrl: supabase.storage
				.from("community-post-media")
				.getPublicUrl(attachment.storage_path).data.publicUrl,
		}));
		const commentAttachmentIds = Array.from(
			new Set(
				nextComments
					.filter(
						(comment) =>
							comment.status !== "deleted" &&
							comment.status !== "removed" &&
							Boolean(comment.attachment_id),
					)
					.map((comment) => comment.attachment_id as string),
			),
		);
		const commentAttachmentResult = commentAttachmentIds.length
			? await supabase
					.from("comment_attachments")
					.select(
						"id,kind,source,storage_path,title,alt_text,mime_type,file_size,created_at",
					)
					.in("id", commentAttachmentIds)
			: { data: [], error: null };
		const nextCommentAttachmentsById = (
			(commentAttachmentResult.data ?? []) as CommentAttachment[]
		).reduce<Record<string, CommentAttachmentOption>>((attachmentMap, attachment) => {
			if (!attachment.storage_path) return attachmentMap;

			attachmentMap[attachment.id] = {
				...attachment,
				publicUrl: supabase.storage
					.from("comment-media")
					.getPublicUrl(attachment.storage_path).data.publicUrl,
			};
			return attachmentMap;
		}, {});

		setTopic(nextTopic);
		setAttachments(nextAttachments);
		setCommentAttachmentsById(nextCommentAttachmentsById);

		const pollResult = await supabase
			.from("community_post_polls")
			.select("id,post_id,question,duration_days,closes_at,created_at,updated_at")
			.eq("post_id", postId)
			.maybeSingle();

		if (pollResult.error) {
			if (!isMissingPollSchema(pollResult.error.message)) {
				setErrorMessage("Poll could not be loaded.");
			}
			setPoll(null);
		} else if (pollResult.data) {
			const nextPoll = pollResult.data as CommunityPostPoll;
			const [pollOptionResult, pollVoteResult] = await Promise.all([
				supabase
					.from("community_post_poll_options")
					.select("id,poll_id,option_text,display_order,vote_count,created_at,updated_at")
					.eq("poll_id", nextPoll.id)
					.order("display_order", { ascending: true }),
				userId
					? supabase
							.from("community_post_poll_votes")
							.select("option_id")
							.eq("poll_id", nextPoll.id)
							.eq("voter_id", userId)
							.maybeSingle()
					: Promise.resolve({ data: null, error: null }),
			]);

			if (pollOptionResult.error) {
				if (!isMissingPollSchema(pollOptionResult.error.message)) {
					setErrorMessage("Poll options could not be loaded.");
				}
				setPoll(null);
			} else {
				setPoll({
					...nextPoll,
					options: (pollOptionResult.data ?? []) as CommunityPostPollOption[],
					selectedOptionId:
						(pollVoteResult.data as { option_id?: string } | null)?.option_id ??
						"",
				});
			}
		} else {
			setPoll(null);
		}

		setComments(nextComments);
		setCommentReactions(nextCommentReactions);
		setPostReaction(
			((postVoteResult.data as { reaction?: CommunityVoteReaction } | null)
				?.reaction as CommunityVoteReaction | undefined) ?? null,
		);
		setProfiles(nextProfiles);
		writeRecentPost({
			author: getAuthorName(nextProfiles[nextPost.author_id] ?? null),
			comments: nextPost.comment_count,
			createdAt: nextPost.created_at,
			href: `/community/${nextPost.id}`,
			id: nextPost.id,
			imageUrl: getRecentCommunityPostImage(nextAttachments),
			kind: "community",
			meta: nextTopic?.name ?? COMMUNITY_POST_TYPE_LABELS[nextPost.post_type],
			title: nextPost.title,
			visitedAt: new Date().toISOString(),
			votes: getScore(nextPost),
		});
		setLoading(false);
	}, [postId]);

	useEffect(() => {
		let active = true;

		async function run() {
			await loadPost();
			if (!active) return;
		}

		void run();

		return () => {
			active = false;
		};
	}, [loadPost]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		if (window.location.hash === "#comments") {
			setMobileCommentsSheetState("open");
		}
	}, []);

	useEffect(() => {
		if (typeof window === "undefined") return;
		if (new URLSearchParams(window.location.search).get("edit") !== "1") return;
		if (!post || !currentUserId) return;
		if (currentUserId !== post.author_id) return;
		if (post.status !== "active" && post.status !== "locked") return;

		setPostEditTitle(post.title);
		setPostEditBody(post.body);
		setEditingPost(true);
	}, [currentUserId, post]);

	const commentTree = useMemo(
		() => buildCommunityCommentTree(comments),
		[comments],
	);
	const mentionedHandles = useMemo(
		() =>
			extractMentionHandlesFromTexts([
				post?.body ?? "",
				...comments
					.filter((comment) => comment.status === "active")
					.map((comment) => comment.body),
			]),
		[comments, post?.body],
	);
	const mentionedHandlesKey = mentionedHandles.join("\u001f");
	const localCommunityMentionSuggestions = useMemo(() => {
		if (!post) return [];

		return buildMentionSuggestions(
			[post.author_id, ...comments.map((comment) => comment.author_id)],
			profiles,
			{
				excludeUserId: currentUserId,
				subtitleById: {
					[post.author_id]: "Post author",
				},
			},
		);
	}, [comments, currentUserId, post, profiles]);
	const communityMentionSuggestions = useMemo(
		() =>
			mergeMentionSuggestions(
				localCommunityMentionSuggestions,
				resolvedMentionSuggestions,
				120,
			),
		[localCommunityMentionSuggestions, resolvedMentionSuggestions],
	);
	const communityMentionTargets = useMemo(() => {
		return buildMentionTargetMap(communityMentionSuggestions);
	}, [communityMentionSuggestions]);

	useEffect(() => {
		if (!mentionedHandles.length) {
			setResolvedMentionSuggestions([]);
			return;
		}

		const controller = new AbortController();
		let cancelled = false;

		async function loadMentionTargets() {
			const { session } = await getFreshAuthSession();
			const suggestions = await lookupMentionSuggestionsByHandles(
				mentionedHandles,
				{
					accessToken: session?.access_token,
					limit: 120,
					signal: controller.signal,
				},
			);

			if (!cancelled) {
				setResolvedMentionSuggestions(suggestions);
			}
		}

		void loadMentionTargets().catch((error) => {
			if (cancelled || controller.signal.aborted) return;
			if (error instanceof DOMException && error.name === "AbortError") return;

			setResolvedMentionSuggestions([]);
		});

		return () => {
			cancelled = true;
			controller.abort();
		};
	}, [mentionedHandles, mentionedHandlesKey]);

	// Track iOS virtual keyboard height so the comment sheet stays above the keyboard.
	// visualViewport is the only reliable API for this on iOS Safari 17+.
	useEffect(() => {
		const vv = window.visualViewport;
		if (!vv) return;

		function update() {
			if (!vv) return;
			const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
			setKeyboardInset(inset);
			document.documentElement.style.setProperty("--keyboard-inset", `${inset}px`);
		}

		vv.addEventListener("resize", update);
		vv.addEventListener("scroll", update);
		return () => {
			vv.removeEventListener("resize", update);
			vv.removeEventListener("scroll", update);
		};
	}, []);

	// For text-only posts (no attachments, no poll), auto-open the comment sheet
	// so the user sees comments immediately instead of a half-empty post view.
	useEffect(() => {
		if (hasAutoOpenedSheetRef.current || loading || !post) return;
		hasAutoOpenedSheetRef.current = true;
		if (!poll && !attachments.length && isMobileViewport()) {
			setMobileCommentsSheetState("open");
		}
	}, [attachments.length, loading, poll, post]);

	function renderCommunityTextWithMentions(text: string, keyPrefix: string) {
		const nodes: ReactNode[] = [];
		let lastIndex = 0;
		let match: RegExpExecArray | null;
		MENTION_TEXT_PATTERN.lastIndex = 0;

		while ((match = MENTION_TEXT_PATTERN.exec(text))) {
			if (match.index > lastIndex) {
				nodes.push(text.slice(lastIndex, match.index));
			}

			const rawHandle = match[1] ?? "";
			const target = communityMentionTargets[getMentionHandleKey(rawHandle)];
			const mentionText = match[0];

			if (target) {
				nodes.push(
					<Link
						className="comment-inline-mention"
						href={`/profile/${target.id}`}
						key={`${keyPrefix}-${match.index}`}
					>
						@{target.handle}
					</Link>,
				);
			} else {
				nodes.push(mentionText);
			}

			lastIndex = MENTION_TEXT_PATTERN.lastIndex;
		}

		if (lastIndex < text.length) {
			nodes.push(text.slice(lastIndex));
		}

		return nodes;
	}

	async function runCommunityAction<T extends { message?: string }>(
		path: string,
		options: {
			body?: Record<string, unknown>;
			busyKey: string;
			fallbackMessage: string;
			method?: "DELETE" | "PATCH" | "POST";
		},
	) {
		if (actionBusy) return null;

		const accessToken = await getAccessToken();
		if (!accessToken) {
			toast.error("Your session expired. Sign in again to continue.");
			return null;
		}

		setActionBusy(options.busyKey);
		try {
			const response = await fetch(path, {
				body: options.body ? JSON.stringify(options.body) : undefined,
				headers: {
					Authorization: `Bearer ${accessToken}`,
					...(options.body ? { "Content-Type": "application/json" } : {}),
				},
				method: options.method ?? "POST",
			});
			const result = (await response.json().catch(() => null)) as T | null;

			if (!response.ok || !result) {
				toast.error(result?.message ?? options.fallbackMessage);
				return null;
			}

			return result;
		} catch {
			toast.error(options.fallbackMessage);
			return null;
		} finally {
			setActionBusy("");
		}
	}

	async function submitComment(
		parentId: string | null,
		body: string,
		attachment: CommentAttachmentOption | null,
	) {
		if (!post) return;

		const cleanedBody = body.trim();
		if (cleanedBody.length < 2) {
			toast.error("Write at least 2 characters.");
			return;
		}

		if (post.status !== "active") {
			toast.error("This post is closed for new comments.");
			return;
		}

		if (parentId) {
			const parentComment = findCommunityCommentNode(commentTree, parentId);
			if (parentComment) {
				const replyBlockReason = getCommunityCommentReplyBlockReason({
					activeUser: currentUserId ? { id: currentUserId } : null,
					comment: parentComment,
					postStatus: post.status,
				});
				if (replyBlockReason) {
					toast.error(replyBlockReason);
					return;
				}
			}
		}

		const result = await runCommunityAction<SubmitCommentResponse>(
			"/api/community/comments/submit",
			{
				body: {
					attachmentId: attachment?.id ?? null,
					body: cleanedBody,
					parentId,
					postId: post.id,
				},
				busyKey: parentId ? `reply-${parentId}` : "comment-root",
				fallbackMessage: "We could not add this comment.",
			},
		);

		if (!result?.id) return;

		if (parentId) {
			setReplyBodies((current) => ({ ...current, [parentId]: "" }));
			updateReplyAttachment(parentId, null);
			setReplyingToId("");
		} else {
			setCommentAttachment(null);
			setCommentBody("");
			setCommentContentFormat("plain");
			setRootCommentComposerOpen(false);
			setMobileCommentsSheetState("open");
			setMobileCommentsSheetDrag(0);
		}

		toast.success(
			result.status === "held"
				? `${parentId ? "Reply" : "Comment"} sent for moderation.`
				: `${parentId ? "Reply" : "Comment"} added.`,
		);
		await loadPost();
		window.location.hash = "comments";
	}

	async function handleRootCommentSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		await submitComment(null, commentBody, commentAttachment);
	}

	function handleRootCommentCancel() {
		setCommentAttachment(null);
		setCommentBody("");
		setCommentContentFormat("plain");
		setRootCommentComposerOpen(false);
	}

	async function handleMobileComposerSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setMobileComposerOpen(false);
		await submitComment(null, commentBody, commentAttachment);
	}

	function closeMobileComposer() {
		setMobileComposerOpen(false);
	}

	async function handleReplySubmit(
		event: FormEvent<HTMLFormElement>,
		parentId: string,
	) {
		event.preventDefault();
		await submitComment(
			parentId,
			replyBodies[parentId] ?? "",
			replyAttachments[parentId] ?? null,
		);
	}

	async function handlePostVote(reaction: CommunityVoteReaction) {
		if (!post) return;
		if (actionBusy) return;

		const blockReason = getCommunityPostReactionBlockReason(
			currentUserId ? { id: currentUserId } : null,
			post,
		);
		if (blockReason) {
			toast.error(blockReason);
			return;
		}

		const previousPost = post;
		const previousReaction = postReaction;
		const nextReaction = postReaction === reaction ? null : reaction;
		const optimisticCounts = getOptimisticCommunityVoteCounts(
			post,
			postReaction,
			nextReaction,
		);
		setPost((current) =>
			current
				? {
						...current,
						downvote_count: optimisticCounts.downvote_count,
						upvote_count: optimisticCounts.upvote_count,
					}
				: current,
		);
		setPostReaction(nextReaction);

		const result = await runCommunityAction<VoteActionResponse>(
			`/api/community/posts/${post.id}/vote`,
			{
				body: { reaction: nextReaction },
				busyKey: `post-vote-${reaction}`,
				fallbackMessage: "Could not update your vote.",
			},
		);

		if (result?.upvoteCount === undefined || result.downvoteCount === undefined) {
			setPost(previousPost);
			setPostReaction(previousReaction);
			return;
		}

		setPost((current) =>
			current
				? {
						...current,
						downvote_count: result.downvoteCount ?? current.downvote_count,
						upvote_count: result.upvoteCount ?? current.upvote_count,
					}
				: current,
		);
		setPostReaction(result.reaction ?? null);
	}

	async function shareCurrentPost() {
		if (!post) return;

		const shareUrl = new URL(`/community/${post.id}`, window.location.origin).toString();

		try {
			if (navigator.share) {
				await navigator.share({ title: post.title, url: shareUrl });
				return;
			}

			await navigator.clipboard.writeText(shareUrl);
			toast.success("Post link copied.");
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") {
				return;
			}
			toast.error("Could not share this post.");
		}
	}

	function openCommentsShelf(
		event?: ReactMouseEvent<HTMLAnchorElement | HTMLButtonElement>,
	) {
		if (!isMobileViewport()) return;
		event?.preventDefault();
		setMobilePostBodyExpanded(false);
		setMobileCommentsSheetDrag(0);
		setMobileCommentsSheetState("open");
	}

	function startMobilePostRevealGesture(
		event: ReactPointerEvent<HTMLElement>,
	) {
		if (!isMobileViewport() || poll) {
			return;
		}

		if (
			mobilePostBodyExpanded &&
			event.target instanceof HTMLElement &&
			event.target.closest(".community-post-body")
		) {
			return;
		}

		if (isMobileGestureBlocked(event.target)) return;

		event.currentTarget.setPointerCapture(event.pointerId);
		const startX = event.clientX;
		const startY = event.clientY;
		let shouldReveal = false;

		if (mobileCommentsSheetState === "open") {
			let prevY = startY;
			let articleVelocity = 0;

			function cleanupCloseGesture() {
				window.removeEventListener("pointermove", handleClosePointerMove);
				window.removeEventListener("pointerup", cleanupCloseGesture);
				window.removeEventListener("pointercancel", cleanupCloseGesture);
			}

			function handleClosePointerMove(moveEvent: PointerEvent) {
				articleVelocity = moveEvent.clientY - prevY;
				prevY = moveEvent.clientY;
				const deltaY = moveEvent.clientY - startY;
				// Dismiss on either sufficient distance OR a fast downward fling
				if (deltaY <= 42 && articleVelocity <= 8) return;
				moveEvent.preventDefault();
				setMobileCommentsSheetDrag(0);
				setMobileCommentsSheetState("peek");
				cleanupCloseGesture();
			}

			window.addEventListener("pointermove", handleClosePointerMove);
			window.addEventListener("pointerup", cleanupCloseGesture);
			window.addEventListener("pointercancel", cleanupCloseGesture);
			return;
		}

		function cleanup() {
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", cleanup);
			window.removeEventListener("pointercancel", cleanup);
		}

		function handlePointerMove(moveEvent: PointerEvent) {
			const deltaX = moveEvent.clientX - startX;
			const deltaY = moveEvent.clientY - startY;
			const absoluteX = Math.abs(deltaX);
			const absoluteY = Math.abs(deltaY);

			if (shouldReveal || absoluteY < 18 || absoluteY < absoluteX * 1.15) {
				return;
			}

			if (deltaY < 0) {
				shouldReveal = true;
				moveEvent.preventDefault();
				setMobilePostBodyExpanded(false);
				setMobileCommentsSheetDrag(0);
				setMobileCommentsSheetState("open");
				cleanup();
			}
		}

		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", cleanup);
		window.addEventListener("pointercancel", cleanup);
	}

	function handleMobilePostWheel(event: ReactWheelEvent<HTMLElement>) {
		if (
			!isMobileViewport() ||
			poll ||
			mobilePostBodyExpanded ||
			mobileCommentsSheetState === "open" ||
			event.deltaY < 18
		) {
			return;
		}

		event.preventDefault();
		setMobilePostBodyExpanded(false);
		setMobileCommentsSheetDrag(0);
		setMobileCommentsSheetState("open");
	}

	function handleMobilePostSurfaceClick() {
		if (!isMobileViewport() || mobileCommentsSheetState !== "open") return;
		setMobileCommentsSheetDrag(0);
		setMobileCommentsSheetState("peek");
	}

	function startMobileCommentsSheetDrag(event: ReactPointerEvent<HTMLElement>) {
		if (!isMobileViewport()) return;
		if (isMobileGestureBlocked(event.target)) return;

		// If the touch starts inside the scrollable comment list, only allow the
		// dismiss gesture when the list is already scrolled to the top. Otherwise
		// the native scroll should take precedence.
		const sheetEl = event.currentTarget;
		const roastList = sheetEl.querySelector<HTMLElement>(".roast-list");
		const isInList =
			event.target instanceof HTMLElement &&
			Boolean(event.target.closest(".roast-list"));
		if (isInList && roastList && roastList.scrollTop > 2) return;

		event.currentTarget.setPointerCapture(event.pointerId);
		const startY = event.clientY;
		const startState = mobileCommentsSheetState;
		const maxDrag = Math.round(window.innerHeight * 0.72);
		let didDrag = false;
		let lastY = startY;
		let velocity = 0;

		function handlePointerMove(moveEvent: PointerEvent) {
			velocity = moveEvent.clientY - lastY;
			lastY = moveEvent.clientY;
			const delta = moveEvent.clientY - startY;
			if (Math.abs(delta) > 8) {
				didDrag = true;
				moveEvent.preventDefault();
			}
			if (startState === "open") {
				setMobileCommentsSheetDrag(Math.min(maxDrag, Math.max(0, delta)));
			} else {
				setMobileCommentsSheetDrag(Math.max(-maxDrag, Math.min(0, delta)));
			}
		}

		function finishDrag(upEvent: PointerEvent) {
			const delta = upEvent.clientY - startY;
			setMobileCommentsSheetDrag(0);
			if (didDrag) {
				// A fast fling (velocity > 6px/frame) dismisses with a smaller distance threshold
				const isFlingDown = velocity > 6;
				const isFlingUp = velocity < -6;
				if (startState === "peek" && (delta < -42 || isFlingUp)) {
					setMobileCommentsSheetState("open");
				} else if (startState === "open" && (delta > 56 || isFlingDown)) {
					setMobileCommentsSheetState("peek");
				}
			}
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", finishDrag);
			window.removeEventListener("pointercancel", finishDrag);
		}

		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", finishDrag);
		window.addEventListener("pointercancel", finishDrag);
	}

	function startMobileActionSheetDrag(event: ReactPointerEvent<HTMLElement>) {
		if (!isMobileViewport()) return;

		event.currentTarget.setPointerCapture(event.pointerId);
		const startY = event.clientY;
		let didDrag = false;

		function cleanup() {
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", finishDrag);
			window.removeEventListener("pointercancel", finishDrag);
		}

		function handlePointerMove(moveEvent: PointerEvent) {
			const delta = moveEvent.clientY - startY;
			if (delta <= 10) return;
			didDrag = true;
			moveEvent.preventDefault();
		}

		function finishDrag(upEvent: PointerEvent) {
			const delta = upEvent.clientY - startY;
			if (didDrag && delta > 52) {
				setMobileActionSheetOpen(false);
			}
			cleanup();
		}

		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", finishDrag);
		window.addEventListener("pointercancel", finishDrag);
	}

	async function downloadCurrentAttachment() {
		const attachment = visibleAttachments[0];
		if (!attachment) {
			toast.error("No image to download.");
			return;
		}

		try {
			const response = await fetch(attachment.publicUrl);
			if (!response.ok) throw new Error("Download failed");
			const blob = await response.blob();
			const objectUrl = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = objectUrl;
			link.download =
				attachment.title.trim() ||
				`linted-community-${post?.id.slice(0, 8) ?? "post"}`;
			document.body.appendChild(link);
			link.click();
			link.remove();
			URL.revokeObjectURL(objectUrl);
		} catch {
			window.open(attachment.publicUrl, "_blank", "noopener,noreferrer");
		}
	}

	function goBackToPreviousSpot() {
		if (typeof window !== "undefined" && window.history.length > 1) {
			router.back();
			return;
		}

		router.push("/community");
	}

	function requireCommentLogin() {
		toast.error("Sign in to comment.");
	}

	function updateReplyAttachment(
		commentId: string,
		attachment: CommentAttachmentOption | null,
	) {
		setReplyAttachments((current) => {
			const next = { ...current };
			if (attachment) {
				next[commentId] = attachment;
			} else {
				delete next[commentId];
			}
			return next;
		});
	}

	function toggleCommentReplies(commentId: string) {
		setCollapsedCommentIds((current) => {
			const next = new Set(current);
			if (next.has(commentId)) {
				next.delete(commentId);
			} else {
				next.add(commentId);
			}
			return next;
		});
	}

	async function shareCommentLink(commentId: string) {
		const anchor = `comment-${commentId}`;
		const shareUrl =
			typeof window === "undefined"
				? `#${anchor}`
				: `${window.location.origin}${window.location.pathname}#${anchor}`;

		try {
			if (navigator.share) {
				await navigator.share({
					title: "Linted community comment",
					url: shareUrl,
				});
				return;
			}

			await navigator.clipboard.writeText(shareUrl);
			toast.success("Comment link copied.");
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") {
				return;
			}
			toast.error("Could not share this comment.");
		}
	}

	async function handlePollVote(optionId: string) {
		if (!poll || !post) return;
		if (actionBusy) return;

		const blockReason = getCommunityPollVoteBlockReason({
			activeUser: currentUserId ? { id: currentUserId } : null,
			isClosed: new Date(poll.closes_at).getTime() <= Date.now(),
			isVoting: actionBusy.startsWith("poll-vote-"),
			postStatus: post.status,
		});
		if (blockReason) {
			toast.error(blockReason);
			return;
		}

		const previousOptionId = poll.selectedOptionId;
		if (previousOptionId === optionId) return;

		const previousPoll = poll;
		setPoll((current) =>
			current ? applyCommunityPollSelection(current, optionId) : current,
		);
		const result = await runCommunityAction<PollVoteActionResponse>(
			`/api/community/polls/${poll.id}/vote`,
			{
				body: { optionId },
				busyKey: `poll-vote-${optionId}`,
				fallbackMessage: "Could not update your poll vote.",
			},
		);

		const nextOptionId = result?.optionId;
		if (!nextOptionId) {
			setPoll(previousPoll);
			return;
		}

		if (nextOptionId !== optionId) {
			setPoll(applyCommunityPollSelection(previousPoll, nextOptionId));
		}
	}

	async function handleCommentVote(
		comment: CommunityPostComment,
		reaction: CommunityVoteReaction,
	) {
		if (actionBusy) return;

		const blockReason = getCommunityCommentReactionBlockReason(
			currentUserId ? { id: currentUserId } : null,
			comment,
		);
		if (blockReason) {
			toast.error(blockReason);
			return;
		}

		const currentReaction = commentReactions[comment.id] ?? null;
		const nextReaction = currentReaction === reaction ? null : reaction;
		const optimisticCounts = getOptimisticCommunityVoteCounts(
			comment,
			currentReaction,
			nextReaction,
		);
		setComments((current) =>
			current.map((row) =>
				row.id === comment.id
					? {
							...row,
							downvote_count: optimisticCounts.downvote_count,
							upvote_count: optimisticCounts.upvote_count,
						}
					: row,
			),
		);
		setCommentReactions((current) => ({
			...current,
			[comment.id]: nextReaction,
		}));

		const result = await runCommunityAction<VoteActionResponse>(
			`/api/community/comments/${comment.id}/vote`,
			{
				body: { reaction: nextReaction },
				busyKey: `comment-vote-${comment.id}-${reaction}`,
				fallbackMessage: "Could not update your vote.",
			},
		);

		if (result?.upvoteCount === undefined || result.downvoteCount === undefined) {
			setComments((current) =>
				current.map((row) => (row.id === comment.id ? comment : row)),
			);
			setCommentReactions((current) => ({
				...current,
				[comment.id]: currentReaction,
			}));
			return;
		}

		setComments((current) =>
			current.map((row) =>
				row.id === comment.id
					? {
							...row,
							downvote_count: result.downvoteCount ?? row.downvote_count,
							upvote_count: result.upvoteCount ?? row.upvote_count,
						}
					: row,
			),
		);
		setCommentReactions((current) => ({
			...current,
			[comment.id]: result.reaction ?? null,
		}));
	}

	async function handlePostEditSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!post) return;

		const result = await runCommunityAction<PostEditResponse>(
			`/api/community/posts/${post.id}`,
			{
				body: {
					body: postEditBody,
					title: postEditTitle,
				},
				busyKey: "post-edit",
				fallbackMessage: "Post was not updated.",
				method: "PATCH",
			},
		);

		if (!result?.post) return;

		setPost((current) =>
			current
				? {
						...current,
						body: result.post?.body ?? current.body,
						status: result.post?.status ?? current.status,
						title: result.post?.title ?? current.title,
						updated_at: result.post?.updatedAt ?? current.updated_at,
					}
				: current,
		);
		setEditingPost(false);
		toast.success("Post updated.");
	}

	async function handlePostDelete() {
		if (!post) return;

		const postId = post.id;
		setPostDeleteConfirmOpen(false);
		setActionBusy("post-delete");

		try {
			const token = await getAccessToken();
			const response = await fetch(`/api/community/posts/${postId}`, {
				headers: token ? { Authorization: `Bearer ${token}` } : undefined,
				method: "DELETE",
			});
			const result = (await response
				.json()
				.catch(() => null)) as PostDeleteResponse | null;

			if (!response.ok || !result?.post) {
				toast.error(result?.message ?? "Post was not deleted.");
				setActionBusy("");
				return;
			}

			removeRecentPost("community", postId);
			setPost(null);
			toast.success("Post deleted.");
			announceRouteTransition("/community");
			router.replace("/community");
			router.refresh();
		} catch (error) {
			console.error(error);
			toast.error("Post was not deleted.");
			setActionBusy("");
		}
	}

	async function handleCommentEditSubmit(
		event: FormEvent<HTMLFormElement>,
		comment: CommunityPostComment,
	) {
		event.preventDefault();

		const result = await runCommunityAction<CommentEditResponse>(
			`/api/community/comments/${comment.id}`,
			{
				body: { body: commentEditBody },
				busyKey: `comment-edit-${comment.id}`,
				fallbackMessage: "Comment was not updated.",
				method: "PATCH",
			},
		);

		if (!result?.comment) return;

		setComments((current) =>
			current.map((row) =>
				row.id === comment.id
					? {
							...row,
							body: result.comment?.body ?? row.body,
							status: result.comment?.status ?? row.status,
							updated_at: result.comment?.updatedAt ?? row.updated_at,
						}
					: row,
			),
		);
		setEditingCommentId("");
		setCommentEditBody("");
		toast.success("Comment updated.");
	}

	async function handleCommentDelete(comment: CommunityPostComment) {
		setPendingDeleteComment(null);
		const result = await runCommunityAction<CommentDeleteResponse>(
			`/api/community/comments/${comment.id}`,
			{
				busyKey: `comment-delete-${comment.id}`,
				fallbackMessage: "Comment was not deleted.",
				method: "DELETE",
			},
		);

		if (!result?.comment) return;

		setComments((current) =>
			current.map((row) =>
				row.id === comment.id
					? {
							...row,
							attachment_id: null,
							body: "[deleted]",
							deleted_at: result.comment?.deletedAt ?? row.deleted_at,
							status: result.comment?.status ?? "deleted",
						}
					: row,
			),
		);
		setPost((current) =>
			current
				? {
						...current,
						comment_count: Math.max(current.comment_count - 1, 0),
					}
				: current,
		);
		toast.success("Comment deleted.");
	}

	async function handleLockToggle() {
		if (!post || !isAdmin) return;

		const nextLocked = post.status !== "locked";
		const result = await runCommunityAction<PostLockResponse>(
			`/api/community/posts/${post.id}/lock`,
			{
				body: { locked: nextLocked },
				busyKey: "post-lock",
				fallbackMessage: "Post lock was not updated.",
			},
		);

		if (!result?.post) return;

		setPost((current) =>
			current
				? {
						...current,
						status: result.post?.status ?? current.status,
						updated_at: result.post?.updatedAt ?? current.updated_at,
					}
				: current,
		);
		setReplyingToId("");
		toast.success(nextLocked ? "Post locked." : "Post unlocked.");
	}

	function openReportDialog(target: CommunityReportTarget) {
		if (!currentUserId) {
			toast.error("Sign in before reporting content.");
			return;
		}

		setReportTarget(target);
		setReportReason("personal_info");
		setReportDetails("");
	}

	async function handleReportSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!reportTarget || !post) return;

		const issue = getReportIssue({
			details: reportDetails,
			reason: reportReason,
		});
		if (issue) {
			toast.error(issue);
			return;
		}

		const { session } = await getFreshAuthSession();
		if (!session) {
			toast.error("Your session expired. Sign in again to continue.");
			return;
		}

		setSubmittingReport(true);
		const { data, error } = await supabase.rpc("report_content", {
			report_details: reportDetails.trim(),
			report_reason: reportReason,
			report_target_type:
				reportTarget.type === "post" ? "community_post" : "community_comment",
			target_community_comment_id:
				reportTarget.type === "comment" ? reportTarget.id : null,
			target_community_post_id:
				reportTarget.type === "comment" ? reportTarget.postId : post.id,
		});
		setSubmittingReport(false);

		if (error) {
			const message = /own/i.test(error.message)
				? "You cannot report your own content."
				: "We could not send this report. Please try again.";
			toast.error(message);
			return;
		}

		const reportResult = Array.isArray(data) ? data[0] : null;
		setReportTarget(null);
		setReportDetails("");
		toast.success(
			reportResult?.was_duplicate
				? "Report updated in the moderation queue."
				: "Report sent for moderation review.",
		);
	}

	function renderCommentNode(node: CommunityCommentNode) {
		if (!post) return null;

		const profile = profiles[node.author_id] ?? null;
		const score = getScore(node);
		const isDeleted = node.status === "deleted";
		const isHeld = node.status === "held";
		const isRemoved = node.status === "removed";
		const isUnavailable = isDeleted || isRemoved;
		const isOwnComment = currentUserId === node.author_id;
		const activeUser = currentUserId ? { id: currentUserId } : null;
		const commentReactionBlockReason = getCommunityCommentReactionBlockReason(
			activeUser,
			node,
		);
		const replyBlockReason = getCommunityCommentReplyBlockReason({
			activeUser,
			comment: node,
			postStatus: post.status,
		});
		const canReply = !replyBlockReason;
		const reaction = commentReactions[node.id] ?? null;
		const isEditing = editingCommentId === node.id;
		const hasReplies = node.children.length > 0;
		const isCollapsed = collapsedCommentIds.has(node.id);
		const authorHandle = getCommunityAuthorHandle(node.author_id, profile);
		const replyNoun = node.children.length === 1 ? "reply" : "replies";
		const threadToggleLabel = isCollapsed
			? `Show ${node.children.length} ${replyNoun}`
			: `Hide ${node.children.length} ${replyNoun}`;

		return (
			<div
				className={`thread-roast-node${node.depth > 0 ? " is-nested" : ""}${
					hasReplies ? " has-replies" : ""
				}${isCollapsed ? " is-collapsed" : ""}`}
				data-author-id={node.author_id}
				data-thread-collapsed={hasReplies ? String(isCollapsed) : undefined}
				data-thread-depth={Math.min(node.depth, COMMUNITY_COMMENT_MAX_DEPTH)}
				data-thread-has-replies={hasReplies ? "true" : undefined}
				data-thread-parent-id={node.parent_id ?? undefined}
				data-thread-roast-id={node.id}
				id={`comment-${node.id}`}
				key={node.id}
				role="listitem"
			>
				<span aria-hidden="true" className="thread-rail-end-mask" />
				{node.depth > 0 ? (
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
						onClick={() => toggleCommentReplies(node.id)}
						title={threadToggleLabel}
						type="button"
					>
						<span className="thread-rail-stem" />
					</button>
				) : null}
				<article
					className={`thread-roast ${node.depth ? "is-reply" : ""}${
						isUnavailable || isHeld ? " is-deleted" : ""
					}`}
				>
					<div className="thread-roast-avatar-cell" aria-hidden="true">
						{isUnavailable ? (
							<span className="thread-roast-avatar is-deleted">D</span>
						) : (
							<PresenceAvatar isOnline={profile?.is_online} size="md">
								<img
									alt=""
									aria-hidden="true"
									className="thread-roast-avatar"
									height={32}
									src={getCommunityAuthorAvatar(node.author_id, profile)}
									width={32}
								/>
							</PresenceAvatar>
						)}
					</div>
					<div className="thread-roast-body">
						<header>
							<div className="comment-author-stack">
								<div className="comment-author-primary-row">
									{isUnavailable ? (
										<span className="deleted-author-chip">Moderated comment</span>
									) : (
										<Button asChild className="comment-author-chip" size="sm">
											<Link href={`/profile/${node.author_id}`}>
												{authorHandle}
											</Link>
										</Button>
									)}
									<time dateTime={node.created_at}>
										&middot; {formatDate(node.created_at)}
									</time>
									{isUnavailable ? null : <span>{formatCount(score)} score</span>}
								</div>
								{isHeld ? (
									<div className="comment-author-badge-row">
										<span className="badge neutral-badge reviewer-meta-chip">
											Held for review
										</span>
									</div>
								) : null}
							</div>
						</header>

						{isUnavailable ? (
							<p className="deleted-roast-copy">
								{isRemoved
									? "Comment removed by moderation."
									: "Comment deleted by author."}
							</p>
						) : isEditing ? (
							<form
								className="community-edit-form community-comment-edit-form"
								onSubmit={(event) => {
									void handleCommentEditSubmit(event, node);
								}}
							>
								<textarea
									aria-label="Edit comment"
									disabled={actionBusy === `comment-edit-${node.id}`}
									onChange={(event) => setCommentEditBody(event.target.value)}
									value={commentEditBody}
								/>
								<div className="community-inline-actions">
									<button
										className="community-action-button"
										onClick={() => {
											setEditingCommentId("");
											setCommentEditBody("");
										}}
										type="button"
									>
										<X aria-hidden="true" />
										Cancel
									</button>
									<button
										className="btn-primary"
										disabled={
											actionBusy === `comment-edit-${node.id}` ||
											commentEditBody.trim().length < 2
										}
										type="submit"
									>
										<Check aria-hidden="true" />
										Save
									</button>
								</div>
							</form>
						) : (
							<>
								<CommunityMarkdown
									className="community-comment-body"
									content={node.body}
									renderText={renderCommunityTextWithMentions}
								/>
								<CommunityCommentAttachment
									attachment={
										node.attachment_id
											? commentAttachmentsById[node.attachment_id]
											: null
									}
								/>
							</>
						)}

						{node.status !== "active" || isEditing ? null : (
							<footer>
								{commentReactionBlockReason ? null : (
									<div className="comment-reactions">
										<button
											aria-label="Upvote comment"
											aria-pressed={reaction === "upvote"}
											className={`comment-action-button reaction-button is-like${
												reaction === "upvote" ? " is-active" : ""
											}`}
											disabled={actionBusy === `comment-vote-${node.id}-upvote`}
											onClick={() => {
												void handleCommentVote(node, "upvote");
											}}
											title="Upvote"
											type="button"
										>
											<ReactionIcon
												active={reaction === "upvote"}
												direction="up"
											/>
											<span className="reaction-count">
												{formatCount(node.upvote_count)}
											</span>
										</button>
										<button
											aria-label="Downvote comment"
											aria-pressed={reaction === "downvote"}
											className={`comment-action-button reaction-button is-dislike${
												reaction === "downvote" ? " is-active" : ""
											}`}
											disabled={actionBusy === `comment-vote-${node.id}-downvote`}
											onClick={() => {
												void handleCommentVote(node, "downvote");
											}}
											title="Downvote"
											type="button"
										>
											<ReactionIcon
												active={reaction === "downvote"}
												direction="down"
											/>
											<span className="reaction-count">
												{formatCount(node.downvote_count)}
											</span>
										</button>
									</div>
								)}

								{canReply ? (
									<button
										aria-label={`Reply to ${authorHandle}`}
										className="comment-action-button"
										onClick={() => {
											setReplyingToId(node.id);
											setReplyBodies((current) => ({
												...current,
												[node.id]: current[node.id] ?? "",
											}));
										}}
										type="button"
									>
										<MessageCircle aria-hidden="true" />
										<span className="comment-action-label">Reply</span>
									</button>
								) : null}
								<button
									aria-label="Share this comment"
									className="comment-action-button"
									onClick={() => {
										void shareCommentLink(node.id);
									}}
									title="Share"
									type="button"
								>
									<Share2 aria-hidden="true" />
								</button>
								{hasReplies ? (
									<button
										aria-expanded={!isCollapsed}
										aria-label={threadToggleLabel}
										className="thread-rail-toggle"
										onClick={() => toggleCommentReplies(node.id)}
										title={threadToggleLabel}
										type="button"
									>
										<span aria-hidden="true">{isCollapsed ? "+" : "-"}</span>
										<span className="sr-only">{threadToggleLabel}</span>
									</button>
								) : null}
								{isOwnComment ? (
									<>
										<button
											className="comment-action-button"
											onClick={() => {
												setEditingCommentId(node.id);
												setCommentEditBody(node.body);
											}}
											type="button"
										>
											<Edit3 aria-hidden="true" />
											<span className="comment-action-label">Edit</span>
										</button>
										<button
											className="comment-action-button comment-delete-button"
											disabled={actionBusy === `comment-delete-${node.id}`}
											onClick={() => {
												setPendingDeleteComment(node);
											}}
											type="button"
										>
											<Trash2 aria-hidden="true" />
											<span className="comment-action-label">Delete</span>
										</button>
									</>
								) : (
									<button
										aria-label="More comment actions"
										className="comment-action-button comment-more-button"
										onClick={() => {
											openReportDialog({
												id: node.id,
												postId: node.post_id,
												type: "comment",
											});
										}}
										type="button"
									>
										<MoreHorizontal aria-hidden="true" />
									</button>
								)}
							</footer>
						)}

						{replyingToId === node.id ? (
							<form
								className="inline-reply-form"
								onSubmit={(event) => {
									void handleReplySubmit(event, node.id);
								}}
							>
								<CommentComposer
									attachment={replyAttachments[node.id] ?? null}
									autoFocus
									className="comment-composer-reply"
									contentFormat={replyContentFormat}
									disabledTools={actionBusy === `reply-${node.id}`}
									maxHeight={220}
									minHeight={56}
									mentionSuggestions={communityMentionSuggestions}
									onAttachmentChange={(attachment) =>
										updateReplyAttachment(node.id, attachment)
									}
									onCancel={() => {
										updateReplyAttachment(node.id, null);
										setReplyingToId("");
									}}
									onChange={(value) =>
										setReplyBodies((current) => ({
											...current,
											[node.id]: value,
										}))
									}
									onFormatChange={setReplyContentFormat}
									onRequireLogin={requireCommentLogin}
									placeholder={`Reply to ${authorHandle}`}
									showFormatTools={false}
									submitDisabled={
										actionBusy === `reply-${node.id}` ||
										(replyBodies[node.id] ?? "").trim().length < 2
									}
									submitLabel={
										actionBusy === `reply-${node.id}` ? "Posting..." : "Post reply"
									}
									value={replyBodies[node.id] ?? ""}
								/>
							</form>
						) : null}
					</div>
				</article>

				{node.children.length ? (
					<div
						aria-label={`Replies to ${authorHandle}`}
						className="thread-children"
						hidden={isCollapsed}
						role="list"
					>
						{node.children.map((child) => renderCommentNode(child))}
					</div>
				) : null}
			</div>
		);
	}

	if (loading) {
		return (
			<section
				aria-label="Loading community post"
				className="community-post-detail is-loading"
			>
				<LoadingScreen
					label="Loading community post"
					theme="dark"
					variant="plain"
				/>
			</section>
		);
	}

	if (!post) {
		return (
			<section className="community-post-detail is-empty">
				<h1>Post unavailable</h1>
				<p>This post may have been removed or is not visible to your account.</p>
				<Link className="btn-primary" href="/community">
					Back to community
				</Link>
			</section>
		);
	}

	const authorProfile = profiles[post.author_id] ?? null;
	const score = getScore(post);
	const isOwnPost = currentUserId === post.author_id;
	const activeUser = currentUserId ? { id: currentUserId } : null;
	const postReactionBlockReason = getCommunityPostReactionBlockReason(
		activeUser,
		post,
	);
	const canEditPost = canEditCommunityPost(activeUser, post);
	const canDeletePost = canDeleteCommunityPost({
		activeUser,
		isAdmin,
		post,
	});
	const canReportPost =
		Boolean(currentUserId) &&
		!isOwnPost &&
		post.status === "active";
	const visibleAttachments = filterCommunityInlineAttachments(
		post.body,
		attachments,
	);
	const pollTotalVotes =
		poll?.options.reduce((total, option) => total + option.vote_count, 0) ?? 0;
	const pollClosed = poll ? new Date(poll.closes_at).getTime() <= Date.now() : false;
	const reportIssue = getReportIssue({
		details: reportDetails,
		reason: reportReason,
	});
	const canExpandMobilePostBody =
		post.body.trim().length > 140 || post.body.includes("\n");
	const reportDialog = reportTarget ? (
		<div className={reportStyles.backdrop}>
			<form
				aria-labelledby="community-report-title"
				aria-modal="true"
				className={reportStyles.dialog}
				onSubmit={(event) => {
					void handleReportSubmit(event);
				}}
				role="dialog"
			>
				<header className={reportStyles.header}>
					<div>
						<h2 id="community-report-title">
							{reportTarget.type === "post" ? "Report post" : "Report comment"}
						</h2>
					</div>
					<button
						aria-label="Close report dialog"
						className={reportStyles.closeButton}
						onClick={() => setReportTarget(null)}
						type="button"
					>
						<X aria-hidden="true" />
					</button>
				</header>

				<div className={reportStyles.options}>
					{REPORT_REASON_OPTIONS.map((option) => (
						<label
							className={
								reportReason === option.value
									? `${reportStyles.option} ${reportStyles.optionSelected}`
									: reportStyles.option
							}
							key={option.value}
						>
							<input
								checked={reportReason === option.value}
								name="community-report-reason"
								onChange={() => setReportReason(option.value)}
								type="radio"
								value={option.value}
							/>
							<span>{option.label}</span>
							<small>{option.description}</small>
						</label>
					))}
				</div>

				<label className={reportStyles.detailsField}>
					<span>Details</span>
					<textarea
						maxLength={800}
						onChange={(event) => setReportDetails(event.target.value)}
						placeholder="Add moderator context."
						value={reportDetails}
					/>
				</label>

				<div className={reportStyles.actions}>
					<button
						className={reportStyles.cancelButton}
						onClick={() => setReportTarget(null)}
						type="button"
					>
						Cancel
					</button>
					<button
						className={`btn-primary ${reportStyles.submitButton}`}
						disabled={submittingReport || Boolean(reportIssue)}
						title={reportIssue || undefined}
						type="submit"
					>
						{submittingReport ? (
							<>
								<span className="button-spinner" />
								Sending...
							</>
						) : (
							<>
								<Flag aria-hidden="true" />
								Send report
							</>
						)}
					</button>
				</div>
			</form>
		</div>
	) : null;
	const mobileCommentsSheetStyle = {
		"--mobile-comments-sheet-drag": `${mobileCommentsSheetDrag}px`,
		"--keyboard-inset": `${keyboardInset}px`,
	} as CSSProperties;
	const mobileActionSheet = mobileActionSheetOpen ? (
		<div
			className="community-mobile-action-backdrop"
			onClick={() => setMobileActionSheetOpen(false)}
		>
			<div
				aria-label="Post actions"
				aria-modal="true"
				className="community-mobile-action-sheet"
				onClick={(event) => event.stopPropagation()}
				onPointerDown={startMobileActionSheetDrag}
				role="dialog"
			>
				<div aria-hidden="true" className="community-mobile-sheet-grabber" />
				<header>
					<div>
						<span>Post actions</span>
						<strong>{getAuthorName(authorProfile)}</strong>
					</div>
				</header>
				<div className="community-mobile-action-list">
					<button
						onClick={() => {
							setMobileActionSheetOpen(false);
							void shareCurrentPost();
						}}
						type="button"
					>
						<Share2 aria-hidden="true" />
						<span>Share</span>
					</button>
					{visibleAttachments.length ? (
						<button
							onClick={() => {
								setMobileActionSheetOpen(false);
								void downloadCurrentAttachment();
							}}
							type="button"
						>
							<Download aria-hidden="true" />
							<span>Download</span>
						</button>
					) : null}
					{canReportPost ? (
						<button
							className="is-danger"
							onClick={() => {
								setMobileActionSheetOpen(false);
								openReportDialog({ id: post.id, type: "post" });
							}}
							type="button"
						>
							<Flag aria-hidden="true" />
							<span>Report</span>
						</button>
					) : null}
					{canDeletePost ? (
						<button
							className="is-danger"
							disabled={actionBusy === "post-delete"}
							onClick={() => {
								setMobileActionSheetOpen(false);
								setPostDeleteConfirmOpen(true);
							}}
							type="button"
						>
							<Trash2 aria-hidden="true" />
							<span>{actionBusy === "post-delete" ? "Deleting..." : "Delete"}</span>
						</button>
					) : null}
				</div>
			</div>
		</div>
	) : null;

	return (
		<div
			className="community-post-thread"
			data-has-media={visibleAttachments.length ? "true" : "false"}
			data-mobile-body-expanded={mobilePostBodyExpanded ? "true" : "false"}
			data-mobile-comments-sheet={mobileCommentsSheetState}
		>
			<div className="community-detail-toolbar" aria-label="Post navigation">
				<button
					aria-label="Back to previous page"
					className="community-detail-back-button"
					onClick={goBackToPreviousSpot}
					type="button"
				>
					<ChevronLeft aria-hidden="true" className="community-back-icon-desktop" />
					<X aria-hidden="true" className="community-back-icon-mobile" />
					<span>Back</span>
				</button>
				<div className="community-mobile-viewer-title">
					<PresenceAvatar isOnline={authorProfile?.is_online} size="sm">
						<img
							alt=""
							aria-hidden="true"
							height={24}
							src={getCommunityAuthorAvatar(post.author_id, authorProfile)}
							width={24}
						/>
					</PresenceAvatar>
					<span>{getAuthorName(authorProfile)}</span>
				</div>
				<button
					aria-label="Open post actions"
					className="community-mobile-viewer-menu"
					onClick={() => {
						setMobileActionSheetOpen(true);
					}}
					type="button"
				>
					<MoreHorizontal aria-hidden="true" />
				</button>
			</div>
			<div className="community-thread-body">
			<article
				className="community-post-detail"
				onClick={handleMobilePostSurfaceClick}
				onPointerDown={startMobilePostRevealGesture}
				onWheel={handleMobilePostWheel}
			>
				<header className="community-post-detail-header">
					<div className="community-post-meta-row community-meta-tags">
						<Link
							className="community-author-badge"
							href={`/profile/${post.author_id}`}
						>
							<PresenceAvatar isOnline={authorProfile?.is_online} size="sm">
								<img
									alt=""
									aria-hidden="true"
									height={24}
									src={getCommunityAuthorAvatar(post.author_id, authorProfile)}
									width={24}
								/>
							</PresenceAvatar>
							<span>{getAuthorName(authorProfile)}</span>
						</Link>
						<span className="badge role-badge">{topic?.name ?? "Community"}</span>
						<span className="badge neutral-badge">
							{COMMUNITY_POST_TYPE_LABELS[post.post_type]}
						</span>
						<time className="community-feed-date" dateTime={post.created_at}>
							{formatFeedDate(post.created_at)}
						</time>
					</div>
					{editingPost ? (
						<form
							className="community-edit-form community-post-edit-form"
							onSubmit={(event) => {
								void handlePostEditSubmit(event);
							}}
						>
							<input
								aria-label="Edit post title"
								disabled={actionBusy === "post-edit"}
								onChange={(event) => setPostEditTitle(event.target.value)}
								value={postEditTitle}
							/>
							<textarea
								aria-label="Edit post body"
								disabled={actionBusy === "post-edit"}
								onChange={(event) => setPostEditBody(event.target.value)}
								value={postEditBody}
							/>
							<div className="community-inline-actions">
								<button
									className="community-action-button"
									onClick={() => {
										setEditingPost(false);
										setPostEditTitle(post.title);
										setPostEditBody(post.body);
									}}
									type="button"
								>
									<X aria-hidden="true" />
									Cancel
								</button>
								<button
									className="btn-primary"
									disabled={actionBusy === "post-edit"}
									type="submit"
								>
									<Check aria-hidden="true" />
									Update post
								</button>
							</div>
						</form>
					) : (
						<h1>{post.title}</h1>
					)}
				</header>

				{post.status === "held" ? (
					<p className="community-status-note">
						This post is waiting for moderation.
					</p>
				) : null}

				{editingPost ? null : (
					<div
						aria-expanded={
							canExpandMobilePostBody ? mobilePostBodyExpanded : undefined
						}
						className="community-post-body"
					>
						<CommunityMarkdown
							content={post.body}
							renderText={renderCommunityTextWithMentions}
						/>
						{canExpandMobilePostBody ? (
							<button
								aria-expanded={mobilePostBodyExpanded}
								className="community-post-body-more"
								data-mobile-body-toggle="true"
								onClick={() => {
									if (!isMobileViewport()) return;
									setMobilePostBodyExpanded((current) => !current);
								}}
								type="button"
							>
								{mobilePostBodyExpanded ? "less" : "more"}
							</button>
						) : null}
					</div>
				)}

				{poll ? (
					<section className="community-poll-card" aria-label="Poll">
						<div className="community-poll-card-header">
							<strong>Poll</strong>
							<span>
								{pollTotalVotes} {pollTotalVotes === 1 ? "vote" : "votes"}{" - "}
								{pollClosed ? "Closed" : `Closes ${formatDate(poll.closes_at)}`}
							</span>
						</div>
						<div className="community-poll-options">
							{poll.options.map((option) => {
								const percentage = pollTotalVotes
									? Math.round((option.vote_count / pollTotalVotes) * 100)
									: 0;
								const isSelected = poll.selectedOptionId === option.id;
								const pollVoteBlockReason =
									getCommunityPollVoteBlockReason({
										activeUser,
										isClosed: pollClosed,
										isVoting: false,
										postStatus: post.status,
									});
								const isPollVoteBusy = actionBusy.startsWith("poll-vote-");

								return (
									<button
										aria-pressed={isSelected}
										className={isSelected ? "is-selected" : ""}
										data-blocked={pollVoteBlockReason ? "true" : undefined}
										disabled={isPollVoteBusy}
										key={option.id}
										onClick={() => {
											void handlePollVote(option.id);
										}}
										title={pollVoteBlockReason ?? undefined}
										type="button"
									>
										<span style={{ width: `${percentage}%` }} />
										<strong>{option.option_text}</strong>
										<em>{percentage}%</em>
									</button>
								);
							})}
						</div>
					</section>
				) : null}

				{visibleAttachments.length ? (
					<CommunityMediaGallery attachments={visibleAttachments} variant="detail" />
				) : null}

				<footer
					className="community-post-actions post-actions"
					data-has-comments={poll ? "false" : "true"}
					data-has-reactions={postReactionBlockReason ? "false" : "true"}
				>
					{postReactionBlockReason ? null : (
						<div
							className="comment-reactions community-reactions"
							aria-label={`${score} post score`}
						>
							<button
								aria-label="Upvote post"
								aria-pressed={postReaction === "upvote"}
								className={`comment-action-button reaction-button is-like${
									postReaction === "upvote" ? " is-active" : ""
								}`}
								disabled={actionBusy === "post-vote-upvote"}
								onClick={() => {
									void handlePostVote("upvote");
								}}
								title="Upvote"
								type="button"
							>
								<ReactionIcon
									active={postReaction === "upvote"}
									direction="up"
								/>
							</button>
							<span className="community-vote-score">
								{formatCount(score)}
							</span>
							<button
								aria-label="Downvote post"
								aria-pressed={postReaction === "downvote"}
								className={`comment-action-button reaction-button is-dislike${
									postReaction === "downvote" ? " is-active" : ""
								}`}
								disabled={actionBusy === "post-vote-downvote"}
								onClick={() => {
									void handlePostVote("downvote");
								}}
								title="Downvote"
								type="button"
							>
								<ReactionIcon
									active={postReaction === "downvote"}
									direction="down"
								/>
							</button>
						</div>
					)}
					{poll ? null : (
						<a
							className="post-action-button post-comments-link"
							href="#comments"
							onClick={openCommentsShelf}
						>
							<MessageCircle className="post-action-icon" size={16} aria-hidden="true" />
							<span className="post-action-count">{formatCount(post.comment_count)}</span>
							<span className="sr-only">
								{post.comment_count === 1 ? "comment" : "comments"}
							</span>
						</a>
					)}
					<button
						aria-label="Share post"
						className="post-action-button copy-button community-share-action"
						onClick={() => {
							void shareCurrentPost();
						}}
						type="button"
					>
						<Forward className="post-action-icon" size={16} aria-hidden="true" />
						<span className="post-action-label">Share</span>
					</button>
					{post.status === "locked" ? (
						<span className="post-action-button community-static-action">
							<Lock aria-hidden="true" />
							<span className="post-action-label">Locked</span>
						</span>
					) : null}
					{post.status === "held" ? (
						<span className="post-action-button community-static-action community-status-pill">
							<Flag aria-hidden="true" />
							<span className="post-action-label">Held for review</span>
						</span>
					) : null}
					{canReportPost ? (
						<button
							className="post-action-button"
							onClick={() => {
								openReportDialog({ id: post.id, type: "post" });
							}}
							type="button"
						>
							<Flag className="post-action-icon" size={16} aria-hidden="true" />
							<span className="post-action-label">Report</span>
						</button>
					) : null}
					{canEditPost || canDeletePost || isAdmin ? (
						<div className="community-owner-actions">
							{canEditPost ? (
								<button
									className="community-action-button"
									onClick={() => setEditingPost(true)}
									type="button"
								>
									<Edit3 aria-hidden="true" />
									Edit
								</button>
							) : null}
							{canDeletePost ? (
								<button
									className="community-action-button is-danger"
									disabled={actionBusy === "post-delete"}
									onClick={() => {
										setPostDeleteConfirmOpen(true);
									}}
									type="button"
								>
									<Trash2 aria-hidden="true" />
									Delete
								</button>
							) : null}
							{isAdmin ? (
								<button
									className="community-action-button"
									disabled={actionBusy === "post-lock"}
									onClick={() => {
										void handleLockToggle();
									}}
									type="button"
								>
									{post.status === "locked" ? (
										<Unlock aria-hidden="true" />
									) : (
										<Lock aria-hidden="true" />
									)}
									{post.status === "locked" ? "Unlock" : "Lock"}
								</button>
							) : null}
						</div>
					) : null}
				</footer>
			</article>

			{poll ? null : (
			<section
				aria-label="Comments"
				className="community-comments-panel thread-discussion-panel mobile-thread-comments"
				data-mobile-sheet={mobileCommentsSheetState}
				id="comments"
				onPointerDown={startMobileCommentsSheetDrag}
				style={mobileCommentsSheetStyle}
			>
				<button
					aria-label={
						mobileCommentsSheetState === "open"
							? "Collapse comments"
							: "Open comments"
					}
					className="community-comments-sheet-handle"
					onClick={() =>
						setMobileCommentsSheetState((current) =>
							current === "open" ? "peek" : "open",
						)
					}
					type="button"
				>
					<span aria-hidden="true" />
				</button>

				{post.status === "active" ? (
					<>
						{rootCommentComposerOpen || commentBody.trim().length ? (
							<form
								className="roast-form thread-roast-form community-root-comment-form community-root-comment-form-desktop"
								onSubmit={handleRootCommentSubmit}
							>
								<CommentComposer
									attachment={commentAttachment}
									autoFocus
									cancelLabel="Cancel"
									className="community-root-comment-composer"
									contentFormat={commentContentFormat}
									disabledTools={actionBusy === "comment-root"}
									maxHeight={160}
									minHeight={44}
									mentionSuggestions={communityMentionSuggestions}
									onAttachmentChange={setCommentAttachment}
									onCancel={handleRootCommentCancel}
									onChange={setCommentBody}
									onFormatChange={setCommentContentFormat}
									onRequireLogin={requireCommentLogin}
									placeholder="Join the conversation"
									showFormatTools={false}
									submitDisabled={
										actionBusy === "comment-root" ||
										commentBody.trim().length < 2
									}
									submitLabel={
										actionBusy === "comment-root" ? "Posting..." : "Comment"
									}
									value={commentBody}
								/>
							</form>
						) : (
							<button
								className="community-comment-join-pill community-root-comment-form-desktop"
								onClick={() => setRootCommentComposerOpen(true)}
								type="button"
							>
								Join the conversation
							</button>
						)}
						<form
							className="community-root-comment-form community-root-comment-form-mobile"
							onSubmit={handleRootCommentSubmit}
						>
							<CommentComposer
								ariaLabel="Join the conversation"
								attachment={commentAttachment}
								className="community-root-comment-composer community-root-comment-composer-mobile"
								contentFormat={commentContentFormat}
								disabledTools={actionBusy === "comment-root"}
								maxHeight={96}
								minHeight={40}
								mentionSuggestions={communityMentionSuggestions}
								onAttachmentChange={setCommentAttachment}
								onChange={setCommentBody}
								onFormatChange={setCommentContentFormat}
								onRequireLogin={requireCommentLogin}
								placeholder="Join the conversation"
								showFormatTools={false}
								submitDisabled={
									actionBusy === "comment-root" || commentBody.trim().length < 2
								}
								submitLabel={
									actionBusy === "comment-root" ? "Posting..." : "Comment"
								}
								value={commentBody}
							/>
						</form>
					</>
				) : (
					<p className="community-comments-locked">
						{post.status === "held"
							? "Comments open after moderation review."
							: "This post is locked."}
					</p>
				)}

				{errorMessage ? (
					<p className="community-comment-empty">{errorMessage}</p>
				) : null}

				<div className="roast-list" role={commentTree.length ? "list" : undefined}>
					{commentTree.length ? (
						commentTree.map((comment) => renderCommentNode(comment))
					) : (
						<p className="muted-text">
							No comments yet. The first useful answer gets the thread moving.
						</p>
					)}
				</div>
			</section>
			)}
			</div>{/* end community-thread-body */}

			{/* Mobile "Join the conversation" trigger — opens dedicated composer overlay */}
			{post.status === "active" && !poll ? (
				<div className="community-mobile-join-trigger">
					<button
						className="community-mobile-join-pill"
						onClick={() => setMobileComposerOpen(true)}
						type="button"
					>
						<span>Join the conversation</span>
						<ChevronUp aria-hidden="true" />
					</button>
				</div>
			) : null}

			{/* Mobile full-screen comment composer overlay (Reddit-style dedicated page) */}
			{mobileComposerOpen && typeof document !== "undefined"
				? createPortal(
						<form
							aria-label="Add comment"
							aria-modal="true"
							className="community-mobile-composer-overlay"
							onSubmit={(event) => { void handleMobileComposerSubmit(event); }}
							ref={mobileComposerFormRef}
							role="dialog"
						>
							<header className="community-mobile-composer-header">
								<button
									aria-label="Cancel"
									className="community-mobile-composer-close"
									onClick={closeMobileComposer}
									type="button"
								>
									<X aria-hidden="true" />
								</button>
								<span className="community-mobile-composer-title">Add comment</span>
								<button
									className="community-mobile-composer-post"
									disabled={actionBusy === "comment-root" || commentBody.trim().length < 2}
									type="submit"
								>
									{actionBusy === "comment-root" ? "Posting…" : "Post"}
								</button>
							</header>
							<div className="community-mobile-composer-context">
								<p className="community-mobile-composer-post-title">{post.title}</p>
							</div>
							<div className="community-mobile-composer-body">
								<CommentComposer
									ariaLabel="Add comment"
									attachment={commentAttachment}
									autoFocus
									className="community-mobile-composer-input-area"
									contentFormat={commentContentFormat}
									disabledTools={actionBusy === "comment-root"}
									maxHeight={9999}
									minHeight={80}
									mentionSuggestions={communityMentionSuggestions}
									onAttachmentChange={setCommentAttachment}
									onChange={setCommentBody}
									onFormatChange={setCommentContentFormat}
									onRequireLogin={requireCommentLogin}
									placeholder="Join the conversation"
									showFormatTools={false}
									submitDisabled={true}
									submitLabel="Post"
									value={commentBody}
								/>
							</div>
						</form>,
						document.body,
					)
				: null}

			<AlertDialog
				open={postDeleteConfirmOpen && Boolean(post)}
				onOpenChange={setPostDeleteConfirmOpen}
			>
				<AlertDialogContent size="sm">
					<AlertDialogHeader>
						<AlertDialogTitle>Delete post?</AlertDialogTitle>
						<AlertDialogDescription>
							This permanently removes the post, comments, votes, poll data,
							and uploaded media.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={actionBusy === "post-delete"}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							disabled={actionBusy === "post-delete"}
							onClick={(event) => {
								event.preventDefault();
								void handlePostDelete();
							}}
						>
							Delete post
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog
				open={Boolean(pendingDeleteComment)}
				onOpenChange={(open) => {
					if (!open) setPendingDeleteComment(null);
				}}
			>
				<AlertDialogContent size="sm">
					<AlertDialogHeader>
						<AlertDialogTitle>Delete comment?</AlertDialogTitle>
						<AlertDialogDescription>
							This removes the comment body. Existing replies stay visible in
							the thread.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel
							disabled={
								pendingDeleteComment
									? actionBusy === `comment-delete-${pendingDeleteComment.id}`
									: false
							}
						>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							disabled={
								pendingDeleteComment
									? actionBusy === `comment-delete-${pendingDeleteComment.id}`
									: false
							}
							onClick={(event) => {
								event.preventDefault();
								if (pendingDeleteComment) {
									void handleCommentDelete(pendingDeleteComment);
								}
							}}
						>
							Delete comment
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{reportDialog && typeof document !== "undefined"
				? createPortal(reportDialog, document.body)
				: null}
			{mobileActionSheet && typeof document !== "undefined"
				? createPortal(mobileActionSheet, document.body)
				: null}
		</div>
	);
}
