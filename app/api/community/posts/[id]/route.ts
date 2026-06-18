import {
	COMMUNITY_POST_BODY_MAX_LENGTH,
	COMMUNITY_POST_TITLE_MAX_LENGTH,
	COMMUNITY_POST_TITLE_MIN_LENGTH,
	cleanCommunityText,
} from "@/lib/community-validation";
import { normalizeCommunityMarkdown } from "@/lib/community-markdown";
import { isAdminEmail } from "@/lib/admin";
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
	community_post_media_paths?: string[] | null;
	deleted_at: string | null;
	id: string;
};

type DeleteTargetPost = {
	author_id: string;
	id: string;
	status: CommunityPostStatus;
};

function uniqueStoragePaths(paths: Array<string | null | undefined>) {
	return Array.from(
		new Set(paths.map((path) => path?.trim()).filter(Boolean) as string[]),
	);
}

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
		const body = normalizeCommunityMarkdown(cleanCommunityText(payload.body));
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
		const requestingUserIsAdmin = isAdminEmail(user.email);

		const { data: targetPost, error: targetPostError } = await admin
			.from("community_posts")
			.select("id,author_id,status")
			.eq("id", postId)
			.maybeSingle();

		if (targetPostError) {
			return Response.json({ message: "Post was not deleted." }, { status: 500 });
		}

		const post = targetPost as DeleteTargetPost | null;
		if (!post?.id) {
			return Response.json({ message: "Post not found." }, { status: 404 });
		}

		if (post.author_id !== user.id && !requestingUserIsAdmin) {
			return Response.json(
				{ message: "Only the post author or an admin can delete this post." },
				{ status: 403 },
			);
		}

		const rpcResult = await admin.rpc("hard_delete_community_post", {
			requesting_user_is_admin: requestingUserIsAdmin,
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

		const storagePaths = uniqueStoragePaths(
			result.community_post_media_paths ?? [],
		);
		let mediaCleanupFailed = false;
		if (storagePaths.length) {
			const { error: storageError } = await admin.storage
				.from("community-post-media")
				.remove(storagePaths);

			if (storageError) {
				mediaCleanupFailed = true;
				console.error("Community post media cleanup failed after delete", {
					message: storageError.message,
					postId,
					storagePathCount: storagePaths.length,
				});
			}
		}

		return Response.json({
			mediaCleanupFailed,
			post: {
				deletedAt: result.deleted_at,
				id: result.id,
				status: "deleted",
			},
		});
	} catch (error) {
		return serverAuthErrorResponse(error);
	}
}
