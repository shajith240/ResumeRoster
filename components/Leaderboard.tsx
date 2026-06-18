"use client";

import { useEffect, useState } from "react";
import { CalendarDays } from "@/components/ui/solar-icons";

import { LeaderboardSkeleton } from "@/components/leaderboard/LeaderboardSkeleton";
import {
	StackedList,
	type LeaderboardReviewPreview,
	type LeaderboardReviewer,
} from "@/components/leaderboard/StackedList";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	bestReviewMap,
	enhanceReviewer,
	sortReviewers,
} from "@/lib/leaderboard-ranking";
import { loadOnlineProfileIds } from "@/lib/online-presence";
import { supabase } from "@/lib/supabase/client";
import type {
	ReviewerLeaderboardEntry,
	ReviewerProfileStats,
} from "@/lib/supabase/types";
import styles from "./Leaderboard.module.css";

type TimeRange = "week" | "month" | "all";

type ReviewRow = LeaderboardReviewPreview & {
	author_id: string;
};

const REVIEW_SELECT = "id,resume_id,author_id,content,helpful_votes,created_at";
const PROFILE_SELECT =
	"id,username,full_name,avatar_url,avatar_path,college,target_role,current_position,community_role,reviewer_type,reviewer_headline,reviewer_expertise,reviewer_verification_status,roast_count,helpful_votes";
const PROFILE_FALLBACK_SELECT =
	"id,username,college,target_role,current_position,roast_count,helpful_votes";
const LEADERBOARD_LIMIT = 100;
const DIRECTORY_LIMIT = 500;
const TOP_REVIEW_FETCH_LIMIT = 2000;
const SUPABASE_MIGRATION_MESSAGE =
	"Leaderboard data is temporarily unavailable. Please refresh and try again.";

const rangeLabels: Record<TimeRange, string> = {
	week: "This Week",
	month: "This Month",
	all: "All Time",
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

function isMissingReviewerLeaderboardRpc(message: string) {
	return /get_reviewer_leaderboard|schema cache|function/i.test(message);
}

function isMissingReviewerLeaderboardSinceRpc(message: string) {
	return /get_reviewer_leaderboard_since|schema cache|function/i.test(message);
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
				: entry.lint_points ?? 0,
	};
}

async function fetchReviewRows({
	authorIds,
	since,
}: {
	authorIds?: string[];
	since?: string;
}) {
	async function run(filterDeleted: boolean) {
		let query = supabase.from("roasts").select(REVIEW_SELECT);

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
			.limit(TOP_REVIEW_FETCH_LIMIT);
	}

	const activeReviews = await run(true);

	if (
		activeReviews.error &&
		isMissingSoftDeleteColumn(activeReviews.error.message)
	) {
		return run(false);
	}

	return activeReviews;
}

async function fetchProfilesById(authorIds: string[]) {
	if (!authorIds.length) {
		return { profiles: [] as ReviewerProfileStats[], errorMessage: "" };
	}

	const profileResult = await supabase
		.from("profiles")
		.select(PROFILE_SELECT)
		.in("id", authorIds);

	if (!profileResult.error) {
		return {
			profiles: (profileResult.data ?? []) as ReviewerProfileStats[],
			errorMessage: "",
		};
	}

	if (!isMissingProfileMetadataColumn(profileResult.error.message)) {
		return {
			profiles: [] as ReviewerProfileStats[],
			errorMessage: profileResult.error.message,
		};
	}

	const fallbackResult = await supabase
		.from("profiles")
		.select(PROFILE_FALLBACK_SELECT)
		.in("id", authorIds);

	return {
		profiles: (fallbackResult.data ?? []) as ReviewerProfileStats[],
		errorMessage: fallbackResult.error?.message ?? "",
	};
}

function mergeProfileMetadata(
	reviewer: ReviewerProfileStats,
	profile?: ReviewerProfileStats,
) {
	if (!profile) return reviewer;

	return {
		...reviewer,
		full_name: profile.full_name ?? reviewer.full_name ?? null,
		avatar_url: profile.avatar_url ?? reviewer.avatar_url ?? null,
		avatar_path: profile.avatar_path ?? reviewer.avatar_path ?? null,
		community_role: profile.community_role ?? reviewer.community_role ?? null,
		current_position:
			profile.current_position ?? reviewer.current_position ?? null,
		username: profile.username ?? reviewer.username,
		college: profile.college ?? reviewer.college,
		reviewer_expertise:
			profile.reviewer_expertise ?? reviewer.reviewer_expertise ?? null,
		reviewer_headline:
			profile.reviewer_headline ?? reviewer.reviewer_headline ?? null,
		reviewer_type: profile.reviewer_type ?? reviewer.reviewer_type ?? null,
		reviewer_verification_status:
			profile.reviewer_verification_status ??
			reviewer.reviewer_verification_status ??
			null,
		target_role: profile.target_role ?? reviewer.target_role,
	};
}

