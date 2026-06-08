import {
	COMMUNITY_POST_BODY_MAX_LENGTH,
	COMMUNITY_POST_TITLE_MAX_LENGTH,
	COMMUNITY_POST_TITLE_MIN_LENGTH,
	cleanCommunityText,
} from "@/lib/community-validation";
import {
	communityFeatureResponse,
	communityRpcErrorResponse,
	firstRpcRow,
	getCommunityRouteId,
	isUuid,
	readCommunityJsonBody,
	type CommunityRouteContext,
} from "@/lib/server/community-actions";
import { requireSignedInUser, serverAuthErrorResponse } from "@/lib/server-auth";
import type { CommunityPostStatus } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PostEditResult = {
	body: string;
	id: string;
	status: CommunityPostStatus;
	title: string;
	updated_at: string;
};

type PostDeleteResult = {
	deleted_at: string | null;
	id: string;
	status: CommunityPostStatus;
};

function getPostEditIssue(title: string, body: string) {
	if (!title) return "Add a title.";
	if (title.length < COMMUNITY_POST_TITLE_MIN_LENGTH) {
		return `Add ${COMMUNITY_POST_TITLE_MIN_LENGTH - title.length} more characters to the title.`;
	}
	if (title.length > COMMUNITY_POST_TITLE_MAX_LENGTH) {
		return `Keep the title under ${COMMUNITY_POST_TITLE_MAX_LENGTH} characters.`;
	}
	if (body.length > COMMUNITY_POST_BODY_MAX_LENGTH) {
		return `Keep the body under ${COMMUNITY_POST_BODY_MAX_LENGTH} characters.`;
	}
	return "";
}

export async function PATCH(request: Request, context: CommunityRouteContext) {
	const disabled = communityFeatureResponse();
	if (disabled) return disabled;

	try {
		const postId = await getCommunityRouteId(context);
		if (!isUuid(postId)) {
			return Response.json({ message: "Post not found." }, { status: 404 });
		}

		const payload = await readCommunityJsonBody(request);
		if (!payload) {
			return Response.json({ message: "Submit the post as JSON." }, { status: 400 });
		}

		const title = cleanCommunityText(payload.title);
		const body = cleanCommunityText(payload.body);
		const issue = getPostEditIssue(title, body);
		if (issue) return Response.json({ message: issue }, { status: 400 });

		const { admin, user } = await requireSignedInUser(request);
		const rpcResult = await admin.rpc("update_community_post_content", {
			next_body: body,
			next_title: title,
			target_post_id: postId,
			target_user_id: user.id,
		});

		if (rpcResult.error) return communityRpcErrorResponse(rpcResult.error);

		const result = firstRpcRow(
			rpcResult.data as PostEditResult[] | PostEditResult | null,
		);

		if (!result?.id) {
			return Response.json({ message: "Post was not updated." }, { status: 500 });
		}

		return Response.json({
			post: {
				body: result.body,
				id: result.id,
				status: result.status,
				title: result.title,
				updatedAt: result.updated_at,
			},
		});
	} catch (error) {
		return serverAuthErrorResponse(error);
	}
}

export async function DELETE(request: Request, context: CommunityRouteContext) {
	const disabled = communityFeatureResponse();
	if (disabled) return disabled;

	try {
		const postId = await getCommunityRouteId(context);
		if (!isUuid(postId)) {
			return Response.json({ message: "Post not found." }, { status: 404 });
		}

		const { admin, user } = await requireSignedInUser(request);
		const rpcResult = await admin.rpc("soft_delete_community_post", {
			target_post_id: postId,
			target_user_id: user.id,
		});

		if (rpcResult.error) return communityRpcErrorResponse(rpcResult.error);

		const result = firstRpcRow(
			rpcResult.data as PostDeleteResult[] | PostDeleteResult | null,
		);

		if (!result?.id) {
			return Response.json({ message: "Post was not deleted." }, { status: 500 });
		}

		return Response.json({
			post: {
				deletedAt: result.deleted_at,
				id: result.id,
				status: result.status,
			},
		});
	} catch (error) {
		return serverAuthErrorResponse(error);
	}
}
