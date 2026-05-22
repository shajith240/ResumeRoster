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
import { supabase } from "@/lib/supabase/client";
import type { RoasterLeaderboardEntry } from "@/lib/supabase/types";
import styles from "./Leaderboard.module.css";

type TimeRange = "week" | "month" | "all";

type RoastRow = LeaderboardRoastPreview & {
	author_id: string;
};

const ROAST_SELECT = "id,resume_id,author_id,content,helpful_votes,created_at";
const PROFILE_SELECT =
	"id,username,full_name,avatar_url,avatar_path,college,target_role,roast_count,helpful_votes";
const PROFILE_FALLBACK_SELECT =
	"id,username,college,target_role,roast_count,helpful_votes";
const LEADERBOARD_LIMIT = 100;

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

function roleTag(roaster: RoasterLeaderboardEntry) {
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

function roastPoints(helpfulVotes: number, roastCount: number) {
	return helpfulVotes * 120 + roastCount * 60;
}

function improvement(helpfulVotes: number, roastCount: number) {
	return Math.min(96, Math.max(12, 18 + helpfulVotes * 4 + roastCount * 2));
}

function sortRoasters(roasters: LeaderboardRoaster[]) {
	return [...roasters].sort(
		(a, b) =>
			(b.roast_points ?? 0) - (a.roast_points ?? 0) ||
			b.helpful_votes - a.helpful_votes ||
			b.roast_count - a.roast_count,
	);
}

function isMissingSoftDeleteColumn(message: string) {
	return /is_deleted|schema cache|column/i.test(message);
}

function isMissingProfileMetadataColumn(message: string) {
	return /full_name|avatar_url|avatar_path|schema cache|column/i.test(message);
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
		username: profile.username ?? roaster.username,
		college: profile.college ?? roaster.college,
		target_role: profile.target_role ?? roaster.target_role,
	};
}

function bestRoastMap(roasts: RoastRow[]) {
	return roasts.reduce<Record<string, RoastRow>>((map, roast) => {
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

function enhanceRoaster(
	roaster: RoasterLeaderboardEntry,
	topRoast?: RoastRow,
	stats?: { helpfulVotes: number; roastCount: number },
): LeaderboardRoaster {
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
			message: "Run supabase/leaderboard.sql once in Supabase, then refresh this page.",
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

			const result = await fetchLeaderboardData(range);

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
					<p>Top roasters. Better resumes. Stronger careers.</p>
				</div>

				<div className={styles.toolbar}>
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
				</div>
			</header>

			<StackedList
				message={message}
				onSearchQueryChange={setSearchQuery}
				roasters={roasters}
				searchQuery={searchQuery}
				startRank={1}
			/>
		</section>
	);
}
