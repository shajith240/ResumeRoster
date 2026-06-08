import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { areCommunityPostsEnabled } from "@/lib/community";
import { cleanCommunityText } from "@/lib/community-validation";
import { enforceApiRateLimit } from "@/lib/server/rate-limit";
import type { CommunityCommentStatus } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CommunityCommentSubmitBody = {
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

function getBearerToken(request: Request) {
	const authorization = request.headers.get("authorization") ?? "";
	const [scheme, token] = authorization.split(/\s+/);
	return /^bearer$/i.test(scheme) && token ? token : "";
}

async function readJsonBody(request: Request) {
	try {
		return (await request.json()) as CommunityCommentSubmitBody;
	} catch {
		return null;
	}
}

function getCommentIssue({
	body,
	postId,
}: {
	body: string;
	postId: string;
}) {
	if (!postId) return "Choose a post.";
	if (!body) return "Write a comment.";
	if (body.length < 2) return "Write at least 2 characters.";
	if (body.length > 6000) return "Keep comments under 6000 characters.";
	return "";
}

function getPublicRpcError(message: string) {
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

	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!supabaseUrl || !serviceRoleKey) {
		return jsonResponse("Server community setup is missing.", 503);
	}

	const token = getBearerToken(request);
	if (!token) {
		return jsonResponse("Sign in again before commenting.", 401);
	}

	const admin = createClient(supabaseUrl, serviceRoleKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	});

	const {
		data: { user },
		error: userError,
	} = await admin.auth.getUser(token);

	if (userError || !user) {
		return jsonResponse("Your session expired. Sign in again.", 401);
	}

	const payload = await readJsonBody(request);
	if (!payload) {
		return jsonResponse("Submit the comment as JSON.");
	}

	const body = cleanCommunityText(payload.body);
	const postId = cleanCommunityText(payload.postId);
	const parentId = cleanCommunityText(payload.parentId) || null;
	const issue = getCommentIssue({ body, postId });

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