function normalizeProfileStats(profile: ReviewerProfileStats): ReviewerProfileStats {
	return {
		...profile,
		helpful_votes: profile.helpful_votes ?? 0,
		roast_count: profile.roast_count ?? 0,
	};
}

async function applyOnlinePresence<T extends { id: string }>(profiles: T[]) {
	if (!profiles.length) return profiles;

	const onlineProfileIds = await loadOnlineProfileIds(
		profiles.map((profile) => profile.id),
	);

	return profiles.map((profile) => ({
		...profile,
		is_online: onlineProfileIds.has(profile.id),
	}));
}

async function fetchReviewerDirectory() {
	const profileResult = await supabase
		.from("profiles")
		.select(PROFILE_SELECT)
		.order("helpful_votes", { ascending: false })
		.order("roast_count", { ascending: false })
		.order("username", { ascending: true })
		.limit(DIRECTORY_LIMIT);

	let profiles: ReviewerProfileStats[] = [];

	if (profileResult.error) {
		if (isMissingProfileMetadataColumn(profileResult.error.message)) {
			const fallbackResult = await supabase
				.from("profiles")
				.select(PROFILE_FALLBACK_SELECT)
				.order("helpful_votes", { ascending: false })
				.order("roast_count", { ascending: false })
				.order("username", { ascending: true })
				.limit(DIRECTORY_LIMIT);

			if (fallbackResult.error) {
				return {
					message: SUPABASE_MIGRATION_MESSAGE,
					reviewers: [],
				};
			}

			profiles = ((fallbackResult.data ?? []) as ReviewerProfileStats[]).map(
				normalizeProfileStats,
			);
		} else {
			return { message: profileResult.error.message, reviewers: [] };
		}
	} else {
		profiles = ((profileResult.data ?? []) as ReviewerProfileStats[]).map(
			normalizeProfileStats,
		);
	}

	const authorIds = profiles.map((profile) => profile.id);
	let topReviews: Record<string, ReviewRow> = {};

	if (authorIds.length) {
		const { data: reviewRows } = await fetchReviewRows({ authorIds });
		topReviews = bestReviewMap((reviewRows ?? []) as ReviewRow[]);
	}

	const profilesWithPresence = await applyOnlinePresence(profiles);
	const ranked = sortReviewers(
		profilesWithPresence.map((profile) =>
			enhanceReviewer(profile, topReviews[profile.id]),
		),
	);

	return {
		message: "",
		reviewers: ranked,
	};
}

async function enrichLeaderboardReviewers(
	baseReviewers: ReviewerProfileStats[],
	since?: string,
) {
	const authorIds = baseReviewers.map((reviewer) => reviewer.id);
	const { profiles, errorMessage } = await fetchProfilesById(authorIds);
	const profilesById = Object.fromEntries(
		profiles.map((profile) => [profile.id, profile]),
	);
	let topReviews: Record<string, ReviewRow> = {};

	if (authorIds.length) {
		const { data: reviewRows } = await fetchReviewRows({ authorIds, since });
		topReviews = bestReviewMap((reviewRows ?? []) as ReviewRow[]);
	}

	const reviewersWithPresence = await applyOnlinePresence(
		baseReviewers.map((reviewer) =>
			mergeProfileMetadata(reviewer, profilesById[reviewer.id]),
		),
	);

	return {
		message: errorMessage,
		reviewers: sortReviewers(
			reviewersWithPresence.map((reviewer) =>
				enhanceReviewer(reviewer, topReviews[reviewer.id]),
			),
		).slice(0, LEADERBOARD_LIMIT),
	};
}

