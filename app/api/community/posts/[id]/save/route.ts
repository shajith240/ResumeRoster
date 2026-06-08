import {
	communityFeatureResponse,
	getCommunityRouteId,
	isUuid,
	readCommunityJsonBody,
	type CommunityRouteContext,
} from "@/lib/server/community-actions";
import { enforceApiRateLimit } from "@/lib/server/rate-limit";
import { requireSignedInUser, serverAuthErrorResponse } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SavePostResponse = {
	message?: string;
	saveCount?: number;
	saved?: boolean;
};

function normalizeSaved(value: unknown) {
	return typeof value === "boolean" ? value : null;
}

export async function POST(
	request: Request,
	context: CommunityRouteContext,
): Promise<Response> {
	const disabled = communityFeatureResponse();
	if (disabled) return disabled;

	try {
		const postId = await getCommunityRouteId(context);
		if (!isUuid(postId)) {
			return Response.json({ message: "Post not found." }, { status: 404 });
		}

		const payload = await readCommunityJsonBody(request);
		if (!payload) {
			return Response.json({ message: "Submit the save action as JSON." }, { status: 400 });
		}

		const shouldSave = normalizeSaved(payload.saved);
		if (shouldSave === null) {
			return Response.json({ message: "Choose whether to save this post." }, { status: 400 });
		}

		const { admin, user } = await requireSignedInUser(request);
		const rateLimitResponse = await enforceApiRateLimit(
			admin,
			user.id,
			"communityVoteWrite",
		);
		if (rateLimitResponse) return rateLimitResponse;

		await admin
			.from("profiles")
			.upsert({ id: user.id }, { ignoreDuplicates: true, onConflict: "id" });

		const { data: post, error: postError } = await admin
			.from("community_posts")
			.select("id,status")
			.eq("id", postId)
			.maybeSingle();

		if (postError) {
			return Response.json(
				{ message: "Could not update saved posts." },
				{ status: 500 },
			);
		}

		if (!post || !["active", "locked"].includes(String(post.status))) {
			return Response.json({ message: "This community post is not available." }, { status: 404 });
		}

		if (shouldSave) {
			const { error } = await admin
				.from("community_post_saves")
				.upsert(
					{ post_id: postId, user_id: user.id },
					{ onConflict: "post_id,user_id" },
				);

			if (error) {
				return Response.json(
					{ message: "Could not update saved posts." } satisfies SavePostResponse,
					{ status: 500 },
				);
			}
		} else {
			const { error } = await admin
				.from("community_post_saves")
				.delete()
				.eq("post_id", postId)
				.eq("user_id", user.id);

			if (error) {
				return Response.json(
					{ message: "Could not update saved posts." } satisfies SavePostResponse,
					{ status: 500 },
				);
			}
		}

		const { data: countRow } = await admin
			.from("community_posts")
			.select("save_count")
			.eq("id", postId)
			.maybeSingle();

		return Response.json({
			saveCount:
				typeof countRow?.save_count === "number" ? countRow.save_count : undefined,
			saved: shouldSave,
		} satisfies SavePostResponse);
	} catch (error) {
		return serverAuthErrorResponse(error);
	}
}
