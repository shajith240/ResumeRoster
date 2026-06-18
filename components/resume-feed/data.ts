import {
	formatCount,
	mergeReviewCountsFromRows,
	withResumeDefaults,
	type FeedSort,
} from "@/lib/feed-ranking";
import {
	getSavedResumeIds,
	isSavedResumeSchemaMissingError,
	type SavedResumeReference,
} from "@/lib/saved-resumes";
import { loadOnlineProfileIds } from "@/lib/online-presence";
import { supabase } from "@/lib/supabase/client";
import type { ResumeAuthorProfile, ResumeSummary } from "@/lib/supabase/types";

export type SavedResumeSummary = ResumeSummary & {
	is_saved: boolean;
};

export type ReviewSignal = {
	className: "closed" | "hot" | "needs" | "open";
	label: string;
};

export type ReviewPreviewRow = {
	id: string;
	resume_id: string;
	parent_id?: string | null;
	content: string;
	attachment_id?: string | null;
	content_format?: string | null;
	sticker_id?: string | null;
	helpful_votes: number;
	is_deleted?: boolean;
	created_at: string;
};

export type ReviewPreview = {
	id: string;
	excerpt: string;
	label: string;
};

export const FEED_PREVIEW_SIGNED_URL_TTL_SECONDS = 60 * 20;
export const RESUME_SELECT_WITH_CONTEXT =
	"id,user_id,title,file_path,is_anonymous,status,review_queue_status,activation_reviews_required,activation_reviews_completed,roast_count,read_count,job_description,post_description,is_premium,created_at";
export const RESUME_SELECT_WITH_READS =
	"id,user_id,title,file_path,is_anonymous,status,roast_count,read_count,is_premium,created_at";
export const RESUME_SELECT_BASE =
	"id,user_id,title,file_path,is_anonymous,status,roast_count,is_premium,created_at";
export const REVIEW_PREVIEW_SELECT_WITH_THREADS =
	"id,resume_id,parent_id,content,attachment_id,content_format,sticker_id,helpful_votes,is_deleted,created_at";
export const REVIEW_PREVIEW_SELECT_BASE =
	"id,resume_id,content,helpful_votes,created_at";

const AUTHOR_PROFILE_SELECT_WITH_STATUS =
	"id,username,full_name,avatar_url,avatar_path,college,target_role,current_position,app_status";
const AUTHOR_PROFILE_SELECT_BASE =
	"id,username,full_name,avatar_url,college,target_role";
const ACTIONABLE_REVIEW_PATTERN =
	/\b(add|avoid|change|clarify|cut|drop|explain|fix|highlight|include|impact|improve|mention|metrics|move|proof|quantify|reduce|remove|replace|rewrite|show|shorten|specific|specify|tighten|use|vague|write)\b/i;
const GENERIC_REVIEW_PATTERN =
	/^(good|nice|great|ok|okay|cool|done|fine|thanks|thank you|looks good|good resume|good resume man|reviewed)$/i;

export const sortOptions: Array<{
	href: string;
	label: string;
	shortLabel?: string;
	value: FeedSort;
}> = [
	{ href: "/feed", label: "Best", value: "best" },
	{ href: "/feed?sort=new", label: "New", value: "new" },
	{ href: "/feed?sort=top", label: "Top rated", shortLabel: "Top", value: "top" },
	{
		href: "/feed?sort=needs",
		label: "Needs review",
		shortLabel: "Needs",
		value: "needs",
	},
];

export function formatDate(value: string) {
	return new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
	}).format(new Date(value));
}

export function getReviewSignal(resume: ResumeSummary): ReviewSignal {
	if (resume.status === "closed") {
		return { className: "closed", label: "Closed" };
	}

	if (resume.review_queue_status === "waiting") {
		return { className: "needs", label: "Waiting for reviews" };
	}

	if (resume.roast_count === 0) {
		return { className: "needs", label: "Needs first review" };
	}

	if (resume.roast_count > 5) {
		return { className: "hot", label: "Active discussion" };
	}

	return { className: "open", label: "Open for review" };
}

export function getThreadPrompt(resume: ResumeSummary) {
	if (resume.review_queue_status === "waiting") {
		const remaining = Math.max(
			resume.activation_reviews_required - resume.activation_reviews_completed,
			0,
		);

		return remaining > 0
			? `${remaining} guided ${remaining === 1 ? "review" : "reviews"} will activate this resume in the queue.`
			: "This resume is ready to move into the active review queue.";
	}

	if (resume.roast_count > 0) {
		const commentLabel =
			resume.roast_count === 1
				? "1 comment is"
				: `${formatCount(resume.roast_count)} comments are`;

		return `${commentLabel} in the thread. Open it to read the feedback.`;
	}

	if (resume.status === "closed") {
		return "This thread is closed, but the feedback is still useful to study.";
	}

	return "No reviews yet. Be the first to lint this resume.";
}

