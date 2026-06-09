import {
	communityFeatureResponse,
	communityRpcErrorResponse,
	firstRpcRow,
	getCommunityRouteId,
	isUuid,
	normalizeVoteReaction,
	readCommunityJsonBody,
	type CommunityRouteContext,
} from "@/lib/server/community-actions";
import { requireSignedInUser, serverAuthErrorResponse } from "@/lib/server-auth";
import type { CommunityVoteReaction } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CommentVoteResult = {
	comment_id: string;
	downvote_count: number;
	reaction: CommunityVoteReaction | null;
	upvote_count: number;
};

export async function POST(request: Request, context: CommunityRouteContext) {
	const disabled = communityFeatureResponse();
	if (disabled) return disabled;

	try {
		const commentId = await getCommunityRouteId(context);
		if (!isUuid(commentId)) {
			return Response.json({ message: "Comment not found." }, { status: 404 });
		}

		const payload = await readCommunityJsonBody(request);
		if (!payload) {
			return Response.json({ message: "Submit the vote as JSON." }, { status: 400 });
		}

		const reaction = normalizeVoteReaction(payload.reaction);
		if (reaction === undefined) {
			return Response.json({ message: "Choose a valid vote." }, { status: 400 });
		}

		const { admin, user } = await requireSignedInUser(request);
		const rpcResult = await admin.rpc("set_community_comment_vote", {
			next_reaction: reaction,
			target_comment_id: commentId,
			target_user_id: user.id,
		});

		if (rpcResult.error) return communityRpcErrorResponse(rpcResult.error);

		const result = firstRpcRow(
			rpcResult.data as CommentVoteResult[] | CommentVoteResult | null,
		);

		if (!result?.comment_id) {
			return Response.json({ message: "Vote was not saved." }, { status: 500 });
		}

		return Response.json({
			downvoteCount: result.downvote_count,
			reaction: result.reaction,
			upvoteCount: result.upvote_count,
		});
	} catch (error) {
		return serverAuthErrorResponse(error);
	}
}
