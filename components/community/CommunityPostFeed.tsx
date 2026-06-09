"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
	Check,
	ChevronDown,
	Edit3,
	Forward,
	Lock,
	MessageCircle,
	MoreHorizontal,
	RefreshCw,
	ThumbsDown,
	ThumbsUp,
	Trash2,
	Unlock,
} from "lucide-react";
import { toast } from "sonner";
import FilledThumbIcon from "@/components/community/FilledThumbIcon";
import CommunityMediaGallery from "@/components/community/CommunityMediaGallery";
import FeedSkeleton from "@/components/feed/FeedSkeleton";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	COMMUNITY_POST_TYPE_LABELS,
	type CommunityPostType,
} from "@/lib/community";
import {
	canDeleteCommunityPost,
	canEditCommunityPost,
	getCommunityPollVoteBlockReason,
	getCommunityPostReactionBlockReason,
} from "@/lib/community-guardrails";
import {
	filterCommunityPostsForTabInCurrentOrder,
	getCommunityPostScore,
	sortCommunityPosts,
	type CommunityFeedTab,
} from "@/lib/community-feed";
import { formatCount } from "@/lib/feed-ranking";
import { getFreshAuthSession } from "@/lib/auth-session";
import { supabase } from "@/lib/supabase/client";
import { useAdminAccess } from "@/lib/use-admin-access";
import type {
	CommunityPostAttachment,
	CommunityPostPoll,
	CommunityPostPollOption,
	CommunityVoteReaction,
	ResumeAuthorProfile,
} from "@/lib/supabase/types";

type CommunityPostRow = {
	author_id: string;
	body: string;
	comment_count: number;
	created_at: string;
	downvote_count: number;
	id: string;
	last_activity_at: string;
	post_type: CommunityPostType;
	status: "active" | "locked" | "deleted" | "removed";
	title: string;
	topic_id: string;
	upvote_count: number;
};

type CommunityTopicRow = {
	id: string;
	name: string;
	slug: string;
};

type CommunityPostVoteRow = {
	post_id: string;
	reaction: CommunityVoteReaction;
};

type CommunityPostPollVoteRow = {
	option_id: string;
	poll_id: string;
};

type CommunityPostFeedPoll = CommunityPostPoll & {
	options: CommunityPostPollOption[];
	selectedOptionId: string;
};