export function getThreadActionLabel(resume: ResumeSummary) {
	if (resume.roast_count === 0) {
		return resume.status === "closed" ? "Thread" : "Review";
	}

	if (resume.roast_count > 5) {
		return "Fixes";
	}

	return resume.roast_count === 1 ? "Comment" : "Comments";
}

export function getThreadActionAria(resume: ResumeSummary) {
	if (resume.roast_count === 0) {
		return resume.status === "closed"
			? `Open closed thread for ${resume.title}`
			: `Review ${resume.title}`;
	}

	return `Open ${resume.roast_count} comments for ${resume.title}`;
}

function cleanReviewExcerpt(content: string) {
	const normalized = content
		.replace(/!\[[^\]]*]\([^)]+\)/g, "")
		.replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
		.replace(/\s+/g, " ")
		.trim();

	if (normalized.length <= 170) return normalized;

	return `${normalized.slice(0, 167).trim()}...`;
}

function isFeatureWorthyReview(excerpt: string) {
	const words = excerpt.match(/[a-z0-9]+/gi) ?? [];
	const normalized = excerpt
		.toLowerCase()
		.replace(/[^\w\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim();

	if (GENERIC_REVIEW_PATTERN.test(normalized)) return false;

	return (
		(words.length >= 4 &&
			excerpt.length >= 24 &&
			ACTIONABLE_REVIEW_PATTERN.test(excerpt)) ||
		(words.length >= 8 && excerpt.length >= 42)
	);
}

function getReviewPreview(row: ReviewPreviewRow): ReviewPreview | null {
	const hasMediaHint =
		Boolean(row.attachment_id) ||
		Boolean(row.sticker_id) ||
		/!\[[^\]]*]\([^)]+\)/.test(row.content);
	const excerpt = cleanReviewExcerpt(row.content);

	if (excerpt && isFeatureWorthyReview(excerpt)) {
		return {
			id: row.id,
			excerpt,
			label: hasMediaHint ? "Media note" : "Recent fix",
		};
	}

	if (hasMediaHint) {
		return {
			id: row.id,
			excerpt:
				"A reviewer added a media note. Open the thread to inspect the visual feedback.",
			label: "Media note",
		};
	}

	return null;
}

export function getReviewPreviewsByResumeId(rows: ReviewPreviewRow[]) {
	const previews = new Map<string, ReviewPreview>();
	const sortedRows = [...rows].sort(
		(a, b) =>
			(b.helpful_votes ?? 0) - (a.helpful_votes ?? 0) ||
			new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
	);

	for (const row of sortedRows) {
		if (row.is_deleted || row.parent_id) continue;
		if (previews.has(row.resume_id)) continue;

		const preview = getReviewPreview(row);
		if (!preview) continue;

		previews.set(row.resume_id, preview);
	}

	return Object.fromEntries(previews);
}

export function isReadCountFeatureError(error: { message?: string } | null) {
	return /read_count|schema cache|column/i.test(error?.message ?? "");
}

export function isResumeContextFeatureError(
	error: { message?: string } | null,
) {
	return /activation_reviews_|job_description|post_description|read_count|review_queue_status|schema cache|column/i.test(
		error?.message ?? "",
	);
}

function isAuthorProfileFeatureError(error: { message?: string } | null) {
	return /app_status|current_position|avatar_path|schema cache|column/i.test(
		error?.message ?? "",
	);
}

export function isReviewPreviewFeatureError(
	error: { message?: string } | null,
) {
	return /parent_id|is_deleted|attachment_id|content_format|sticker_id|schema cache|column/i.test(
		error?.message ?? "",
	);
}

export function isDuplicateSavedResumeError(
	error: { code?: string; message?: string } | null,
) {
	return error?.code === "23505" || /duplicate key|unique/i.test(error?.message ?? "");
}

export async function mergeLiveReviewCounts(resumeRows: ResumeSummary[]) {
	if (!resumeRows.length) return resumeRows;

	const activeReviewResult = await supabase
		.from("roasts")
		.select("resume_id")
		.in("resume_id", resumeRows.map((resume) => resume.id))
		.eq("is_deleted", false);

	const { data, error } =
		activeReviewResult.error &&
		/is_deleted|schema cache|column/i.test(activeReviewResult.error.message)
			? await supabase
					.from("roasts")
					.select("resume_id")
					.in("resume_id", resumeRows.map((resume) => resume.id))
			: activeReviewResult;

	if (error) return resumeRows;

	return mergeReviewCountsFromRows(resumeRows, data ?? []);
}

