import {
	canReplyToCommunityComment,
	type CommunityCommentNode,
} from "@/lib/community-threading";
import type {
	CommunityPostComment,
	CommunityPostStatus,
} from "@/lib/supabase/types";

type ActiveUserLike = {
	id: string;
} | null;

type CommunityPostLike = {
	author_id: string;
	status: CommunityPostStatus;
};

type CommunityCommentLike = Pick<
	CommunityPostComment,
	"author_id" | "status"
>;

export function getCommunityPostReactionBlockReason(
	activeUser: ActiveUserLike,
	post: CommunityPostLike,
) {
	if (!activeUser) return null;
	if (post.author_id === activeUser.id) {
		return "You cannot vote on your own post.";
	}
	if (post.status !== "active") {
		return "This post is not open for voting.";
	}

	return null;
}

export function canEditCommunityPost(
	activeUser: ActiveUserLike,
	post: CommunityPostLike,
) {
	return Boolean(
		activeUser &&
			post.author_id === activeUser.id &&
			(post.status === "active" || post.status === "locked"),
	);
}

export function canDeleteCommunityPost({
	activeUser,
	isAdmin,
	post,
}: {
	activeUser: ActiveUserLike;
	isAdmin: boolean;
	post: CommunityPostLike;
}) {
	return Boolean(
		(isAdmin || (activeUser && post.author_id === activeUser.id)) &&
			(post.status === "active" || post.status === "locked" || post.status === "held"),
	);
}

export function getCommunityCommentReactionBlockReason(
	activeUser: ActiveUserLike,
	comment: CommunityCommentLike,
) {
	if (!activeUser) return null;
	if (comment.author_id === activeUser.id) {
		return "You cannot vote on your own comment.";
	}
	if (comment.status !== "active") {
		return "This comment is not open for voting.";
	}

	return null;
}

export function getCommunityCommentReplyBlockReason({
	activeUser,
	comment,
	postStatus,
}: {
	activeUser: ActiveUserLike;
	comment: Pick<CommunityCommentNode, "author_id" | "depth" | "status">;
	postStatus: CommunityPostStatus;
}) {
	if (postStatus !== "active") return "This post is closed for new replies.";
	if (comment.status !== "active") return "This comment cannot receive replies.";
	if (activeUser && comment.author_id === activeUser.id) {
		return "You cannot reply to your own comment.";
	}
	if (!canReplyToCommunityComment(comment.depth)) {
		return "This thread is at the reply limit.";
	}

	return null;
}

export function getCommunityPollVoteBlockReason({
	activeUser,
	isClosed,
	isVoting,
	postStatus,
}: {
	activeUser: ActiveUserLike;
	isClosed: boolean;
	isVoting: boolean;
	postStatus: CommunityPostStatus;
}) {
	if (!activeUser) return null;
	if (postStatus !== "active") return "This poll is not open for voting.";
	if (isClosed) return "This poll is closed.";
	if (isVoting) return "Your poll vote is already updating.";

	return null;
}