type CommunityPostFeedItem = CommunityPostRow & {
	attachments: Array<CommunityPostAttachment & { publicUrl: string }>;
	authorProfile: Pick<
		ResumeAuthorProfile,
		"avatar_url" | "full_name" | "id" | "username"
	> | null;
	has_poll: boolean;
	poll: CommunityPostFeedPoll | null;
	topic: CommunityTopicRow | null;
	userReaction: CommunityVoteReaction | null;
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

type PostDeleteActionResponse = {
	message?: string;
	post?: {
		deletedAt?: string | null;
		id: string;
		status: CommunityPostRow["status"];
	};
};

type PostLockActionResponse = {
	message?: string;
	post?: {
		id: string;
		status: CommunityPostRow["status"];
		updatedAt?: string;
	};
};

function formatDate(value: string) {
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
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

function getAuthorName(
	profile: Pick<ResumeAuthorProfile, "full_name" | "username"> | null,
) {
	return profile?.full_name?.trim() || profile?.username?.trim() || "Community member";
}

function getCommunityAuthorAvatar(
	authorId: string,
	profile: Pick<ResumeAuthorProfile, "avatar_url" | "full_name" | "username"> | null,
) {
	if (profile?.avatar_url?.trim()) return profile.avatar_url.trim();

	const seed = profile?.full_name?.trim() || profile?.username?.trim() || authorId;
	return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed)}`;
}

function byId<T extends { id: string }>(rows: T[]) {
	return new Map(rows.map((row) => [row.id, row]));
}

function getCommentLabel(post: CommunityPostFeedItem) {
	if (post.post_type === "question") {
		return post.comment_count === 1 ? "answer" : "answers";
	}

	return post.comment_count === 1 ? "comment" : "comments";
}

function getFeedTextPreview(post: CommunityPostFeedItem) {
	if (post.attachments.length || post.poll) return "";

	return post.body.replace(/\s+/g, " ").trim();
}

function getPollTotalVotes(poll: CommunityPostFeedPoll) {
	return poll.options.reduce((total, option) => total + option.vote_count, 0);
}

function isPollClosed(poll: CommunityPostFeedPoll) {
	return new Date(poll.closes_at).getTime() <= Date.now();
}

function isMissingPollSchema(message: string) {
	return /community_post_polls|community_post_poll_options|community_post_poll_votes|schema cache|relation .* does not exist/i.test(
		message,
	);
}

const COMMUNITY_FEED_SORT: CommunityFeedTab = "hot";
const COMMUNITY_FEED_SORT_LABELS: Record<CommunityFeedTab, string> = {
	hot: "Best",
	new: "New",
	questions: "Questions",
	top: "Top",
	unanswered: "Unanswered",
};
const COMMUNITY_FEED_SORT_OPTIONS: Array<{
	label: string;
	value: CommunityFeedTab;
}> = [
	{ label: COMMUNITY_FEED_SORT_LABELS.hot, value: "hot" },
	{ label: COMMUNITY_FEED_SORT_LABELS.new, value: "new" },
	{ label: COMMUNITY_FEED_SORT_LABELS.top, value: "top" },
	{ label: COMMUNITY_FEED_SORT_LABELS.questions, value: "questions" },
	{ label: COMMUNITY_FEED_SORT_LABELS.unanswered, value: "unanswered" },
];

async function loadPostVoteReactions(userId: string, postIds: string[]) {
	if (!postIds.length) return new Map<string, CommunityVoteReaction>();

	const { data, error } = await supabase
		.from("community_post_votes")
		.select("post_id,reaction")
		.eq("voter_id", userId)
		.in("post_id", postIds);

	if (error) return new Map<string, CommunityVoteReaction>();

	return new Map(
		((data ?? []) as CommunityPostVoteRow[]).map((row) => [
			row.post_id,
			row.reaction,
		]),
	);
}

const PAUSED_LOCAL_COMMUNITY_FILTER_KEYS = [
	"linted-hidden-community-posts",
	"linted-blocked-community-authors",
];

export default function CommunityPostFeed() {
	const { isAdmin } = useAdminAccess();
	const [errorMessage, setErrorMessage] = useState("");
	const [loading, setLoading] = useState(true);
	const [posts, setPosts] = useState<CommunityPostFeedItem[]>([]);
	const [currentUserId, setCurrentUserId] = useState("");
	const [pollVotingIds, setPollVotingIds] = useState<Set<string>>(() => new Set());
	const [rowActionIds, setRowActionIds] = useState<Set<string>>(() => new Set());
	const [votingIds, setVotingIds] = useState<Set<string>>(() => new Set());
	const [activeTab, setActiveTab] = useState<CommunityFeedTab>(COMMUNITY_FEED_SORT);

	useEffect(() => {
		for (const key of PAUSED_LOCAL_COMMUNITY_FILTER_KEYS) {
			window.localStorage.removeItem(key);
		}
	}, []);

	useEffect(() => {
		let cancelled = false;

		async function loadPosts() {
			setLoading(true);
			setErrorMessage("");

			const { session } = await getFreshAuthSession();
			const userId = session?.user?.id ?? "";
			setCurrentUserId(userId);

			let query = supabase
				.from("community_posts")
				.select(
					"id,author_id,topic_id,post_type,title,body,status,comment_count,upvote_count,downvote_count,last_activity_at,created_at",
				)
				.in("status", ["active", "locked"]);

			if (activeTab === "questions" || activeTab === "unanswered") {
				query = query.eq("post_type", "question");
			}

			if (activeTab === "unanswered") {
				query = query.eq("comment_count", 0);
			}

			if (activeTab === "new" || activeTab === "questions" || activeTab === "unanswered") {
				query = query.order("created_at", { ascending: false });
			} else if (activeTab === "top") {
				query = query
					.order("upvote_count", { ascending: false })
					.order("created_at", { ascending: false });
			} else {
				query = query.order("last_activity_at", { ascending: false });
			}

			const postResult = await query.limit(activeTab === "hot" ? 70 : 50);

			if (cancelled) return;

			if (postResult.error) {
				setPosts([]);
				setErrorMessage("Community posts could not be loaded.");
				setLoading(false);
				return;
			}

			const postRows = (postResult.data ?? []) as CommunityPostRow[];
			if (!postRows.length) {
				setPosts([]);
				setLoading(false);
				return;
			}

			const postIds = postRows.map((post) => post.id);
			const topicIds = Array.from(new Set(postRows.map((post) => post.topic_id)));
			const authorIds = Array.from(new Set(postRows.map((post) => post.author_id)));

			const [
				attachmentResult,
				profileResult,
				pollResult,
				topicResult,
				voteReactions,
			] = await Promise.all([
				supabase
					.from("community_post_attachments")
					.select(
						"id,post_id,user_id,kind,source,storage_path,title,alt_text,mime_type,file_size,display_order,created_at",
					)
					.in("post_id", postIds)
					.order("display_order", { ascending: true }),
				supabase
					.from("profiles")
					.select("id,username,full_name,avatar_url")
					.in("id", authorIds),
				supabase
					.from("community_post_polls")
					.select("id,post_id,question,duration_days,closes_at,created_at,updated_at")
					.in("post_id", postIds),
				supabase
					.from("community_topics")
					.select("id,name,slug")
					.in("id", topicIds),
				userId
					? loadPostVoteReactions(userId, postIds)
					: Promise.resolve(new Map<string, CommunityVoteReaction>()),
			]);

			if (cancelled) return;

			const attachmentRows = (attachmentResult.data ??
				[]) as CommunityPostAttachment[];
			const pollRows =
				pollResult.error && isMissingPollSchema(pollResult.error.message)
					? []
					: ((pollResult.data ?? []) as CommunityPostPoll[]);
			const pollIds = pollRows.map((row) => row.id);
			const [pollOptionResult, pollVoteResult] = pollIds.length
				? await Promise.all([
						supabase
							.from("community_post_poll_options")
							.select("id,poll_id,option_text,display_order,vote_count,created_at,updated_at")
							.in("poll_id", pollIds)
							.order("display_order", { ascending: true }),
						userId
							? supabase
									.from("community_post_poll_votes")
									.select("poll_id,option_id")
									.eq("voter_id", userId)
									.in("poll_id", pollIds)
							: Promise.resolve({ data: [], error: null }),
					])
				: [
						{ data: [], error: null },
						{ data: [], error: null },
					];
			const pollOptions =
				pollOptionResult.error &&
				isMissingPollSchema(pollOptionResult.error.message)
					? []
					: ((pollOptionResult.data ?? []) as CommunityPostPollOption[]);
			const pollVotes =
				pollVoteResult.error && isMissingPollSchema(pollVoteResult.error.message)
					? []
					: ((pollVoteResult.data ?? []) as CommunityPostPollVoteRow[]);
			const pollVotesById = new Map(
				pollVotes.map((vote) => [vote.poll_id, vote.option_id]),
			);
			const pollsByPostId = new Map(
				pollRows.map((poll) => [
					poll.post_id,
					{
						...poll,
						options: pollOptions.filter((option) => option.poll_id === poll.id),
						selectedOptionId: pollVotesById.get(poll.id) ?? "",
					},
				]),
			);
			const profilesById = byId(
				(profileResult.data ?? []) as Pick<
					ResumeAuthorProfile,
					"avatar_url" | "full_name" | "id" | "username"
				>[],
			);
			const topicsById = byId((topicResult.data ?? []) as CommunityTopicRow[]);
			const nextPosts = postRows.map((post) => ({
				...post,
				attachments: attachmentRows
					.filter((attachment) => attachment.post_id === post.id)
					.map((attachment) => ({
						...attachment,
						publicUrl: supabase.storage
							.from("community-post-media")
							.getPublicUrl(attachment.storage_path).data.publicUrl,
					})),
				authorProfile: profilesById.get(post.author_id) ?? null,
				has_poll: pollsByPostId.has(post.id),
				poll: pollsByPostId.get(post.id) ?? null,
				topic: topicsById.get(post.topic_id) ?? null,
				userReaction: voteReactions.get(post.id) ?? null,
			}));

			setPosts(sortCommunityPosts(nextPosts, activeTab));
			setLoading(false);
		}

		void loadPosts();

		return () => {
			cancelled = true;
		};
	}, [activeTab]);

	const visiblePosts = useMemo(
		() => filterCommunityPostsForTabInCurrentOrder(posts, activeTab),
		[activeTab, posts],
	);

	function setVoting(postId: string, isVoting: boolean) {
		setVotingIds((current) => {
			const next = new Set(current);
			if (isVoting) {
				next.add(postId);
			} else {
				next.delete(postId);
			}
			return next;
		});
	}

	function setPollVoting(pollId: string, isVoting: boolean) {
		setPollVotingIds((current) => {
			const next = new Set(current);
			if (isVoting) {
				next.add(pollId);
			} else {
				next.delete(pollId);
			}
			return next;
		});
	}

	function setRowActionBusy(actionId: string, isBusy: boolean) {
		setRowActionIds((current) => {
			const next = new Set(current);
			if (isBusy) {
				next.add(actionId);
			} else {
				next.delete(actionId);
			}
			return next;
		});
	}

	async function runPostRowAction<T extends { message?: string }>({
		body,
		busyKey,
		fallbackMessage,
		method,
		path,
	}: {
		body?: Record<string, unknown>;
		busyKey: string;
		fallbackMessage: string;
		method?: "DELETE" | "POST";
		path: string;
	}) {
		if (rowActionIds.has(busyKey)) return null;

		const { session } = await getFreshAuthSession();
		const accessToken = session?.access_token;
		if (!accessToken) {
			toast.error("Sign in to manage posts.");
			return null;
		}

		setRowActionBusy(busyKey, true);
		try {
			const response = await fetch(path, {
				body: body ? JSON.stringify(body) : undefined,
				headers: {
					Authorization: `Bearer ${accessToken}`,
					...(body ? { "Content-Type": "application/json" } : {}),
				},
				method: method ?? "POST",
			});
			const result = (await response.json().catch(() => null)) as T | null;

			if (!response.ok || !result) {
				toast.error(result?.message ?? fallbackMessage);
				return null;
			}

			return result;
		} finally {
			setRowActionBusy(busyKey, false);
		}
	}

	async function handlePollVote(post: CommunityPostFeedItem, optionId: string) {
		if (!post.poll) return;

		const { session } = await getFreshAuthSession();
		const accessToken = session?.access_token;
		const userId = session?.user?.id;
		if (!accessToken || !userId) {
			toast.error("Sign in to vote in polls.");
			return;
		}

		const blockReason = getCommunityPollVoteBlockReason({
			activeUser: { id: userId },
			isClosed: isPollClosed(post.poll),
			isVoting: pollVotingIds.has(post.poll.id),
			postStatus: post.status,
		});
		if (blockReason) {
			toast.error(blockReason);
			return;
		}

		const previousOptionId = post.poll.selectedOptionId;
		setPollVoting(post.poll.id, true);

		try {
			const response = await fetch(`/api/community/polls/${post.poll.id}/vote`, {
				body: JSON.stringify({ optionId }),
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				method: "POST",
			});
			const result = (await response.json().catch(() => null)) as
				| PollVoteActionResponse
				| null;

			if (!response.ok || !result?.optionId) {
				toast.error(result?.message ?? "Could not update your poll vote.");
				return;
			}

			const nextOptionId = result.optionId;
			setPosts((current) =>
				current.map((row) => {
					if (row.id !== post.id || !row.poll) return row;

					return {
						...row,
						poll: {
							...row.poll,
							options: row.poll.options.map((option) => {
								if (
									option.id === previousOptionId &&
									previousOptionId !== nextOptionId
								) {
									return {
										...option,
										vote_count: Math.max(0, option.vote_count - 1),
									};
								}

								if (
									option.id === nextOptionId &&
									previousOptionId !== nextOptionId
								) {
									return {
										...option,
										vote_count: option.vote_count + 1,
									};
								}

								return option;
							}),
							selectedOptionId: nextOptionId,
						},
					};
				}),
			);
		} finally {
			setPollVoting(post.poll.id, false);
		}
	}

	async function handlePostVote(
		post: CommunityPostFeedItem,
		reaction: CommunityVoteReaction,
	) {
		const { session } = await getFreshAuthSession();
		const accessToken = session?.access_token;
		const userId = session?.user?.id;

		if (!accessToken || !userId) {
			toast.error("Sign in to vote on posts.");
			return;
		}

		if (votingIds.has(post.id)) return;

		const blockReason = getCommunityPostReactionBlockReason(
			{ id: userId },
			post,
		);
		if (blockReason) {
			toast.error(blockReason);
			return;
		}

		const nextReaction = post.userReaction === reaction ? null : reaction;
		setVoting(post.id, true);

		try {
			const response = await fetch(`/api/community/posts/${post.id}/vote`, {
				body: JSON.stringify({ reaction: nextReaction }),
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				method: "POST",
			});
			const result = (await response.json().catch(() => null)) as
				| VoteActionResponse
				| null;

			if (!response.ok || !result) {
				toast.error(result?.message ?? "Could not update your vote.");
				return;
			}

			setPosts((current) =>
				current.map((row) =>
					row.id === post.id
						? {
								...row,
								downvote_count: result.downvoteCount ?? row.downvote_count,
								upvote_count: result.upvoteCount ?? row.upvote_count,
								userReaction: result.reaction ?? null,
							}
						: row,
				),
			);
		} finally {
			setVoting(post.id, false);
		}
	}

	async function sharePost(post: CommunityPostFeedItem) {
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

	async function deletePostFromFeed(post: CommunityPostFeedItem) {
		if (currentUserId !== post.author_id && !isAdmin) {
			toast.error("Only the post author or an admin can delete this post.");
			return;
		}

		if (
			!window.confirm(
				"Delete this post permanently? This removes the post, comments, votes, poll data, and uploaded media.",
			)
		) {
			return;
		}

		const result = await runPostRowAction<PostDeleteActionResponse>({
			busyKey: `post-delete-${post.id}`,
			fallbackMessage: "Post was not deleted.",
			method: "DELETE",
			path: `/api/community/posts/${post.id}`,
		});

		if (!result?.post) return;

		setPosts((current) => current.filter((row) => row.id !== post.id));
		toast.success("Post deleted.");
	}

	async function togglePostLockFromFeed(post: CommunityPostFeedItem) {
		if (!isAdmin) return;

		const nextLocked = post.status !== "locked";
		const result = await runPostRowAction<PostLockActionResponse>({
			body: { locked: nextLocked },
			busyKey: `post-lock-${post.id}`,
			fallbackMessage: "Post lock was not updated.",
			path: `/api/community/posts/${post.id}/lock`,
		});

		if (!result?.post) return;

		setPosts((current) =>
			current.map((row) =>
				row.id === post.id
					? {
							...row,
							status: result.post?.status ?? row.status,
						}
					: row,
			),
		);
		toast.success(nextLocked ? "Post locked." : "Post unlocked.");
	}

	return (
		<section className="community-feed-panel" aria-label="Community posts">
			<div className="community-feed-toolbar" aria-label="Feed view controls">
				<DropdownMenu>
					<DropdownMenuTrigger
						aria-label={`Sort community posts by ${COMMUNITY_FEED_SORT_LABELS[activeTab]}`}
						className="community-feed-sort-indicator feed-sort-trigger"
					>
						<span>{COMMUNITY_FEED_SORT_LABELS[activeTab]}</span>
						<ChevronDown aria-hidden="true" />
					</DropdownMenuTrigger>
				<DropdownMenuContent
					align="start"
					className="feed-sort-menu reddit-select-content"
					sideOffset={8}
				>
					{COMMUNITY_FEED_SORT_OPTIONS.map((option) => {
						const isActive = activeTab === option.value;

						return (
							<DropdownMenuItem
								aria-current={isActive ? "page" : undefined}
								className={`feed-sort-menu-item${isActive ? " is-active" : ""}`}
								key={option.value}
								onSelect={() => {
									setActiveTab(option.value);
								}}
							>
								<span>{option.label}</span>
								{isActive ? <Check aria-hidden="true" /> : null}
							</DropdownMenuItem>
						);
					})}
				</DropdownMenuContent>
			</DropdownMenu>
			</div>
			{loading ? (
				<div className="community-feed-loading" aria-label="Loading community posts">
					<FeedSkeleton ariaLabel="Loading community feed" rowCount={3} />
				</div>
			) : errorMessage ? (
				<div className="community-feed-empty">
					<h2>Could not load posts</h2>
					<p>{errorMessage}</p>
					<button
						onClick={() => window.location.reload()}
						type="button"
					>
						<RefreshCw aria-hidden="true" />
						Retry
					</button>
				</div>
			) : visiblePosts.length ? (
				<div className="community-feed-list">
					{visiblePosts.map((post) => {
						const poll = post.poll;
						const pollClosed = poll ? isPollClosed(poll) : false;
						const pollTotalVotes = poll ? getPollTotalVotes(poll) : 0;
						const commentLabel = getCommentLabel(post);
						const activeUser = currentUserId ? { id: currentUserId } : null;
						const postVoteBlockReason = getCommunityPostReactionBlockReason(
							activeUser,
							post,
						);
						const postScore = getCommunityPostScore(post);
						const textPreview = getFeedTextPreview(post);
						const canEditPost = canEditCommunityPost(activeUser, post);
						const canDeletePost = canDeleteCommunityPost({
							activeUser,
							isAdmin,
							post,
						});
						const canModeratePost =
							isAdmin && (post.status === "active" || post.status === "locked");
						const deleteBusy = rowActionIds.has(`post-delete-${post.id}`);
						const lockBusy = rowActionIds.has(`post-lock-${post.id}`);

						return (
							<article
								className="community-feed-row"
								data-author-id={post.author_id}
								data-post-kind={poll ? "poll" : "standard"}
								key={post.id}
							>
								<div className="community-feed-row-main">
									<div className="community-feed-row-meta community-meta-tags">
										<Link
											className="community-author-badge"
											href={`/profile/${post.author_id}`}
										>
											<img
												alt=""
												aria-hidden="true"
												height={24}
												src={getCommunityAuthorAvatar(
													post.author_id,
													post.authorProfile,
												)}
												width={24}
											/>
											<span>{getAuthorName(post.authorProfile)}</span>
										</Link>
										<span className="badge role-badge">
											{post.topic?.name ?? "Community"}
										</span>
										<span className="badge neutral-badge">
											{COMMUNITY_POST_TYPE_LABELS[post.post_type]}
										</span>
										<time className="community-feed-date" dateTime={post.created_at}>
											{formatFeedDate(post.created_at)}
										</time>
									</div>

									{poll ? (
										<h2 className="community-feed-title community-feed-title-static">
											{post.title}
										</h2>
									) : (
										<Link className="community-feed-title" href={`/community/${post.id}`}>
											{post.title}
										</Link>
									)}

									{textPreview ? (
										<p className="community-feed-excerpt">
											{textPreview}
										</p>
									) : null}

									{post.attachments.length ? (
										<CommunityMediaGallery
											attachments={post.attachments}
											openHref={poll ? undefined : `/community/${post.id}`}
											openLabel={`Open ${post.title}`}
											variant="feed"
										/>
									) : null}

									{poll ? (
										<section className="community-poll-card community-feed-poll-card" aria-label="Poll">
											<div className="community-poll-card-header">
												<strong>Poll</strong>
												<span>
													{pollTotalVotes} {pollTotalVotes === 1 ? "vote" : "votes"}
													{" - "}
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
													const isPollVoteBusy = pollVotingIds.has(poll.id);

													return (
														<button
															aria-disabled={
																pollVoteBlockReason ? "true" : undefined
															}
															aria-pressed={isSelected}
															className={isSelected ? "is-selected" : ""}
															disabled={isPollVoteBusy}
															key={option.id}
															onClick={() => {
																void handlePollVote(post, option.id);
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

									<div className="community-feed-row-footer post-actions">
										{postVoteBlockReason ? null : (
											<div
												aria-label={`${postScore} score`}
												className="comment-reactions community-reactions"
											>
												<button
													aria-label="Upvote post"
													aria-pressed={post.userReaction === "upvote"}
													className={`comment-action-button reaction-button is-like${
														post.userReaction === "upvote" ? " is-active" : ""
													}`}
													disabled={votingIds.has(post.id)}
													onClick={() => {
														void handlePostVote(post, "upvote");
													}}
													title="Upvote"
													type="button"
												>
													{post.userReaction === "upvote" ? (
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
													{formatCount(postScore)}
												</span>
												<button
													aria-label="Downvote post"
													aria-pressed={post.userReaction === "downvote"}
													className={`comment-action-button reaction-button is-dislike${
														post.userReaction === "downvote" ? " is-active" : ""
													}`}
													disabled={votingIds.has(post.id)}
													onClick={() => {
														void handlePostVote(post, "downvote");
													}}
													title="Downvote"
													type="button"
												>
													{post.userReaction === "downvote" ? (
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
											<Link
												className="post-action-button"
												href={`/community/${post.id}#comments`}
											>
												<MessageCircle
													aria-hidden="true"
													className="post-action-icon"
													size={16}
												/>
												<span className="post-action-count">
													{formatCount(post.comment_count)}
												</span>
												<span className="sr-only">{commentLabel}</span>
											</Link>
										)}
										<button
											aria-label="Share post"
											className="post-action-button copy-button community-share-action"
											onClick={() => {
												void sharePost(post);
											}}
											type="button"
										>
											<Forward
												aria-hidden="true"
												className="post-action-icon"
												size={16}
											/>
											<span className="community-share-label">Share</span>
										</button>
										{post.status === "locked" ? (
											<span className="post-action-button community-static-action">
												<span className="post-action-label">Locked</span>
											</span>
										) : null}
										{canEditPost || canDeletePost || canModeratePost ? (
											<DropdownMenu>
												<DropdownMenuTrigger
													aria-label={`More actions for ${post.title}`}
													className="post-action-button community-row-menu-trigger"
												>
													<MoreHorizontal
														aria-hidden="true"
														className="post-action-icon"
														size={16}
													/>
												</DropdownMenuTrigger>
												<DropdownMenuContent
													align="end"
													className="reddit-select-content community-row-action-menu"
													sideOffset={8}
												>
													{canEditPost ? (
														<DropdownMenuItem
															asChild
															className="community-row-action-item"
														>
															<Link href={`/community/${post.id}?edit=1`}>
																<Edit3 aria-hidden="true" />
																<span>Edit</span>
															</Link>
														</DropdownMenuItem>
													) : null}
													{canDeletePost ? (
														<DropdownMenuItem
															className="community-row-action-item is-danger"
															disabled={deleteBusy}
															onSelect={() => {
																void deletePostFromFeed(post);
															}}
														>
															<Trash2 aria-hidden="true" />
															<span>{deleteBusy ? "Deleting..." : "Delete"}</span>
														</DropdownMenuItem>
													) : null}
													{canModeratePost ? (
														<DropdownMenuItem
															className="community-row-action-item"
															disabled={lockBusy}
															onSelect={() => {
																void togglePostLockFromFeed(post);
															}}
														>
															{post.status === "locked" ? (
																<Unlock aria-hidden="true" />
															) : (
																<Lock aria-hidden="true" />
															)}
															<span>
																{lockBusy
																	? "Updating..."
																	: post.status === "locked"
																		? "Unlock"
																		: "Lock"}
															</span>
														</DropdownMenuItem>
													) : null}
												</DropdownMenuContent>
											</DropdownMenu>
										) : null}
									</div>
								</div>

							</article>
						);
					})}
				</div>
			) : (
				<div className="community-feed-empty">
					<h2>No posts here yet</h2>
					<p>Start a focused tech, placement, internship, or career thread.</p>
					<Link className="btn-primary" href="/community/new">
						Create
					</Link>
				</div>
			)}
		</section>
	);
}
