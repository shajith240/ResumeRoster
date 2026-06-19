import { unstable_cache } from "next/cache";
import {
	bestReviewMap,
	enhanceReviewer,
	sortReviewers,
} from "@/lib/leaderboard-ranking";
import { createServiceSupabaseClient } from "@/lib/server-auth";
import type {
	ReviewerLeaderboardEntry,
	ReviewerProfileStats,
} from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TimeRange = "week" | "month" | "all";

const LEADERBOARD_LIMIT = 100;
const DIRECTORY_LIMIT = 500;
const TOP_REVIEW_FETCH_LIMIT = 2000;

const PROFILE_SELECT =
	"id,username,full_name,avatar_url,avatar_path,college,target_role,current_position,community_role,reviewer_type,reviewer_headline,reviewer_expertise,reviewer_verification_status,roast_count,helpful_votes";
const PROFILE_FALLBACK_SELECT =
	"id,username,college,target_role,current_position,roast_count,helpful_votes";
const REVIEW_SELECT = "id,resume_id,author_id,content,helpful_votes,created_at";

function isMissingSoftDeleteColumn(message: string) {
	return /is_deleted|schema cache|column/i.test(message);
}

function isMissingProfileMetadataColumn(message: string) {
	return /full_name|avatar_url|avatar_path|community_role|reviewer_|schema cache|column/i.test(
		message,
	);
}

function isMissingReviewerLeaderboardRpc(message: string) {
	return /get_reviewer_leaderboard|schema cache|function/i.test(message);
}

function isMissingReviewerLeaderboardSinceRpc(message: string) {
	return /get_reviewer_leaderboard_since|schema cache|function/i.test(message);
}

function getRangeStart(range: TimeRange): string | null {
	if (range === "all") return null;
	const date = new Date();
	date.setDate(date.getDate() - (range === "week" ? 7 : 30));
	return date.toISOString();
}

function normalizeLeaderboardEntry(
	row: ReviewerProfileStats | ReviewerLeaderboardEntry,
): ReviewerProfileStats {
	const entry = row as ReviewerProfileStats & Partial<ReviewerLeaderboardEntry>;
	return {
		...entry,
		roast_count: entry.roast_count ?? entry.review_count ?? 0,
		helpful_votes:
			typeof entry.helpful_votes === "number"
				? entry.helpful_votes
				: (entry.lint_points ?? 0),
	};
}

function normalizeProfileStats(p: ReviewerProfileStats): ReviewerProfileStats {
	return { ...p, helpful_votes: p.helpful_votes ?? 0, roast_count: p.roast_count ?? 0 };
}

function mergeProfileMetadata(
	reviewer: ReviewerProfileStats,
	profile?: ReviewerProfileStats,
): ReviewerProfileStats {
	if (!profile) return reviewer;
	return {
		...reviewer,
		full_name: profile.full_name ?? reviewer.full_name ?? null,
		avatar_url: profile.avatar_url ?? reviewer.avatar_url ?? null,
		avatar_path: profile.avatar_path ?? reviewer.avatar_path ?? null,
		community_role: profile.community_role ?? reviewer.community_role ?? null,
		current_position: profile.current_position ?? reviewer.current_position ?? null,
		username: profile.username ?? reviewer.username,
		college: profile.college ?? reviewer.college,
		reviewer_expertise: profile.reviewer_expertise ?? reviewer.reviewer_expertise ?? null,
		reviewer_headline: profile.reviewer_headline ?? reviewer.reviewer_headline ?? null,
		reviewer_type: profile.reviewer_type ?? reviewer.reviewer_type ?? null,
		reviewer_verification_status:
			profile.reviewer_verification_status ??
			reviewer.reviewer_verification_status ??
			null,
		target_role: profile.target_role ?? reviewer.target_role,
	};
}

type ReviewRow = {
	id: string;
	resume_id: string;
	author_id: string;
	content: string;
	helpful_votes: number;
	created_at: string;
};

type LeaderboardResult = {
	message: string;
	reviewers: ReviewerProfileStats[];
};