async function fetchPublicAuthorProfiles(resumeRows: ResumeSummary[]) {
	const authorIds = Array.from(
		new Set(
			resumeRows
				.filter((resume) => !resume.is_anonymous)
				.map((resume) => resume.user_id),
		),
	);

	if (!authorIds.length) return new Map<string, ResumeAuthorProfile>();

	const primaryResult = await supabase
		.from("profiles")
		.select(AUTHOR_PROFILE_SELECT_WITH_STATUS)
		.in("id", authorIds);

	let profileRows = (primaryResult.data ?? []) as ResumeAuthorProfile[];
	let profileError = primaryResult.error;

	if (profileError && isAuthorProfileFeatureError(profileError)) {
		const fallbackResult = await supabase
			.from("profiles")
			.select(AUTHOR_PROFILE_SELECT_BASE)
			.in("id", authorIds);

		profileRows = (fallbackResult.data ?? []) as ResumeAuthorProfile[];
		profileError = fallbackResult.error;
	}

	if (profileError) return new Map<string, ResumeAuthorProfile>();

	const onlineProfileIds = await loadOnlineProfileIds(
		profileRows.map((profile) => profile.id),
	);

	return new Map(
		profileRows.map((profile) => [
			profile.id,
			{
				...profile,
				is_online: onlineProfileIds.has(profile.id),
			},
		]),
	);
}

export async function attachPublicAuthorProfiles(resumeRows: ResumeSummary[]) {
	const profilesById = await fetchPublicAuthorProfiles(resumeRows);

	if (!profilesById.size) return resumeRows;

	return resumeRows.map((resume) => ({
		...resume,
		author_profile: resume.is_anonymous
			? null
			: profilesById.get(resume.user_id) ?? null,
	}));
}

export async function fetchSavedResumeIds(userId: string | null) {
	if (!userId) {
		return {
			error: null,
			savedResumeIds: new Set<string>(),
			schemaMissing: false,
		};
	}

	const { data, error } = await supabase
		.from("saved_resumes")
		.select("resume_id")
		.eq("user_id", userId);

	if (error) {
		return {
			error,
			savedResumeIds: new Set<string>(),
			schemaMissing: isSavedResumeSchemaMissingError(error),
		};
	}

	return {
		error: null,
		savedResumeIds: getSavedResumeIds((data ?? []) as SavedResumeReference[]),
		schemaMissing: false,
	};
}

export { withResumeDefaults };

// ─── Pagination ───────────────────────────────────────────────────────────────

export const FEED_PAGE_SIZE = 20;

// ─── Signed-URL sessionStorage cache ─────────────────────────────────────────

type SignedUrlCacheEntry = { url: string; expiresAt: number };
const SIGNED_URL_CACHE_KEY = "linted_signed_urls_v1";
const SIGNED_URL_SAFETY_BUFFER_MS = 120_000; // expire 2 min early

function readSignedUrlCache(): Record<string, SignedUrlCacheEntry> {
	if (typeof window === "undefined") return {};
	try {
		return JSON.parse(sessionStorage.getItem(SIGNED_URL_CACHE_KEY) ?? "{}");
	} catch {
		return {};
	}
}

function writeSignedUrlCache(cache: Record<string, SignedUrlCacheEntry>) {
	if (typeof window === "undefined") return;
	try {
		sessionStorage.setItem(SIGNED_URL_CACHE_KEY, JSON.stringify(cache));
	} catch {
		// ignore quota errors
	}
}

export async function fetchSignedUrlsCached(
	targets: Array<{ id: string; filePath: string }>,
): Promise<Record<string, string>> {
	if (!targets.length) return {};

	const now = Date.now();
	const cache = readSignedUrlCache();
	const result: Record<string, string> = {};
	const stale: typeof targets = [];

	for (const t of targets) {
		const entry = cache[t.id];
		if (entry && entry.expiresAt > now) {
			result[t.id] = entry.url;
		} else {
			stale.push(t);
		}
	}

	if (!stale.length) return result;

	const { data, error } = await supabase.storage
		.from("resumes")
		.createSignedUrls(
			stale.map((t) => t.filePath),
			FEED_PREVIEW_SIGNED_URL_TTL_SECONDS,
		);

	if (error || !data) return result;

	const expiresAt =
		now + FEED_PREVIEW_SIGNED_URL_TTL_SECONDS * 1000 - SIGNED_URL_SAFETY_BUFFER_MS;
	const nextCache = { ...cache };

	stale.forEach((t, i) => {
		const url = data[i]?.signedUrl;
		if (url) {
			result[t.id] = url;
			nextCache[t.id] = { url, expiresAt };
		}
	});

	writeSignedUrlCache(nextCache);
	return result;
}

