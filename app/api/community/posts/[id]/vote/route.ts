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
import { enforceApiRateLimit } from "@/lib/server/rate-limit";
import { requireSignedInUser, serverAuthErrorResponse } from "@/lib/server-auth";
import type { CommunityVoteReaction } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PostVoteResult = {
	downvote_count: number;
	post_id: string;
	reaction: CommunityVoteReaction | null;
	upvote_count: number;
};

export async function POST(request: Request, context: CommunityRouteContext) {
	const disabled = communityFeatureResponse();
	if (disabled) return disabled;

	try {
		const postId = await getCommunityRouteId(context);
		if (!isUuid(postId)) {
			return Response.json({ message: "Post not found." }, { status: 404 });
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
		const rateLimitResponse = await enforceApiRateLimit(
			admin,
			user.id,
			"communityVoteWrite",
		);
		if (rateLimitResponse) return rateLimitResponse;

		const rpcResult = await admin.rpc("set_community_post_vote", {
			next_reaction: reaction,
			target_post_id: postId,
			target_user_id: user.id,
		});

		if (rpcResult.error) return communityRpcErrorResponse(rpcResult.error);

		const result = firstRpcRow(
			rpcResult.data as PostVoteResult[] | PostVoteResult | null,
		);

		if (!result?.post_id) {
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
