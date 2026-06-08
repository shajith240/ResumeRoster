import { areCommunityPostsEnabled } from "@/lib/community";
import { cleanCommunityText } from "@/lib/community-validation";
import type { CommunityVoteReaction } from "@/lib/supabase/types";

export type CommunityRouteContext = {
	params: Promise<{ id: string }>;
};

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function communityFeatureResponse() {
	if (areCommunityPostsEnabled()) return null;
	return Response.json(
		{ message: "Community posting is not enabled." },
		{ status: 404 },
	);
}

export function isUuid(value: string) {
	return UUID_PATTERN.test(value);
}

export async function getCommunityRouteId(context: CommunityRouteContext) {
	const { id } = await context.params;
	return id;
}

export async function readCommunityJsonBody(request: Request) {
	try {
		return (await request.json()) as Record<string, unknown>;
	} catch {
		return null;
	}
}

export function normalizeVoteReaction(value: unknown) {
	if (value === null) return null;

	const reaction = cleanCommunityText(value).toLowerCase();
	if (!reaction || reaction === "none") return null;
	if (reaction === "upvote" || reaction === "downvote") {
		return reaction as CommunityVoteReaction;
	}

	return undefined;
}

export function firstRpcRow<T>(data: T[] | T | null | undefined) {
	if (Array.isArray(data)) return data[0] ?? null;
	return data ?? null;
}

export function communityRpcErrorResponse(
	error: { message?: string } | null | undefined,
	fallbackMessage = "Community action failed. Please try again.",
) {
	const message = error?.message ?? "";
	const publicMessage = getPublicRpcMessage(message, fallbackMessage);
	const status = getRpcStatus(message);

	return Response.json({ message: publicMessage }, { status });
}

function getPublicRpcMessage(message: string, fallbackMessage: string) {
	if (/own post/i.test(message)) return "You cannot vote on your own post.";
	if (/own comment/i.test(message)) return "You cannot vote on your own comment.";
	if (/author can edit this post/i.test(message)) return "Only the author can edit this post.";
	if (/author can delete this post/i.test(message)) return "Only the author can delete this post.";
	if (/author can edit this comment/i.test(message)) return "Only the author can edit this comment.";
	if (/author can delete this comment/i.test(message)) return "Only the author can delete this comment.";
	if (/titles between/i.test(message)) return "Keep titles between 8 and 300 characters.";
	if (/post bodies/i.test(message)) return "Keep post bodies under 12000 characters.";
	if (/comments between/i.test(message)) return "Keep comments between 2 and 6000 characters.";
	if (/poll options must be unique/i.test(message)) return "Poll options must be unique.";
	if (/poll options/i.test(message)) return "Check the poll options and try again.";
	if (/poll option/i.test(message)) return "Choose a valid poll option.";
	if (/poll duration/i.test(message)) return "Choose a valid poll duration.";
	if (/poll is closed|poll closed/i.test(message)) return "This poll is closed.";
	if (/poll_id.*ambiguous|option_id.*ambiguous/i.test(message)) {
		return "Poll voting needs the latest database migration.";
	}
	if (/post_id.*ambiguous|comment_id.*ambiguous/i.test(message)) {
		return "Community voting needs the latest database migration.";
	}
	if (/valid vote/i.test(message)) return "Choose a valid vote.";
	if (/not available/i.test(message)) return "This community item is not available.";
	if (/service role|moderation/i.test(message)) return fallbackMessage;
	return fallbackMessage;
}

function getRpcStatus(message: string) {
	if (/own|author/i.test(message)) return 403;
	if (/not available|does not exist|not found/i.test(message)) return 404;
	if (/service role|moderation/i.test(message)) return 500;
	return 400;
}
