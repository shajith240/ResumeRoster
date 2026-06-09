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
	useState,
	type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	Bookmark,
	ChevronLeft,
	Check,
	Download,
	Edit3,
	Flag,
	Forward,
	Lock,
	MessageCircle,
	MoreHorizontal,
	Share2,
	ThumbsDown,
	ThumbsUp,
	Trash2,
	Unlock,
	X,
} from "lucide-react";
import { toast } from "sonner";
import FilledThumbIcon from "@/components/community/FilledThumbIcon";
import CommunityMediaGallery from "@/components/community/CommunityMediaGallery";
import LoadingScreen from "@/components/LoadingScreen";
import { CommentComposer } from "@/components/resume-detail/comment-composer";
import { Button } from "@/components/ui/button";
import { getFreshAuthSession } from "@/lib/auth-session";
import {
	buildMentionSuggestions,
	buildMentionTargetMap,
	getMentionHandleKey,
	MENTION_TEXT_PATTERN,
} from "@/lib/comment-mentions";
import { COMMUNITY_POST_TYPE_LABELS, type CommunityPostType } from "@/lib/community";
import {
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
import {
	getReportIssue,
	REPORT_REASON_OPTIONS,
	type ReportReason,
} from "@/lib/report-validation";
import { supabase } from "@/lib/supabase/client";
import type {
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

type ProfilePreview = Pick<
	ResumeAuthorProfile,
	"avatar_url" | "full_name" | "id" | "username"
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

type SaveActionResponse = {
	message?: string;
	saveCount?: number;
	saved?: boolean;
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

function formatDate(value: string) {
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
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
	const seed = profile?.full_name?.trim() || profile?.username?.trim() || authorId;
	return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed)}`;
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
	const [mobileActionSheetOpen, setMobileActionSheetOpen] = useState(false);
	const [mobileCommentsSheetDrag, setMobileCommentsSheetDrag] = useState(0);
	const [mobileCommentsSheetState, setMobileCommentsSheetState] =
		useState<MobileSheetState>("peek");
	const [mobilePostBodyExpanded, setMobilePostBodyExpanded] = useState(false);
	const [post, setPost] = useState<CommunityPost | null>(null);
	const [postEditBody, setPostEditBody] = useState("");
	const [postEditTitle, setPostEditTitle] = useState("");
	const [poll, setPoll] = useState<CommunityPollView | null>(null);
	const [postReaction, setPostReaction] = useState<CommunityVoteReaction | null>(
		null,
	);
	const [postSaved, setPostSaved] = useState(false);
	const [profiles, setProfiles] = useState<Record<string, ProfilePreview>>({});
	const [replyBodies, setReplyBodies] = useState<Record<string, string>>({});
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
			setPost(null);
			setLoading(false);
			return;
		}

		const nextPost = data as CommunityPost;
		if (nextPost.status === "deleted" || nextPost.status === "removed") {
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
			postSaveResult,
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
				supabase
					.from("community_post_comments")
					.select(
						"id,post_id,parent_id,author_id,body,status,reply_count,upvote_count,downvote_count,deleted_at,created_at,updated_at",
					)
					.eq("post_id", postId)
					.order("created_at", { ascending: true }),
				userId
					? supabase
							.from("community_post_votes")
							.select("reaction")
							.eq("post_id", postId)
							.eq("voter_id", userId)
							.maybeSingle()
					: Promise.resolve({ data: null, error: null }),
				userId
					? supabase
							.from("community_post_saves")
							.select("post_id")
							.eq("post_id", postId)
							.eq("user_id", userId)
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
		const profileResult = authorIds.length
			? await supabase
					.from("profiles")
					.select("id,username,full_name,avatar_url")
					.in("id", authorIds)
			: { data: [], error: null };

		const nextProfiles = ((profileResult.data ?? []) as ProfilePreview[]).reduce<
			Record<string, ProfilePreview>
		>((profileMap, profile) => {
			profileMap[profile.id] = profile;
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

		setTopic((topicResult.data as CommunityTopic | null) ?? null);
		setAttachments(
			((attachmentResult.data ?? []) as CommunityPostAttachment[]).map(
				(attachment) => ({
					...attachment,
					publicUrl: supabase.storage
						.from("community-post-media")
						.getPublicUrl(attachment.storage_path).data.publicUrl,
				}),
			),
		);

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
		setPostSaved(Boolean(postSaveResult.data));
		setProfiles(nextProfiles);
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

	const commentTree = useMemo(
		() => buildCommunityCommentTree(comments),
		[comments],
	);
	const communityMentionSuggestions = useMemo(() => {
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
	const communityMentionTargets = useMemo(() => {
		if (!post) return {};

		return buildMentionTargetMap(
			buildMentionSuggestions(
				[post.author_id, ...comments.map((comment) => comment.author_id)],
				profiles,
			),
		);
	}, [comments, post, profiles]);

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

	function renderCommunityParagraphs(body: string) {
		return body.split(/\n{2,}/).map((paragraph, index) => (
			<p key={`${index}-${paragraph.slice(0, 20)}`}>
				{renderCommunityTextWithMentions(paragraph, `community-${index}`)}
			</p>
		));
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
		} finally {
			setActionBusy("");
		}
	}

	async function submitComment(parentId: string | null, body: string) {
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
			setReplyingToId("");
		} else {
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
		await submitComment(null, commentBody);
	}

	function handleRootCommentCancel() {
		setCommentBody("");
		setCommentContentFormat("plain");
		setRootCommentComposerOpen(false);
	}

	async function handleReplySubmit(
		event: FormEvent<HTMLFormElement>,
		parentId: string,
	) {
		event.preventDefault();
		await submitComment(parentId, replyBodies[parentId] ?? "");
	}

	async function handlePostVote(reaction: CommunityVoteReaction) {
		if (!post) return;

		const blockReason = getCommunityPostReactionBlockReason(
			currentUserId ? { id: currentUserId } : null,
			post,
		);
		if (blockReason) {
			toast.error(blockReason);
			return;
		}

		const nextReaction = postReaction === reaction ? null : reaction;
		const result = await runCommunityAction<VoteActionResponse>(
			`/api/community/posts/${post.id}/vote`,
			{
				body: { reaction: nextReaction },
				busyKey: `post-vote-${reaction}`,
				fallbackMessage: "Could not update your vote.",
			},
		);

		if (result?.upvoteCount === undefined || result.downvoteCount === undefined) {
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

	async function toggleSavedPost() {
		if (!post) return;

		if (currentUserId && post.author_id === currentUserId) {
			toast.error("You cannot save your own post.");
			return;
		}

		if (post.status !== "active") {
			toast.error("This post is not available to save.");
			return;
		}

		const nextSaved = !postSaved;
		setPostSaved(nextSaved);
		const result = await runCommunityAction<SaveActionResponse>(
			`/api/community/posts/${post.id}/save`,
			{
				body: { saved: nextSaved },
				busyKey: "post-save",
				fallbackMessage: "Could not update saved posts.",
			},
		);

		if (result?.saved === undefined) {
			setPostSaved(!nextSaved);
			return;
		}

		setPostSaved(Boolean(result.saved));
		toast.success(result.saved ? "Post saved." : "Removed from saved posts.");
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

		if (isMobileGestureBlocked(event.target)) return;

		event.currentTarget.setPointerCapture(event.pointerId);
		const startX = event.clientX;
		const startY = event.clientY;
		let shouldReveal = false;

		if (mobileCommentsSheetState === "open") {
			function cleanupCloseGesture() {
				window.removeEventListener("pointermove", handleClosePointerMove);
				window.removeEventListener("pointerup", cleanupCloseGesture);
				window.removeEventListener("pointercancel", cleanupCloseGesture);
			}

			function handleClosePointerMove(moveEvent: PointerEvent) {
				const deltaY = moveEvent.clientY - startY;
				if (deltaY <= 42) return;
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

		event.currentTarget.setPointerCapture(event.pointerId);
		const startY = event.clientY;
		const startState = mobileCommentsSheetState;
		const maxDrag = Math.round(window.innerHeight * 0.72);
		let didDrag = false;

		function handlePointerMove(moveEvent: PointerEvent) {
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
				if (startState === "peek" && delta < -42) {
					setMobileCommentsSheetState("open");
				} else if (startState === "open" && delta > 56) {
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
		const attachment = attachments[0];
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
		const result = await runCommunityAction<PollVoteActionResponse>(
			`/api/community/polls/${poll.id}/vote`,
			{
				body: { optionId },
				busyKey: `poll-vote-${optionId}`,
				fallbackMessage: "Could not update your poll vote.",
			},
		);

		const nextOptionId = result?.optionId;
		if (!nextOptionId) return;

		setPoll((current) => {
			if (!current) return current;

			return {
				...current,
				options: current.options.map((option) => {
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
		});
	}

	async function handleCommentVote(
		comment: CommunityPostComment,
		reaction: CommunityVoteReaction,
	) {
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
		const result = await runCommunityAction<VoteActionResponse>(
			`/api/community/comments/${comment.id}/vote`,
			{
				body: { reaction: nextReaction },
				busyKey: `comment-vote-${comment.id}-${reaction}`,
				fallbackMessage: "Could not update your vote.",
			},
		);

		if (result?.upvoteCount === undefined || result.downvoteCount === undefined) {
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
		if (!window.confirm("Delete this post? This hides it from the community.")) {
			return;
		}

		const result = await runCommunityAction<CommentDeleteResponse>(
			`/api/community/posts/${post.id}`,
			{
				busyKey: "post-delete",
				fallbackMessage: "Post was not deleted.",
				method: "DELETE",
			},
		);

		if (!result) return;

		toast.success("Post deleted.");
		router.push("/community");
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
		if (!window.confirm("Delete this comment? Replies stay visible.")) {
			return;
		}

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
							<img
								alt=""
								aria-hidden="true"
								className="thread-roast-avatar"
								height={32}
								src={getCommunityAuthorAvatar(node.author_id, profile)}
								width={32}
							/>
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
							<div>{renderCommunityParagraphs(node.body)}</div>
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
											{reaction === "upvote" ? (
												<FilledThumbIcon
													className="reaction-icon reaction-icon-filled"
													direction="up"
												/>
											) : (
												<ThumbsUp
													aria-hidden="true"
													className="reaction-icon reaction-icon-outline"
												/>
											)}
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
											{reaction === "downvote" ? (
												<FilledThumbIcon
													className="reaction-icon reaction-icon-filled"
													direction="down"
												/>
											) : (
												<ThumbsDown
													aria-hidden="true"
													className="reaction-icon reaction-icon-outline"
												/>
											)}
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
												void handleCommentDelete(node);
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
									attachment={null}
									autoFocus
									className="comment-composer-reply"
									contentFormat={replyContentFormat}
									disabledTools
									maxHeight={220}
									minHeight={56}
									mentionSuggestions={communityMentionSuggestions}
									onAttachmentChange={() => undefined}
									onCancel={() => setReplyingToId("")}
									onChange={(value) =>
										setReplyBodies((current) => ({
											...current,
											[node.id]: value,
										}))
									}
									onFormatChange={setReplyContentFormat}
									onRequireLogin={requireCommentLogin}
									placeholder={`Reply to ${authorHandle}`}
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
	const canEditPost = isOwnPost && (post.status === "active" || post.status === "locked");
	const canSavePost =
		Boolean(activeUser) && !isOwnPost && post.status === "active";
	const canReportPost =
		Boolean(currentUserId) &&
		!isOwnPost &&
		post.status === "active";
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
		<div className="community-report-backdrop">
			<form
				aria-modal="true"
				className="community-report-dialog"
				onSubmit={(event) => {
					void handleReportSubmit(event);
				}}
				role="dialog"
			>
				<header>
					<div>
						<span>Report</span>
						<h2>
							{reportTarget.type === "post" ? "Report post" : "Report comment"}
						</h2>
					</div>
					<button
						aria-label="Close report dialog"
						className="community-action-button"
						onClick={() => setReportTarget(null)}
						type="button"
					>
						<X aria-hidden="true" />
					</button>
				</header>

				<div className="community-report-options">
					{REPORT_REASON_OPTIONS.map((option) => (
						<label
							className={reportReason === option.value ? "is-selected" : undefined}
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

				<label className="field-block">
					<span>Details</span>
					<textarea
						maxLength={800}
						onChange={(event) => setReportDetails(event.target.value)}
						placeholder="Add moderator context."
						value={reportDetails}
					/>
				</label>

				<div className="community-report-actions">
					<button
						className="community-action-button"
						onClick={() => setReportTarget(null)}
						type="button"
					>
						Cancel
					</button>
					<button
						className="btn-primary"
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
					{canSavePost ? (
						<button
							disabled={actionBusy === "post-save"}
							onClick={() => {
								setMobileActionSheetOpen(false);
								void toggleSavedPost();
							}}
							type="button"
						>
							<Bookmark aria-hidden="true" />
							<span>{postSaved ? "Saved" : "Save"}</span>
						</button>
					) : null}
					{attachments.length ? (
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
				</div>
			</div>
		</div>
	) : null;

	return (
		<div
			className="community-post-thread"
			data-has-media={attachments.length ? "true" : "false"}
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
					<img
						alt=""
						aria-hidden="true"
						height={24}
						src={getCommunityAuthorAvatar(post.author_id, authorProfile)}
						width={24}
					/>
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
			<article
				className="community-post-detail"
				onClick={handleMobilePostSurfaceClick}
				onPointerDown={startMobilePostRevealGesture}
				onWheel={handleMobilePostWheel}
			>
				<header className="community-post-detail-header">
					<div className="community-post-meta-row community-meta-tags">
						<span className="badge neutral-badge">
							{getAuthorName(authorProfile)}
						</span>
						<span className="badge role-badge">{topic?.name ?? "Community"}</span>
						<span className="badge neutral-badge">
							{COMMUNITY_POST_TYPE_LABELS[post.post_type]}
						</span>
						<time className="badge neutral-badge" dateTime={post.created_at}>
							{formatDate(post.created_at)}
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
									Save post
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
						data-mobile-body-toggle={canExpandMobilePostBody ? "true" : undefined}
						onClick={() => {
							if (!canExpandMobilePostBody || !isMobileViewport()) return;
							setMobilePostBodyExpanded((current) => !current);
						}}
						onKeyDown={(event) => {
							if (!canExpandMobilePostBody || !isMobileViewport()) return;
							if (event.key !== "Enter" && event.key !== " ") return;
							event.preventDefault();
							setMobilePostBodyExpanded((current) => !current);
						}}
						role={canExpandMobilePostBody ? "button" : undefined}
						tabIndex={canExpandMobilePostBody ? 0 : undefined}
					>
						{renderCommunityParagraphs(post.body)}
						{canExpandMobilePostBody ? (
							<span className="community-post-body-more">
								{mobilePostBodyExpanded ? "less" : "more"}
							</span>
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
								const canVote =
									!getCommunityPollVoteBlockReason({
										activeUser,
										isClosed: pollClosed,
										isVoting: actionBusy.startsWith("poll-vote-"),
										postStatus: post.status,
									});

								return (
									<button
										aria-pressed={isSelected}
										className={isSelected ? "is-selected" : ""}
										disabled={!canVote}
										key={option.id}
										onClick={() => {
											void handlePollVote(option.id);
										}}
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

				{attachments.length ? (
					<CommunityMediaGallery attachments={attachments} variant="detail" />
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
								{postReaction === "upvote" ? (
									<FilledThumbIcon
										className="reaction-icon reaction-icon-filled"
										direction="up"
									/>
								) : (
									<ThumbsUp
										aria-hidden="true"
										className="reaction-icon reaction-icon-outline"
									/>
								)}
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
								{postReaction === "downvote" ? (
									<FilledThumbIcon
										className="reaction-icon reaction-icon-filled"
										direction="down"
									/>
								) : (
									<ThumbsDown
										aria-hidden="true"
										className="reaction-icon reaction-icon-outline"
									/>
								)}
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
					{canEditPost || isAdmin ? (
						<div className="community-owner-actions">
							{canEditPost ? (
								<>
									<button
										className="community-action-button"
										onClick={() => setEditingPost(true)}
										type="button"
									>
										<Edit3 aria-hidden="true" />
										Edit
									</button>
									<button
										className="community-action-button is-danger"
										disabled={actionBusy === "post-delete"}
										onClick={() => {
											void handlePostDelete();
										}}
										type="button"
									>
										<Trash2 aria-hidden="true" />
										Delete
									</button>
								</>
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
									attachment={null}
									autoFocus
									cancelLabel="Cancel"
									className="community-root-comment-composer"
									contentFormat={commentContentFormat}
									disabledTools
									maxHeight={160}
									minHeight={44}
									mentionSuggestions={communityMentionSuggestions}
									onAttachmentChange={() => undefined}
									onCancel={handleRootCommentCancel}
									onChange={setCommentBody}
									onFormatChange={setCommentContentFormat}
									onRequireLogin={requireCommentLogin}
									placeholder="Join the conversation"
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
								attachment={null}
								className="community-root-comment-composer community-root-comment-composer-mobile"
								contentFormat={commentContentFormat}
								disabledTools
								maxHeight={96}
								minHeight={40}
								mentionSuggestions={communityMentionSuggestions}
								onAttachmentChange={() => undefined}
								onChange={setCommentBody}
								onFormatChange={setCommentContentFormat}
								onRequireLogin={requireCommentLogin}
								placeholder="Join the conversation"
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

			{reportDialog && typeof document !== "undefined"
				? createPortal(reportDialog, document.body)
				: null}
			{mobileActionSheet && typeof document !== "undefined"
				? createPortal(mobileActionSheet, document.body)
				: null}
		</div>
	);
}
