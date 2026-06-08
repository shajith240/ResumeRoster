import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import {
	communityFeatureResponse,
	communityRpcErrorResponse,
	firstRpcRow,
	getCommunityRouteId,
	isUuid,
	readCommunityJsonBody,
	type CommunityRouteContext,
} from "@/lib/server/community-actions";
import type { CommunityPostStatus } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PostLockResult = {
	id: string;
	status: CommunityPostStatus;
	updated_at: string;
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
		if (!payload || typeof payload.locked !== "boolean") {
			return Response.json(
				{ message: "Choose whether this post is locked." },
				{ status: 400 },
			);
		}

		const { admin, user } = await requireAdmin(request);
		const rpcResult = await admin.rpc("set_community_post_lock", {
			should_lock: payload.locked,
			target_admin_id: user.id,
			target_post_id: postId,
		});

		if (rpcResult.error) {
			return communityRpcErrorResponse(
				rpcResult.error,
				"Community moderation failed. Please try again.",
			);
		}

		const result = firstRpcRow(
			rpcResult.data as PostLockResult[] | PostLockResult | null,
		);

		if (!result?.id) {
			return Response.json({ message: "Post lock was not updated." }, { status: 500 });
		}

		return Response.json({
			post: {
				id: result.id,
				status: result.status,
				updatedAt: result.updated_at,
			},
		});
	} catch (error) {
		return adminErrorResponse(error);
	}
}
