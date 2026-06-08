import { cleanCommunityText } from "@/lib/community-validation";
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
import type { CommunityCommentStatus } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CommentEditResult = {
	body: string;
	id: string;
	status: CommunityCommentStatus;
	updated_at: string;
};

type CommentDeleteResult = {
	deleted_at: string | null;
	id: string;
	status: CommunityCommentStatus;
};

function getCommentIssue(body: string) {
	if (!body) return "Write a comment.";
	if (body.length < 2) return "Write at least 2 characters.";
	if (body.length > 6000) return "Keep comments under 6000 characters.";
	return "";
}

export async function PATCH(request: Request, context: CommunityRouteContext) {
	const disabled = communityFeatureResponse();
	if (disabled) return disabled;

	try {
		const commentId = await getCommunityRouteId(context);
		if (!isUuid(commentId)) {
			return Response.json({ message: "Comment not found." }, { status: 404 });
		}

		const payload = await readCommunityJsonBody(request);
		if (!payload) {
			return Response.json({ message: "Submit the comment as JSON." }, { status: 400 });
		}

		const body = cleanCommunityText(payload.body);
		const issue = getCommentIssue(body);
		if (issue) return Response.json({ message: issue }, { status: 400 });

		const { admin, user } = await requireSignedInUser(request);
		const rpcResult = await admin.rpc("update_community_comment_content", {
			next_body: body,
			target_comment_id: commentId,
			target_user_id: user.id,
		});

		if (rpcResult.error) return communityRpcErrorResponse(rpcResult.error);

		const result = firstRpcRow(
			rpcResult.data as CommentEditResult[] | CommentEditResult | null,
		);

		if (!result?.id) {
			return Response.json({ message: "Comment was not updated." }, { status: 500 });
		}

		return Response.json({
			comment: {
				body: result.body,
				id: result.id,
				status: result.status,
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
		const commentId = await getCommunityRouteId(context);
		if (!isUuid(commentId)) {
			return Response.json({ message: "Comment not found." }, { status: 404 });
		}

		const { admin, user } = await requireSignedInUser(request);
		const rpcResult = await admin.rpc("soft_delete_community_comment", {
			target_comment_id: commentId,
			target_user_id: user.id,
		});

		if (rpcResult.error) return communityRpcErrorResponse(rpcResult.error);

		const result = firstRpcRow(
			rpcResult.data as CommentDeleteResult[] | CommentDeleteResult | null,
		);

		if (!result?.id) {
			return Response.json({ message: "Comment was not deleted." }, { status: 500 });
		}

		return Response.json({
			comment: {
				deletedAt: result.deleted_at,
				id: result.id,
				status: result.status,
			},
		});
	} catch (error) {
		return serverAuthErrorResponse(error);
	}
}
