"use client";

import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";

import StackedList, {
	type LeaderboardRoastPreview,
	type LeaderboardRoaster,
} from "@/components/ui/stacked-list";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	bestRoastMap,
	enhanceRoaster,
	sortRoasters,
} from "@/lib/leaderboard-ranking";
import { supabase } from "@/lib/supabase/client";
import type { RoasterLeaderboardEntry } from "@/lib/supabase/types";
import styles from "./Leaderboard.module.css";

type TimeRange = "week" | "month" | "all";
type DirectoryMode = "leaderboard" | "reviewers";
type ReviewerFilter =
	| "all"
	| "trusted"
	| "recruiters"
	| "engineers"
	| "career_coaches"
	| "students";

type RoastRow = LeaderboardRoastPreview & {
	author_id: string;
};

const ROAST_SELECT = "id,resume_id,author_id,content,helpful_votes,created_at";
const PROFILE_SELECT =
	"id,username,full_name,avatar_url,avatar_path,college,target_role,community_role,reviewer_type,reviewer_headline,reviewer_expertise,reviewer_verification_status,roast_count,helpful_votes";
const PROFILE_FALLBACK_SELECT =
	"id,username,college,target_role,roast_count,helpful_votes";
const LEADERBOARD_LIMIT = 100;
const SUPABASE_MIGRATION_MESSAGE =
	"Run the pending Supabase migrations, then refresh this page.";

const rangeLabels: Record<TimeRange, string> = {
	week: "This Week",
	month: "This Month",
	all: "All Time",
};
const reviewerFilterLabels: Record<ReviewerFilter, string> = {
	all: "All",
	career_coaches: "Career coaches",
	engineers: "Engineers",
	recruiters: "Recruiters",
	students: "Students/placed",
	trusted: "Trusted",
};

function getRangeStart(range: TimeRange) {
	if (range === "all") return null;

	const date = new Date();
	date.setDate(date.getDate() - (range === "week" ? 7 : 30));
	return date.toISOString();
}

function isMissingSoftDeleteColumn(message: string) {
	return /is_deleted|schema cache|column/i.test(message);
}

function isMissingProfileMetadataColumn(message: string) {
	return /full_name|avatar_url|avatar_path|community_role|reviewer_|schema cache|column/i.test(message);
}

async function fetchRoastRows({
	authorIds,
	since,
}: {
	authorIds?: string[];
	since?: string;
}) {
	async function run(filterDeleted: boolean) {
		let query = supabase.from("roasts").select(ROAST_SELECT);

		if (filterDeleted) {
			query = query.eq("is_deleted", false);
		}

		if (since) {
			query = query.gte("created_at", since);
		}

		if (authorIds?.length) {
			query = query.in("author_id", authorIds);
		}

		return query
			.order("helpful_votes", { ascending: false })
			.order("created_at", { ascending: false })
			.limit(1000);
	}

	const activeRoasts = await run(true);

	if (
		activeRoasts.error &&
		isMissingSoftDeleteColumn(activeRoasts.error.message)
	) {
		return run(false);
	}

	return activeRoasts;
}

async function fetchProfilesById(authorIds: string[]) {
	if (!authorIds.length) {
		return { profiles: [] as RoasterLeaderboardEntry[], errorMessage: "" };
	}

	const profileResult = await supabase
		.from("profiles")
		.select(PROFILE_SELECT)
		.in("id", authorIds);

	if (!profileResult.error) {
		return {
			profiles: (profileResult.data ?? []) as RoasterLeaderboardEntry[],
			errorMessage: "",
		};
	}

	if (!isMissingProfileMetadataColumn(profileResult.error.message)) {
		return {
			profiles: [] as RoasterLeaderboardEntry[],
			errorMessage: profileResult.error.message,
		};
	}

	const fallbackResult = await supabase
		.from("profiles")
		.select(PROFILE_FALLBACK_SELECT)
		.in("id", authorIds);

	return {
		profiles: (fallbackResult.data ?? []) as RoasterLeaderboardEntry[],
		errorMessage: fallbackResult.error?.message ?? "",
	};
}

function mergeProfileMetadata(
	roaster: RoasterLeaderboardEntry,
	profile?: RoasterLeaderboardEntry,
) {
	if (!profile) return roaster;

	return {
		...roaster,
		full_name: profile.full_name ?? roaster.full_name ?? null,
		avatar_url: profile.avatar_url ?? roaster.avatar_url ?? null,
		avatar_path: profile.avatar_path ?? roaster.avatar_path ?? null,
		community_role: profile.community_role ?? roaster.community_role ?? null,
		username: profile.username ?? roaster.username,
		college: profile.college ?? roaster.college,
		reviewer_expertise:
			profile.reviewer_expertise ?? roaster.reviewer_expertise ?? null,
		reviewer_headline:
			profile.reviewer_headline ?? roaster.reviewer_headline ?? null,
		reviewer_type: profile.reviewer_type ?? roaster.reviewer_type ?? null,
		reviewer_verification_status:
			profile.reviewer_verification_status ??
			roaster.reviewer_verification_status ??
			null,
		target_role: profile.target_role ?? roaster.target_role,
	};
}

