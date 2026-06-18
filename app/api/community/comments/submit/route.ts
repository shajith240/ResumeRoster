import { NextResponse } from "next/server";
import { areCommunityPostsEnabled } from "@/lib/community";
import { cleanCommunityText } from "@/lib/community-validation";
import { enforceApiRateLimit } from "@/lib/server/rate-limit";
import { requireSignedInUser, serverAuthErrorResponse } from "@/lib/server-auth";
import type { CommunityCommentStatus } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CommunityCommentSubmitBody = {
	attachmentId?: unknown;
	body?: unknown;
	parentId?: unknown;
	postId?: unknown;
};

type SubmitCommunityCommentResult = {
	id?: string;
	status?: CommunityCommentStatus;
};

function jsonResponse(message: string, status = 400) {
	return NextResponse.json({ message }, { status });
}

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function readJsonBody(request: Request) {
	try {
		return (await request.json()) as CommunityCommentSubmitBody;
	} catch {
		return null;
	}
}

function getCommentIssue({
	attachmentId,
	body,
	postId,
}: {
	attachmentId: string | null;
	body: string;
	postId: string;
}) {
	if (!postId) return "Choose a post.";
	if (!body) return "Write a comment.";
	if (body.length < 2) return "Write at least 2 characters.";
	if (body.length > 6000) return "Keep comments under 6000 characters.";
	if (attachmentId && !UUID_PATTERN.test(attachmentId)) {
		return "Choose a valid image.";
	}
	return "";
}

function getPublicRpcError(message: string) {
	if (/attachment|image|media/i.test(message)) return "Choose a valid image.";
	if (/deep|depth/i.test(message)) return "This thread is too deep for more replies.";
	if (/comment/i.test(message)) return "This post is not open for comments.";
	if (/parent/i.test(message)) return "Choose an active parent comment.";
	if (/rate|too many/i.test(message)) return "Too many community comments. Try again soon.";
	return "We could not add this comment. Please try again.";
}

export async function POST(request: Request) {
	if (!areCommunityPostsEnabled()) {
		return jsonResponse("Community posting is not enabled.", 404);
	}

	let signedIn: Awaited<ReturnType<typeof requireSignedInUser>>;
	try {
		signedIn = await requireSignedInUser(request, {
			missingTokenMessage: "Sign in again before commenting.",
			setupMessage: "Server community setup is missing.",
		});
	} catch (error) {
		return serverAuthErrorResponse(error);
	}
	const { admin, user } = signedIn;

	const payload = await readJsonBody(request);
	if (!payload) {
		return jsonResponse("Submit the comment as JSON.");
	}

	const body = cleanCommunityText(payload.body);
	const postId = cleanCommunityText(payload.postId);
	const parentId = cleanCommunityText(payload.parentId) || null;
	const attachmentId = cleanCommunityText(payload.attachmentId) || null;
	const issue = getCommentIssue({ attachmentId, body, postId });

	if (issue) {
		return jsonResponse(issue);
	}

	const rateLimitResponse = await enforceApiRateLimit(
		admin,
		user.id,
		"communityCommentSubmit",
	);
	if (rateLimitResponse) return rateLimitResponse;

	const submitComment = await admin.rpc("submit_community_comment", {
		comment_attachment_id: attachmentId,
		comment_body: body,
		parent_comment_id: parentId,
		target_post_id: postId,
		target_user_id: user.id,
	});

	if (submitComment.error) {
		return jsonResponse(getPublicRpcError(submitComment.error.message), 400);
	}

	const row = Array.isArray(submitComment.data)
		? submitComment.data[0]
		: submitComment.data;
	const comment = row as SubmitCommunityCommentResult | null;

	if (!comment?.id) {
		return jsonResponse("We could not add this comment. Please try again.", 500);
	}

	return NextResponse.json({ id: comment.id, status: comment.status ?? "active" });
}
