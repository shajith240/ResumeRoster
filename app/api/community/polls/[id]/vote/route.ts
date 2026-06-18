import {
	communityFeatureResponse,
	communityRpcErrorResponse,
	firstRpcRow,
	getCommunityRouteId,
	isUuid,
	readCommunityJsonBody,
	type CommunityRouteContext,
} from "@/lib/server/community-actions";
import { enforceApiRateLimit } from "@/lib/server/rate-limit";
import { requireSignedInUser, serverAuthErrorResponse } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PollVoteResult = {
	option_id: string;
	poll_id: string;
};

export async function POST(request: Request, context: CommunityRouteContext) {
	const disabled = communityFeatureResponse();
	if (disabled) return disabled;

	try {
		const pollId = await getCommunityRouteId(context);
		if (!isUuid(pollId)) {
			return Response.json({ message: "Poll not found." }, { status: 404 });
		}

		const payload = await readCommunityJsonBody(request);
		if (!payload) {
			return Response.json({ message: "Submit the vote as JSON." }, { status: 400 });
		}

		const optionId =
			typeof payload.optionId === "string" ? payload.optionId.trim() : "";
		if (!isUuid(optionId)) {
			return Response.json({ message: "Choose a valid poll option." }, { status: 400 });
		}

		const { admin, user } = await requireSignedInUser(request);
		const rateLimitResponse = await enforceApiRateLimit(
			admin,
			user.id,
			"communityVoteWrite",
		);
		if (rateLimitResponse) return rateLimitResponse;

		const rpcResult = await admin.rpc("vote_community_post_poll", {
			selected_option_id: optionId,
			target_poll_id: pollId,
			target_user_id: user.id,
		});

		if (rpcResult.error) return communityRpcErrorResponse(rpcResult.error);

		const result = firstRpcRow(
			rpcResult.data as PollVoteResult[] | PollVoteResult | null,
		);

		if (!result?.poll_id) {
			return Response.json({ message: "Poll vote was not saved." }, { status: 500 });
		}

		return Response.json({
			optionId: result.option_id,
			pollId: result.poll_id,
		});
	} catch (error) {
		return serverAuthErrorResponse(error);
	}
}