async function fetchReviewRows(
	supabase: ReturnType<typeof createServiceSupabaseClient>,
	{ authorIds, since }: { authorIds?: string[]; since?: string },
) {
	async function run(filterDeleted: boolean) {
		let query = supabase.from("roasts").select(REVIEW_SELECT);
		if (filterDeleted) query = query.eq("is_deleted", false);
		if (since) query = query.gte("created_at", since);
		if (authorIds?.length) query = query.in("author_id", authorIds);
		return query
			.order("helpful_votes", { ascending: false })
			.order("created_at", { ascending: false })
			.limit(TOP_REVIEW_FETCH_LIMIT);
	}

	const result = await run(true);
	if (result.error && isMissingSoftDeleteColumn(result.error.message)) {
		return run(false);
	}
	return result;
}

async function fetchProfilesById(
	supabase: ReturnType<typeof createServiceSupabaseClient>,
	authorIds: string[],
): Promise<{ profiles: ReviewerProfileStats[]; errorMessage: string }> {
	if (!authorIds.length) return { profiles: [], errorMessage: "" };

	const result = await supabase.from("profiles").select(PROFILE_SELECT).in("id", authorIds);
	if (!result.error) {
		return { profiles: (result.data ?? []) as ReviewerProfileStats[], errorMessage: "" };
	}

	if (!isMissingProfileMetadataColumn(result.error.message)) {
		return { profiles: [], errorMessage: result.error.message };
	}

	const fallback = await supabase
		.from("profiles")
		.select(PROFILE_FALLBACK_SELECT)
		.in("id", authorIds);
	return {
		profiles: (fallback.data ?? []) as ReviewerProfileStats[],
		errorMessage: fallback.error?.message ?? "",
	};
}

async function enrichLeaderboardReviewers(
	supabase: ReturnType<typeof createServiceSupabaseClient>,
	baseReviewers: ReviewerProfileStats[],
	since?: string,
): Promise<LeaderboardResult> {
	const authorIds = baseReviewers.map((r) => r.id);
	const { profiles, errorMessage } = await fetchProfilesById(supabase, authorIds);
	const profilesById = Object.fromEntries(profiles.map((p) => [p.id, p]));

	let topReviews: Record<string, ReviewRow> = {};
	if (authorIds.length) {
		const { data } = await fetchReviewRows(supabase, { authorIds, since });
		topReviews = bestReviewMap((data ?? []) as ReviewRow[]);
	}

	const merged = baseReviewers.map((r) => mergeProfileMetadata(r, profilesById[r.id]));
	return {
		message: errorMessage,
		reviewers: sortReviewers(
			merged.map((r) => enhanceReviewer(r, topReviews[r.id])),
		).slice(0, LEADERBOARD_LIMIT),
	};
}

