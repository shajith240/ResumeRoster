import { supabase } from "@/lib/supabase/client";
import type {
	PublicProfile,
	PublicProfileResume,
	PublicProfileReview,
	PublicProfileReviewLegacy,
} from "@/lib/supabase/types";
import type { ActivityItem } from "./types";
import { formatActivityDate, formatDate, normalizePublicProfileReview } from "./utils";

export function getActivity(
	reviews: PublicProfileReview[],
	resumes: PublicProfileResume[],
	profile: PublicProfile,
): ActivityItem[] {
	const resumeItems: ActivityItem[] = resumes.slice(0, 5).map((resume) => ({
		id: `resume-${resume.id}`,
		title: `Posted ${resume.title}`,
		detail: formatActivityDate(resume.created_at),
		href: `/resume/${resume.id}`,
		timestamp: new Date(resume.created_at).getTime(),
	}));

	const reviewItems: ActivityItem[] = reviews.slice(0, 5).map((review) => ({
		id: `review-${review.id}`,
		title: `Reviewed ${review.resume_title}`,
		detail: formatActivityDate(review.created_at),
		href: `/resume/${review.resume_id}`,
		timestamp: new Date(review.created_at).getTime(),
	}));

	const activity = [...resumeItems, ...reviewItems]
		.sort((a, b) => b.timestamp - a.timestamp)
		.slice(0, 5);

	if (activity.length) return activity;

	return [
		{
			id: "profile-created",
			title: "Joined Linted",
			detail: `Member since ${formatDate(profile.created_at)}`,
			href: "/feed",
			timestamp: new Date(profile.created_at).getTime(),
		},
		{
			id: "ready-to-review",
			title: "Ready to review resumes",
			detail: "No public activity yet",
			href: "/feed",
			timestamp: new Date(profile.created_at).getTime(),
		},
	];
}

export async function loadPublicProfileReviews(profileId: string) {
	const reviewResult = await supabase.rpc("get_public_profile_reviews", {
		profile_id: profileId,
		limit_count: 20,
	});

	if (!reviewResult.error) {
		return {
			data: ((reviewResult.data ?? []) as PublicProfileReview[]).map(
				normalizePublicProfileReview,
			),
			error: null,
		};
	}

	if (!/get_public_profile_reviews|schema cache|function/i.test(reviewResult.error.message)) {
		return { data: [] as PublicProfileReview[], error: reviewResult.error };
	}

	const legacyResult = await supabase.rpc("get_public_profile_roasts", {
		profile_id: profileId,
		limit_count: 20,
	});

	return {
		data: ((legacyResult.data ?? []) as PublicProfileReviewLegacy[]).map(
			normalizePublicProfileReview,
		),
		error: legacyResult.error,
	};
}
