import type { ResumeSummary } from "@/lib/supabase/types";

export type FeedSort = "best" | "new" | "top" | "needs";

export type ResumeRowWithDefaults = Omit<
	ResumeSummary,
	"read_count" | "job_description" | "post_description"
> &
	Partial<
		Pick<ResumeSummary, "read_count" | "job_description" | "post_description">
	>;

export function formatCount(value: number) {
	if (value >= 1_000_000) {
		return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
	}

	if (value >= 1_000) {
		return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
	}

	return value.toLocaleString();
}

export function withResumeDefaults(resume: ResumeRowWithDefaults): ResumeSummary {
	return {
		...resume,
		read_count: resume.read_count ?? 0,
		job_description: resume.job_description ?? null,
		post_description: resume.post_description ?? null,
	};
}

export function getBestScore(resume: ResumeSummary, now = Date.now()) {
	const ageHours = Math.max(
		1,
		(now - new Date(resume.created_at).getTime()) / 3_600_000,
	);

	return resume.roast_count * 8 + 48 / Math.pow(ageHours + 2, 1.2);
}

export function sortResumes<T extends ResumeSummary>(
	resumes: T[],
	sort: FeedSort,
	now = Date.now(),
) {
	return [...resumes].sort((a, b) => {
		if (sort === "new") {
			return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
		}

		if (sort === "top") {
			return (
				b.roast_count - a.roast_count ||
				new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
			);
		}

		if (sort === "needs") {
			const statusScore = (resume: ResumeSummary) =>
				resume.status === "open" ? 0 : 1;

			return (
				statusScore(a) - statusScore(b) ||
				a.roast_count - b.roast_count ||
				new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
			);
		}

		return (
			getBestScore(b, now) - getBestScore(a, now) ||
			new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
		);
	});
}

export function mergeReviewCountsFromRows<
	T extends ResumeSummary,
	R extends { resume_id: string },
>(resumes: T[], reviews: R[]) {
	const countsByResume = new Map<string, number>();

	for (const review of reviews) {
		countsByResume.set(
			review.resume_id,
			(countsByResume.get(review.resume_id) ?? 0) + 1,
		);
	}

	return resumes.map((resume) => ({
		...resume,
		roast_count: countsByResume.get(resume.id) ?? 0,
	}));
}

export const mergeRoastCountsFromRows = mergeReviewCountsFromRows;
