import { NextResponse } from "next/server";
import {
	buildMentionSuggestion,
	normalizeMentionHandle,
	type MentionSuggestion,
} from "@/lib/comment-mentions";
import { requireSignedInUser, serverAuthErrorResponse } from "@/lib/server-auth";
import { enforceApiRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MentionProfileRow = {
	avatar_url?: string | null;
	community_role?: string | null;
	current_position?: string | null;
	full_name?: string | null;
	helpful_votes?: number | null;
	id: string;
	reviewer_headline?: string | null;
	roast_count?: number | null;
	username?: string | null;
};

type MentionLookupBody = {
	handles?: unknown;
	limit?: unknown;
};

const DEFAULT_SEARCH_LIMIT = 8;
const DEFAULT_LOOKUP_LIMIT = 60;
const MAX_SEARCH_LIMIT = 12;
const MAX_LOOKUP_LIMIT = 120;
const MAX_QUERY_LENGTH = 64;

function jsonResponse(message: string, status = 400) {
	return NextResponse.json({ message }, { status });
}

function boundedLimit(
	value: string | number | null | undefined,
	fallback: number,
	max: number,
) {
	const parsed = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.min(Math.max(Math.trunc(parsed), 1), max);
}

function cleanSearchQuery(value: string | null) {
	return (value ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
}

function getProfileSubtitle(profile: MentionProfileRow) {
	return (
		profile.reviewer_headline?.trim() ||
		profile.current_position?.trim() ||
		profile.community_role?.replace(/_/g, " ") ||
		null
	);
}

function toMentionSuggestions(rows: MentionProfileRow[]) {
	return rows.map((profile) =>
		buildMentionSuggestion(profile.id, profile, getProfileSubtitle(profile)),
	);
}

function sanitizeHandleList(handles: unknown) {
	const rawHandles = Array.isArray(handles)
		? handles
		: typeof handles === "string"
			? handles.split(",")
			: [];
	const seen = new Set<string>();
	const sanitized: string[] = [];

	for (const rawHandle of rawHandles) {
		if (typeof rawHandle !== "string") continue;
		const handle = normalizeMentionHandle(rawHandle);
		const key = handle.toLowerCase();
		if (!key || seen.has(key)) continue;

		seen.add(key);
		sanitized.push(handle);
		if (sanitized.length >= MAX_LOOKUP_LIMIT) break;
	}

	return sanitized;
}

async function checkSearchQuota(request: Request) {
	const signedIn = await requireSignedInUser(request);
	const rateLimitResponse = await enforceApiRateLimit(
		signedIn.admin,
		signedIn.user.id,
		"mentionSearch",
	);

	return {
		rateLimitResponse,
		...signedIn,
	};
}

export async function GET(request: Request) {
	try {
		const { admin, rateLimitResponse, user } = await checkSearchQuota(request);
		if (rateLimitResponse) return rateLimitResponse;

		const url = new URL(request.url);
		const query = cleanSearchQuery(url.searchParams.get("query"));
		if (!query) {
			return NextResponse.json({ suggestions: [] satisfies MentionSuggestion[] });
		}

		const limit = boundedLimit(
			url.searchParams.get("limit"),
			DEFAULT_SEARCH_LIMIT,
			MAX_SEARCH_LIMIT,
		);
		const { data, error } = await admin.rpc("search_mentionable_profiles", {
			excluded_user_id: user.id,
			result_limit: limit,
			search_query: query,
		});

		if (error) {
			return jsonResponse("Mention search is unavailable.", 503);
		}

		return NextResponse.json({
			suggestions: toMentionSuggestions((data ?? []) as MentionProfileRow[]),
		});
	} catch (error) {
		return serverAuthErrorResponse(error);
	}
}

export async function POST(request: Request) {
	try {
		const { admin, rateLimitResponse } = await checkSearchQuota(request);
		if (rateLimitResponse) return rateLimitResponse;

		let payload: MentionLookupBody | null = null;
		try {
			payload = (await request.json()) as MentionLookupBody;
		} catch {
			return jsonResponse("Submit mention handles as JSON.");
		}

		const handles = sanitizeHandleList(payload?.handles);
		if (!handles.length) {
			return NextResponse.json({ suggestions: [] satisfies MentionSuggestion[] });
		}

		const limit = boundedLimit(
			typeof payload?.limit === "number" ? payload.limit : null,
			DEFAULT_LOOKUP_LIMIT,
			MAX_LOOKUP_LIMIT,
		);
		const { data, error } = await admin.rpc(
			"lookup_mentionable_profiles_by_handles",
			{
				mention_handles: handles,
				result_limit: limit,
			},
		);

		if (error) {
			return jsonResponse("Mention lookup is unavailable.", 503);
		}

		return NextResponse.json({
			suggestions: toMentionSuggestions((data ?? []) as MentionProfileRow[]),
		});
	} catch (error) {
		return serverAuthErrorResponse(error);
	}
}
