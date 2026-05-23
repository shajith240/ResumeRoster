export type LeaderboardStatsInput = {
	college?: string | null;
	helpful_votes: number;
	roast_count: number;
	target_role?: string | null;
};

export type LeaderboardRoastInput = {
	author_id: string;
	created_at: string;
	helpful_votes: number;
};

export type LeaderboardTopRoast = {
	id: string;
	resume_id: string;
	content: string;
	helpful_votes: number;
	created_at: string;
};

export function roleTag(roaster: LeaderboardStatsInput) {
	const role = `${roaster.target_role ?? ""} ${roaster.college ?? ""}`.toLowerCase();

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

export function roastPoints(helpfulVotes: number, roastCount: number) {
	return helpfulVotes * 120 + roastCount * 60;
}

export function improvement(helpfulVotes: number, roastCount: number) {
	return Math.min(96, Math.max(12, 18 + helpfulVotes * 4 + roastCount * 2));
}

export function sortRoasters<
	T extends {
		helpful_votes: number;
		roast_count: number;
		roast_points?: number;
	},
>(roasters: T[]) {
	return [...roasters].sort(
		(a, b) =>
			(b.roast_points ?? 0) - (a.roast_points ?? 0) ||
			b.helpful_votes - a.helpful_votes ||
			b.roast_count - a.roast_count,
	);
}

export function bestRoastMap<T extends LeaderboardRoastInput>(roasts: T[]) {
	return roasts.reduce<Record<string, T>>((map, roast) => {
		const current = map[roast.author_id];
		if (
			!current ||
			roast.helpful_votes > current.helpful_votes ||
			(roast.helpful_votes === current.helpful_votes &&
				new Date(roast.created_at).getTime() >
					new Date(current.created_at).getTime())
		) {
			map[roast.author_id] = roast;
		}
		return map;
	}, {});
}

export function enhanceRoaster<
	T extends LeaderboardStatsInput,
	R extends LeaderboardTopRoast | undefined,
>(
	roaster: T,
	topRoast?: R,
	stats?: { helpfulVotes: number; roastCount: number },
) {
	const helpfulVotes = stats?.helpfulVotes ?? roaster.helpful_votes;
	const roastCount = stats?.roastCount ?? roaster.roast_count;

	return {
		...roaster,
		helpful_votes: helpfulVotes,
		improvement: improvement(helpfulVotes, roastCount),
		roast_count: roastCount,
		roast_points: roastPoints(helpfulVotes, roastCount),
		role_tag: roleTag(roaster),
		top_roast: topRoast
			? {
					id: topRoast.id,
					resume_id: topRoast.resume_id,
					content: topRoast.content,
					helpful_votes: topRoast.helpful_votes,
					created_at: topRoast.created_at,
				}
			: undefined,
	};
}