async function fetchLeaderboardData(range: TimeRange) {
	const since = getRangeStart(range);

	if (since) {
		const reviewerResult = await supabase.rpc("get_reviewer_leaderboard_since", {
			limit_count: LEADERBOARD_LIMIT,
			since_at: since,
		});

		if (!reviewerResult.error) {
			return enrichLeaderboardReviewers(
				((reviewerResult.data ?? []) as Array<
					ReviewerProfileStats | ReviewerLeaderboardEntry
				>).map(normalizeLeaderboardEntry),
				since,
			);
		}

		if (!isMissingReviewerLeaderboardSinceRpc(reviewerResult.error.message)) {
			return { message: SUPABASE_MIGRATION_MESSAGE, reviewers: [] };
		}

		const { data: periodReviews, error: reviewError } = await fetchReviewRows({
			since,
		});

		if (reviewError) {
			return { message: reviewError.message, reviewers: [] };
		}

		const reviewRows = (periodReviews ?? []) as ReviewRow[];
		const authorIds = Array.from(
			new Set(reviewRows.map((review) => review.author_id)),
		);

		if (!authorIds.length) {
			return { message: "", reviewers: [] };
		}

		const { profiles, errorMessage } = await fetchProfilesById(authorIds);

		if (errorMessage) {
			return { message: errorMessage, reviewers: [] };
		}

		const stats = reviewRows.reduce<
			Record<string, { helpfulVotes: number; reviewCount: number }>
		>((map, review) => {
			map[review.author_id] ??= { helpfulVotes: 0, reviewCount: 0 };
			map[review.author_id].helpfulVotes += review.helpful_votes;
			map[review.author_id].reviewCount += 1;
			return map;
		}, {});
		const topReviews = bestReviewMap(reviewRows);

		const profilesWithPresence = await applyOnlinePresence(profiles);

		return {
			message: "",
			reviewers: sortReviewers(
				profilesWithPresence.map((profile) =>
					enhanceReviewer(profile, topReviews[profile.id], stats[profile.id]),
				),
			).slice(0, LEADERBOARD_LIMIT),
		};
	}

	const reviewerResult = await supabase.rpc("get_reviewer_leaderboard", {
		limit_count: LEADERBOARD_LIMIT,
	});

	const { data, error } =
		reviewerResult.error &&
		isMissingReviewerLeaderboardRpc(reviewerResult.error.message)
			? await supabase.rpc("get_roaster_leaderboard", {
					limit_count: LEADERBOARD_LIMIT,
				})
			: reviewerResult;

	if (error) {
		return {
			message: SUPABASE_MIGRATION_MESSAGE,
			reviewers: [],
		};
	}

	const baseReviewers = (
		(data ?? []) as Array<ReviewerProfileStats | ReviewerLeaderboardEntry>
	).map(normalizeLeaderboardEntry);
	return enrichLeaderboardReviewers(baseReviewers);
}

export default function Leaderboard() {
	const [reviewers, setReviewers] = useState<LeaderboardReviewer[]>([]);
	const [directoryReviewers, setDirectoryReviewers] = useState<
		LeaderboardReviewer[]
	>([]);
	const [loading, setLoading] = useState(true);
	const [message, setMessage] = useState("");
	const [range, setRange] = useState<TimeRange>("month");
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

			const [leaderboardResult, directoryResult] = await Promise.all([
				fetchLeaderboardData(range),
				fetchReviewerDirectory(),
			]);

			if (!active) return;

			setReviewers(leaderboardResult.reviewers);
			setDirectoryReviewers(directoryResult.reviewers);
			setMessage(leaderboardResult.message || directoryResult.message);

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

		const channel = supabase.channel(`leaderboard-live-${range}`);
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
	}, [range]);

	if (loading) {
		return <LeaderboardSkeleton />;
	}

	return (
		<section className={styles.page}>
			<header className={styles.header}>
				<div>
					<h1>Leaderboard</h1>
					<p>Top reviewers. Better resumes. Stronger careers.</p>
				</div>

				<div className={styles.toolbar}>
					<Select
						value={range}
						onValueChange={(value) => setRange(value as TimeRange)}
					>
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
				</div>
			</header>

			<StackedList
				directoryReviewers={directoryReviewers}
				message={message}
				onSearchQueryChange={setSearchQuery}
				reviewers={reviewers}
				searchQuery={searchQuery}
				searchPlaceholder="Search contributors, roles, top feedback..."
				startRank={1}
			/>
		</section>
	);
}
