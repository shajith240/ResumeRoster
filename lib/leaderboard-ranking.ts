import {
	canShowReviewerProfile,
	getReviewerDisplayLabel,
	type CommunityRole,
	type ReviewerType,
	type ReviewerVerificationStatus,
} from "@/lib/reviewer-validation";

export type LeaderboardStatsInput = {
	college?: string | null;
	community_role?: CommunityRole | null;
	helpful_votes: number;
	reviewer_type?: ReviewerType | null;
	reviewer_verification_status?: ReviewerVerificationStatus | null;
	roast_count: number;
	target_role?: string | null;
};

export type LeaderboardReviewInput = {
	author_id: string;
	created_at: string;
	helpful_votes: number;
};

export type LeaderboardTopReview = {
	id: string;
	resume_id: string;
	content: string;
	helpful_votes: number;
	created_at: string;
};

export function roleTag(reviewer: LeaderboardStatsInput) {
	if (canShowReviewerProfile(reviewer.community_role, reviewer.reviewer_type)) {
		return getReviewerDisplayLabel(reviewer);
	}

	const role =
		`${reviewer.target_role ?? ""} ${reviewer.college ?? ""}`.toLowerCase();

	if (role.includes("student") || role.includes("college") || role.includes("iit")) {
		return "Student";
	}

	if (role.includes("switch")) {
		return "Career Switcher";
	}

	if (role.includes("intern")) {
		return "Intern";
	}

	return "Job Seeker";
}

export function lintPoints(helpfulVotes: number) {
	return helpfulVotes;
}

export function sortReviewers<
	T extends {
		helpful_votes: number;
		lint_points?: number;
		roast_count: number;
		roast_points?: number;
	},
>(reviewers: T[]) {
	return [...reviewers].sort(
		(a, b) =>
			(b.lint_points ?? b.roast_points ?? b.helpful_votes) -
				(a.lint_points ?? a.roast_points ?? a.helpful_votes) ||
			b.helpful_votes - a.helpful_votes ||
			b.roast_count - a.roast_count,
	);
}

export function bestReviewMap<T extends LeaderboardReviewInput>(reviews: T[]) {
	return reviews.reduce<Record<string, T>>((map, review) => {
		const current = map[review.author_id];
		if (
			!current ||
			review.helpful_votes > current.helpful_votes ||
			(review.helpful_votes === current.helpful_votes &&
				new Date(review.created_at).getTime() >
					new Date(current.created_at).getTime())
		) {
			map[review.author_id] = review;
		}
		return map;
	}, {});
}

export function enhanceReviewer<
	T extends LeaderboardStatsInput,
	R extends LeaderboardTopReview | undefined,
>(
	reviewer: T,
	topReview?: R,
	stats?: { helpfulVotes: number; reviewCount?: number; roastCount?: number },
) {
	const helpfulVotes = stats?.helpfulVotes ?? reviewer.helpful_votes;
	const reviewCount =
		stats?.reviewCount ?? stats?.roastCount ?? reviewer.roast_count;
	const reviewPreview = topReview
		? {
				id: topReview.id,
				resume_id: topReview.resume_id,
				content: topReview.content,
				helpful_votes: topReview.helpful_votes,
				created_at: topReview.created_at,
			}
		: undefined;

	return {
		...reviewer,
		helpful_votes: helpfulVotes,
		lint_points: lintPoints(helpfulVotes),
		roast_count: reviewCount,
		roast_points: lintPoints(helpfulVotes),
		role_tag: roleTag({ ...reviewer, helpful_votes: helpfulVotes, roast_count: reviewCount }),
		top_review: reviewPreview,
		top_roast: reviewPreview,
	};
}
