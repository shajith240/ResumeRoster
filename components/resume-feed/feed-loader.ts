/**
 * Master loader for one page of feed data.
 * Runs auth + saved-IDs + resume-rows in the minimum number of serial round
 * trips, then fans-out profiles, signed URLs, and review previews in parallel.
 */
import {
	AUTH_SESSION_EXPIRED_MESSAGE,
	getSafeAuthErrorMessage,
	isAuthSessionError,
} from "@/lib/auth-errors";
import { getFreshAuthSession, refreshAuthSessionAfterError } from "@/lib/auth-session";
import { isPublicFeedResume, sortResumes, type FeedSort } from "@/lib/feed-ranking";
import { mergeSavedResumeState } from "@/lib/saved-resumes";
import {
	attachPublicAuthorProfiles,
	FEED_PAGE_SIZE,
	fetchFeedResumes,
	fetchReviewPreviewsForIds,
	fetchSavedResumeIds,
	fetchSignedUrlsCached,
	mergeLiveReviewCounts,
	type ReviewPreview,
	type SavedResumeSummary,
} from "./data";

export type FeedPage = {
	resumes: SavedResumeSummary[];
	signedUrls: Record<string, string>;
	reviewPreviews: Record<string, ReviewPreview>;
	hasMore: boolean;
	saveFeatureReady: boolean;
	authErrorMessage?: string;
};

export async function loadFeedPage(
	offset: number,
	sort: FeedSort,
	savedOnly: boolean,
	retriedOnce = false,
): Promise<FeedPage> {
	const { session, error: sessionError } = await getFreshAuthSession();

	if (sessionError || !session?.user) {
		return {
			resumes: [],
			signedUrls: {},
			reviewPreviews: {},
			hasMore: false,
			saveFeatureReady: true,
			authErrorMessage: AUTH_SESSION_EXPIRED_MESSAGE,
		};
	}

	// Parallel: fetch the user's saved-resume IDs while also fetching the resume page
	const [savedResult, resumeResult] = await Promise.all([
		fetchSavedResumeIds(session.user.id),
		fetchFeedResumes(sort, offset),
	]);

	if (resumeResult.error) {
		if (
			isAuthSessionError(resumeResult.error) &&
			!retriedOnce &&
			(await refreshAuthSessionAfterError(resumeResult.error))
		) {
			return loadFeedPage(offset, sort, savedOnly, true);
		}

		return {
			resumes: [],
			signedUrls: {},
			reviewPreviews: {},
			hasMore: false,
			saveFeatureReady: !savedResult.schemaMissing,
			authErrorMessage: getSafeAuthErrorMessage(resumeResult.error),
		};
	}

	const rows = resumeResult.rows;

	// Parallel: attach profiles+counts, fetch signed URLs (cached), fetch review previews
	const [rowsWithAll, signedUrls, reviewPreviews] = await Promise.all([
		attachPublicAuthorProfiles(rows).then(mergeLiveReviewCounts),
		fetchSignedUrlsCached(rows.map((r) => ({ id: r.id, filePath: r.file_path }))),
		fetchReviewPreviewsForIds(rows.map((r) => r.id)),
	]);

	const withSaved = mergeSavedResumeState(rowsWithAll, savedResult.savedResumeIds);
	const visible = withSaved.filter(
		(r) => isPublicFeedResume(r) && (!savedOnly || r.is_saved),
	);

	return {
		resumes: sortResumes(visible, sort),
		signedUrls,
		reviewPreviews,
		// savedOnly mode never paginates — it loads all matching resumes in one shot
		hasMore: savedOnly ? false : resumeResult.hasMore,
		saveFeatureReady: !savedResult.schemaMissing,
	};
}

export { FEED_PAGE_SIZE };