async function queryLeaderboardData(range: TimeRange): Promise<LeaderboardResult> {
	const supabase = createServiceSupabaseClient();
	const since = getRangeStart(range) ?? undefined;

	if (since) {
		const sinceResult = await supabase.rpc("get_reviewer_leaderboard_since", {
			limit_count: LEADERBOARD_LIMIT,
			since_at: since,
		});

		if (!sinceResult.error) {
			return enrichLeaderboardReviewers(
				supabase,
				(
					(sinceResult.data ?? []) as Array<
						ReviewerProfileStats | ReviewerLeaderboardEntry
					>
				).map(normalizeLeaderboardEntry),
				since,
			);
		}

		if (!isMissingReviewerLeaderboardSinceRpc(sinceResult.error.message)) {
			return { message: "Leaderboard data is temporarily unavailable.", reviewers: [] };
		}

		// RPC missing — fall back to direct review query
		const { data: periodReviews, error: reviewError } = await fetchReviewRows(supabase, {
			since,
		});
		if (reviewError) return { message: reviewError.message, reviewers: [] };

		const reviewRows = (periodReviews ?? []) as ReviewRow[];
		const authorIds = Array.from(new Set(reviewRows.map((r) => r.author_id)));
		if (!authorIds.length) return { message: "", reviewers: [] };

		const { profiles, errorMessage } = await fetchProfilesById(supabase, authorIds);
		if (errorMessage) return { message: errorMessage, reviewers: [] };

		const stats = reviewRows.reduce<Record<string, { helpfulVotes: number; reviewCount: number }>>(
			(map, review) => {
				map[review.author_id] ??= { helpfulVotes: 0, reviewCount: 0 };
				map[review.author_id].helpfulVotes += review.helpful_votes;
				map[review.author_id].reviewCount += 1;
				return map;
			},
			{},
		);
		const topReviews = bestReviewMap(reviewRows);

		return {
			message: "",
			reviewers: sortReviewers(
				profiles.map((p) => enhanceReviewer(p, topReviews[p.id], stats[p.id])),
			).slice(0, LEADERBOARD_LIMIT),
		};
	}

	// All-time leaderboard
	const allResult = await supabase.rpc("get_reviewer_leaderboard", {
		limit_count: LEADERBOARD_LIMIT,
	});
	const { data, error } =
		allResult.error && isMissingReviewerLeaderboardRpc(allResult.error.message)
			? await supabase.rpc("get_roaster_leaderboard", { limit_count: LEADERBOARD_LIMIT })
			: allResult;

	if (error) return { message: "Leaderboard data is temporarily unavailable.", reviewers: [] };

	return enrichLeaderboardReviewers(
		supabase,
		(
			(data ?? []) as Array<ReviewerProfileStats | ReviewerLeaderboardEntry>
		).map(normalizeLeaderboardEntry),
	);
}

async function queryDirectory(): Promise<LeaderboardResult> {
	const supabase = createServiceSupabaseClient();

	const result = await supabase
		.from("profiles")
		.select(PROFILE_SELECT)
		.order("helpful_votes", { ascending: false })
		.order("roast_count", { ascending: false })
		.order("username", { ascending: true })
		.limit(DIRECTORY_LIMIT);

	let profiles: ReviewerProfileStats[];

	if (result.error) {
		if (!isMissingProfileMetadataColumn(result.error.message)) {
			return { message: result.error.message, reviewers: [] };
		}
		const fallback = await supabase
			.from("profiles")
			.select(PROFILE_FALLBACK_SELECT)
			.order("helpful_votes", { ascending: false })
			.order("roast_count", { ascending: false })
			.order("username", { ascending: true })
			.limit(DIRECTORY_LIMIT);
		if (fallback.error) {
			return { message: "Leaderboard data is temporarily unavailable.", reviewers: [] };
		}
		profiles = ((fallback.data ?? []) as ReviewerProfileStats[]).map(normalizeProfileStats);
	} else {
		profiles = ((result.data ?? []) as ReviewerProfileStats[]).map(normalizeProfileStats);
	}

	const authorIds = profiles.map((p) => p.id);
	let topReviews: Record<string, ReviewRow> = {};
	if (authorIds.length) {
		const { data } = await fetchReviewRows(supabase, { authorIds });
		topReviews = bestReviewMap((data ?? []) as ReviewRow[]);
	}

	return {
		message: "",
		reviewers: sortReviewers(profiles.map((p) => enhanceReviewer(p, topReviews[p.id]))),
	};
}

// 1-hour cache per range, shared tag so revalidateTag('leaderboard') clears all
const getCachedLeaderboard = unstable_cache(
	queryLeaderboardData,
	["leaderboard"],
	{ revalidate: 3600, tags: ["leaderboard"] },
);

const getCachedDirectory = unstable_cache(
	queryDirectory,
	["leaderboard-directory"],
	{ revalidate: 3600, tags: ["leaderboard"] },
);

export async function GET(request: Request) {
	const url = new URL(request.url);
	const rawRange = url.searchParams.get("range") ?? "month";
	const range: TimeRange =
		rawRange === "week" || rawRange === "month" || rawRange === "all"
			? rawRange
			: "month";

	const [leaderboard, directory] = await Promise.all([
		getCachedLeaderboard(range),
		getCachedDirectory(),
	]);

	return Response.json({ leaderboard, directory });
}