function applyReviewerFilter(
	profiles: RoasterLeaderboardEntry[],
	filter: ReviewerFilter,
) {
	return profiles.filter((profile) => {
		const isReviewer =
			profile.community_role === "reviewer" || profile.community_role === "both";
		if (!isReviewer) return false;

		if (filter === "trusted") {
			return profile.reviewer_verification_status === "verified";
		}

		if (filter === "recruiters") {
			return (
				profile.reviewer_type === "recruiter" ||
				profile.reviewer_type === "hiring_manager"
			);
		}

		if (filter === "engineers") {
			return profile.reviewer_type === "engineer";
		}

		if (filter === "career_coaches") {
			return profile.reviewer_type === "career_coach";
		}

		if (filter === "students") {
			return (
				profile.reviewer_type === "student" ||
				profile.reviewer_type === "placed_professional"
			);
		}

		return true;
	});
}

async function fetchReviewerDirectory(filter: ReviewerFilter) {
	const profileResult = await supabase
		.from("profiles")
		.select(PROFILE_SELECT)
		.in("community_role", ["reviewer", "both"])
		.order("helpful_votes", { ascending: false })
		.order("roast_count", { ascending: false })
		.limit(100);

	if (profileResult.error) {
		if (isMissingProfileMetadataColumn(profileResult.error.message)) {
			return { message: SUPABASE_MIGRATION_MESSAGE, roasters: [] };
		}

		return { message: profileResult.error.message, roasters: [] };
	}

	const profiles = applyReviewerFilter(
		(profileResult.data ?? []) as RoasterLeaderboardEntry[],
		filter,
	);
	const authorIds = profiles.map((profile) => profile.id);
	let topRoasts: Record<string, RoastRow> = {};

	if (authorIds.length) {
		const { data: roasts } = await fetchRoastRows({ authorIds });
		topRoasts = bestRoastMap((roasts ?? []) as RoastRow[]);
	}

	const ranked = sortRoasters(
		profiles.map((profile) => enhanceRoaster(profile, topRoasts[profile.id])),
	).sort(
		(a, b) =>
			Number(b.reviewer_verification_status === "verified") -
				Number(a.reviewer_verification_status === "verified") ||
			(b.helpful_votes ?? 0) - (a.helpful_votes ?? 0) ||
			(b.roast_count ?? 0) - (a.roast_count ?? 0),
	);

	return {
		message: "",
		roasters: ranked.slice(0, LEADERBOARD_LIMIT),
	};
}

async function fetchLeaderboardData(range: TimeRange) {
	const since = getRangeStart(range);

	if (since) {
		const { data: periodRoasts, error: roastError } = await fetchRoastRows({
			since,
		});

		if (roastError) {
			return { message: roastError.message, roasters: [] };
		}

		const roasts = (periodRoasts ?? []) as RoastRow[];
		const authorIds = Array.from(new Set(roasts.map((roast) => roast.author_id)));

		if (!authorIds.length) {
			return { message: "", roasters: [] };
		}

		const { profiles, errorMessage } = await fetchProfilesById(authorIds);

		if (errorMessage) {
			return { message: errorMessage, roasters: [] };
		}

		const stats = roasts.reduce<
			Record<string, { helpfulVotes: number; roastCount: number }>
		>((map, roast) => {
			map[roast.author_id] ??= { helpfulVotes: 0, roastCount: 0 };
			map[roast.author_id].helpfulVotes += roast.helpful_votes;
			map[roast.author_id].roastCount += 1;
			return map;
		}, {});
		const topRoasts = bestRoastMap(roasts);

		return {
			message: "",
			roasters: sortRoasters(
				profiles.map((profile) =>
					enhanceRoaster(profile, topRoasts[profile.id], stats[profile.id]),
				),
			).slice(0, LEADERBOARD_LIMIT),
		};
	}

	const { data, error } = await supabase.rpc("get_roaster_leaderboard", {
		limit_count: LEADERBOARD_LIMIT,
	});

	if (error) {
		return {
			message: SUPABASE_MIGRATION_MESSAGE,
			roasters: [],
		};
	}

	const baseRoasters = (data ?? []) as RoasterLeaderboardEntry[];
	const authorIds = baseRoasters.map((roaster) => roaster.id);
	const { profiles, errorMessage } = await fetchProfilesById(authorIds);
	const profilesById = Object.fromEntries(
		profiles.map((profile) => [profile.id, profile]),
	);
	let topRoasts: Record<string, RoastRow> = {};

	if (authorIds.length) {
		const { data: roasts } = await fetchRoastRows({ authorIds });
		topRoasts = bestRoastMap((roasts ?? []) as RoastRow[]);
	}

	return {
		message: errorMessage,
		roasters: sortRoasters(
			baseRoasters.map((roaster) =>
				enhanceRoaster(
					mergeProfileMetadata(roaster, profilesById[roaster.id]),
					topRoasts[roaster.id],
				),
			),
		).slice(0, LEADERBOARD_LIMIT),
	};
}