// ─── Feed query (with schema-fallback chain + pagination) ─────────────────────

export async function fetchFeedResumes(
	sort: FeedSort,
	offset: number,
): Promise<{ rows: ResumeSummary[]; hasMore: boolean; error: Error | null }> {
	const LIMIT = FEED_PAGE_SIZE;
	const isTop = sort === "top";

	// Attempt 1 – full context schema
	const primary = await (isTop
		? supabase
				.from("resumes")
				.select(RESUME_SELECT_WITH_CONTEXT)
				.eq("review_queue_status", "active")
				.range(offset, offset + LIMIT)
				.order("is_premium", { ascending: false })
				.order("roast_count", { ascending: false })
				.order("created_at", { ascending: false })
		: supabase
				.from("resumes")
				.select(RESUME_SELECT_WITH_CONTEXT)
				.eq("review_queue_status", "active")
				.range(offset, offset + LIMIT)
				.order("is_premium", { ascending: false })
				.order("created_at", { ascending: false }));

	if (!primary.error) {
		const rows = (primary.data ?? []).map(withResumeDefaults);
		return { rows: rows.slice(0, LIMIT), hasMore: rows.length > LIMIT, error: null };
	}

	if (!isResumeContextFeatureError(primary.error)) {
		return { rows: [], hasMore: false, error: primary.error };
	}

	// Attempt 2 – with read counts (no activation context)
	const withReads = await (isTop
		? supabase
				.from("resumes")
				.select(RESUME_SELECT_WITH_READS)
				.eq("review_queue_status", "active")
				.range(offset, offset + LIMIT)
				.order("is_premium", { ascending: false })
				.order("roast_count", { ascending: false })
				.order("created_at", { ascending: false })
		: supabase
				.from("resumes")
				.select(RESUME_SELECT_WITH_READS)
				.eq("review_queue_status", "active")
				.range(offset, offset + LIMIT)
				.order("is_premium", { ascending: false })
				.order("created_at", { ascending: false }));

	if (!withReads.error) {
		const rows = (withReads.data ?? []).map(withResumeDefaults);
		return { rows: rows.slice(0, LIMIT), hasMore: rows.length > LIMIT, error: null };
	}

	if (!isReadCountFeatureError(withReads.error)) {
		return { rows: [], hasMore: false, error: withReads.error };
	}

	// Attempt 3 – base schema only
	const base = await (isTop
		? supabase
				.from("resumes")
				.select(RESUME_SELECT_BASE)
				.eq("review_queue_status", "active")
				.range(offset, offset + LIMIT)
				.order("is_premium", { ascending: false })
				.order("roast_count", { ascending: false })
				.order("created_at", { ascending: false })
		: supabase
				.from("resumes")
				.select(RESUME_SELECT_BASE)
				.eq("review_queue_status", "active")
				.range(offset, offset + LIMIT)
				.order("is_premium", { ascending: false })
				.order("created_at", { ascending: false }));

	const rows = (base.data ?? []).map(withResumeDefaults);
	return { rows: rows.slice(0, LIMIT), hasMore: rows.length > LIMIT, error: base.error ?? null };
}

// ─── Review previews (extracted for parallel fetch) ───────────────────────────

export async function fetchReviewPreviewsForIds(
	resumeIds: string[],
): Promise<Record<string, ReviewPreview>> {
	if (!resumeIds.length) return {};

	const primary = await supabase
		.from("roasts")
		.select(REVIEW_PREVIEW_SELECT_WITH_THREADS)
		.in("resume_id", resumeIds)
		.eq("is_deleted", false)
		.is("parent_id", null)
		.order("helpful_votes", { ascending: false })
		.order("created_at", { ascending: false });

	const result =
		primary.error && isReviewPreviewFeatureError(primary.error)
			? await supabase
					.from("roasts")
					.select(REVIEW_PREVIEW_SELECT_BASE)
					.in("resume_id", resumeIds)
					.order("helpful_votes", { ascending: false })
					.order("created_at", { ascending: false })
			: primary;

	if (result.error) return {};
	return getReviewPreviewsByResumeId((result.data ?? []) as ReviewPreviewRow[]);
}