export default function Leaderboard() {
	const [roasters, setRoasters] = useState<LeaderboardRoaster[]>([]);
	const [loading, setLoading] = useState(true);
	const [message, setMessage] = useState("");
	const [mode, setMode] = useState<DirectoryMode>("leaderboard");
	const [range, setRange] = useState<TimeRange>("month");
	const [reviewerFilter, setReviewerFilter] = useState<ReviewerFilter>("all");
	const [searchQuery, setSearchQuery] = useState("");

	useEffect(() => {
		let active = true;
		let refreshTimer: number | undefined;

		async function loadLeaderboard(quiet = false) {
			const started = Date.now();
			if (!quiet) {
				setLoading(true);
			}
			setMessage("");

			const result =
				mode === "reviewers"
					? await fetchReviewerDirectory(reviewerFilter)
					: await fetchLeaderboardData(range);

			if (!active) return;

			setRoasters(result.roasters);
			setMessage(result.message);

			const finish = () => {
				if (!active) return;
				setLoading(false);
			};

			if (quiet) {
				finish();
				return;
			}

			const elapsed = Date.now() - started;
			window.setTimeout(finish, Math.max(0, 260 - elapsed));
		}

		function scheduleRefresh() {
			if (refreshTimer) {
				window.clearTimeout(refreshTimer);
			}

			refreshTimer = window.setTimeout(() => {
				void loadLeaderboard(true);
			}, 220);
		}

		void loadLeaderboard();

		const channel = supabase.channel(
			`leaderboard-live-${mode}-${range}-${reviewerFilter}`,
		);
		channel
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "roasts" },
				scheduleRefresh,
			)
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "profiles" },
				scheduleRefresh,
			)
			.subscribe();

		return () => {
			active = false;
			if (refreshTimer) {
				window.clearTimeout(refreshTimer);
			}
			void supabase.removeChannel(channel);
		};
	}, [mode, range, reviewerFilter]);

	if (loading) {
		return (
			<section className={styles.page}>
				<div className={styles.loadingHero} />
				<div className={styles.loadingTable} />
			</section>
		);
	}

	return (
		<section className={styles.page}>
			<header className={styles.header}>
				<div>
					<h1>Leaderboard</h1>
					<p>
						{mode === "reviewers"
							? "Find credible people who can give useful resume feedback."
							: "Top reviewers. Better resumes. Stronger careers."}
					</p>
				</div>

				<div className={styles.toolbar}>
					<div className={styles.modeTabs}>
						<button
							aria-pressed={mode === "leaderboard"}
							onClick={() => setMode("leaderboard")}
							type="button"
						>
							Leaderboard
						</button>
						<button
							aria-pressed={mode === "reviewers"}
							onClick={() => setMode("reviewers")}
							type="button"
						>
							Reviewers
						</button>
					</div>
					{mode === "leaderboard" ? (
						<Select value={range} onValueChange={(value) => setRange(value as TimeRange)}>
							<SelectTrigger
								aria-label="Leaderboard time range"
								className={styles.rangeTrigger}
							>
								<CalendarDays className={styles.rangeIcon} aria-hidden="true" />
								<SelectValue />
							</SelectTrigger>
							<SelectContent className={styles.rangeContent}>
								<SelectGroup>
									{(["week", "month", "all"] as const).map((value) => (
										<SelectItem
											className={styles.rangeItem}
											key={value}
											value={value}
										>
											{rangeLabels[value]}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					) : (
						<Select
							value={reviewerFilter}
							onValueChange={(value) => setReviewerFilter(value as ReviewerFilter)}
						>
							<SelectTrigger
								aria-label="Reviewer directory filter"
								className={styles.rangeTrigger}
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent className={styles.rangeContent}>
								<SelectGroup>
									{(
										[
											"all",
											"trusted",
											"recruiters",
											"engineers",
											"career_coaches",
											"students",
										] as const
									).map((value) => (
										<SelectItem
											className={styles.rangeItem}
											key={value}
											value={value}
										>
											{reviewerFilterLabels[value]}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					)}
				</div>
			</header>

			<StackedList
				description={
					mode === "reviewers"
						? "People who opted into reviewing resumes, sorted by trust and helpfulness."
						: "Reviewer directory ranked by useful resume feedback."
				}
				heading={mode === "reviewers" ? "Reviewer Directory" : "Top 100"}
				message={message}
				onSearchQueryChange={setSearchQuery}
				roasters={roasters}
				searchQuery={searchQuery}
				searchPlaceholder={
					mode === "reviewers"
						? "Search reviewers, expertise, roles..."
						: "Search reviewers, roles, top feedback..."
				}
				startRank={1}
			/>
		</section>
	);
}
