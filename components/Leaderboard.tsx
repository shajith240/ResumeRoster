"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Flame, Search, Sparkles } from "lucide-react";

import StackedList, {
	type LeaderboardRoastPreview,
	type LeaderboardRoaster,
} from "@/components/ui/stacked-list";
import { Input } from "@/components/ui/input";
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

	return "Job Seeker";
}

function roastPoints(helpfulVotes: number, roastCount: number) {
	return helpfulVotes * 120 + roastCount * 60;
}

function improvement(helpfulVotes: number, roastCount: number) {
	return Math.min(96, Math.max(12, 18 + helpfulVotes * 4 + roastCount * 2));
}

function nameFor(roaster: LeaderboardRoaster) {
	return roaster.username || "Anonymous roaster";
}

function sortRoasters(roasters: LeaderboardRoaster[]) {
	return [...roasters].sort(
		(a, b) =>
			(b.roast_points ?? 0) - (a.roast_points ?? 0) ||
			b.helpful_votes - a.helpful_votes ||
			b.roast_count - a.roast_count,
	);
}

function matchesSearch(roaster: LeaderboardRoaster, query: string) {
	if (!query) return true;

	return [
		nameFor(roaster),
		roaster.target_role,
		roaster.college,
		roaster.role_tag,
		roaster.top_roast?.content,
	]
		.filter(Boolean)
		.some((value) => value!.toLowerCase().includes(query));
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

function podiumOrder(roasters: LeaderboardRoaster[]) {
	const top = roasters.slice(0, 3);
	if (top.length < 3) return top;
	return [top[1], top[0], top[2]];
}

export default function Leaderboard() {
	const [roasters, setRoasters] = useState<LeaderboardRoaster[]>([]);
	const [loading, setLoading] = useState(true);
	const [message, setMessage] = useState("");
	const [range, setRange] = useState<TimeRange>("month");
	const [searchQuery, setSearchQuery] = useState("");

	useEffect(() => {
		async function loadLeaderboard() {
			const started = Date.now();
			setLoading(true);
			setMessage("");

			const since = getRangeStart(range);

			if (since) {
				const { data: periodRoasts, error: roastError } = await supabase
					.from("roasts")
					.select("id,resume_id,author_id,content,helpful_votes,created_at")
					.gte("created_at", since)
					.order("helpful_votes", { ascending: false })
					.order("created_at", { ascending: false })
					.limit(250);

				if (roastError) {
					setMessage(roastError.message);
					setRoasters([]);
				} else {
					const roasts = (periodRoasts ?? []) as RoastRow[];
					const authorIds = Array.from(new Set(roasts.map((roast) => roast.author_id)));

					if (!authorIds.length) {
						setRoasters([]);
					} else {
						const { data: profiles, error: profileError } = await supabase
							.from("profiles")
							.select("id,username,college,target_role,roast_count,helpful_votes")
							.in("id", authorIds);

						if (profileError) {
							setMessage(profileError.message);
							setRoasters([]);
						} else {
							const stats = roasts.reduce<
								Record<string, { helpfulVotes: number; roastCount: number }>
							>((map, roast) => {
								map[roast.author_id] ??= { helpfulVotes: 0, roastCount: 0 };
								map[roast.author_id].helpfulVotes += roast.helpful_votes;
								map[roast.author_id].roastCount += 1;
								return map;
							}, {});
							const topRoasts = bestRoastMap(roasts);

							setRoasters(
								sortRoasters(
									((profiles ?? []) as RoasterLeaderboardEntry[]).map((profile) =>
										enhanceRoaster(profile, topRoasts[profile.id], stats[profile.id]),
									),
								),
							);
						}
					}
				}
			} else {
				const { data, error } = await supabase.rpc("get_roaster_leaderboard", {
					limit_count: 50,
				});

				if (error) {
					setMessage(
						"Run supabase/leaderboard.sql once in Supabase, then refresh this page.",
					);
					setRoasters([]);
				} else {
					const baseRoasters = (data ?? []) as RoasterLeaderboardEntry[];
					const authorIds = baseRoasters.map((roaster) => roaster.id);
					let topRoasts: Record<string, RoastRow> = {};

					if (authorIds.length) {
						const { data: roasts } = await supabase
							.from("roasts")
							.select("id,resume_id,author_id,content,helpful_votes,created_at")
							.in("author_id", authorIds)
							.order("helpful_votes", { ascending: false })
							.order("created_at", { ascending: false })
							.limit(250);

						topRoasts = bestRoastMap((roasts ?? []) as RoastRow[]);
					}

					setRoasters(
						sortRoasters(
							baseRoasters.map((roaster) =>
								enhanceRoaster(roaster, topRoasts[roaster.id]),
							),
						),
					);
				}
			}

			const elapsed = Date.now() - started;
			window.setTimeout(() => setLoading(false), Math.max(0, 300 - elapsed));
		}

		void loadLeaderboard();
	}, [range]);

	const query = searchQuery.trim().toLowerCase();
	const visibleRoasters = useMemo(
		() => sortRoasters(roasters).filter((roaster) => matchesSearch(roaster, query)),
		[query, roasters],
	);
	const topRoasters = visibleRoasters.slice(0, 3);
	const listRoasters = visibleRoasters.slice(3);
	const listStartRank = topRoasters.length + 1;
	const totalPoints = roasters.reduce(
		(total, roaster) => total + (roaster.roast_points ?? 0),
		0,
	);

	if (loading) {
		return (
			<section className={styles.page}>
				<div className={styles.loadingHero} />
				<div className={styles.loadingGrid}>
					<span />
					<span />
					<span />
				</div>
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

					<label className={styles.search}>
						<Search aria-hidden="true" />
						<span className="sr-only">Search leaderboard</span>
						<Input
							onChange={(event) => setSearchQuery(event.target.value)}
							placeholder="Search roasters, roles, top roasts..."
							type="search"
							value={searchQuery}
						/>
					</label>
				</div>
			</header>

			<div className={styles.topLayout}>
				<div className={styles.podium} aria-label="Top three roasters">
					{podiumOrder(topRoasters).map((roaster) => {
						const rank = visibleRoasters.findIndex((item) => item.id === roaster.id) + 1;
						return <PodiumCard key={roaster.id} rank={rank} roaster={roaster} />;
					})}

					{!topRoasters.length ? (
						<div className={styles.emptyPodium}>
							<strong>No roasters found</strong>
							<p>Try another search or switch the time range.</p>
						</div>
					) : null}
				</div>

				<aside className={styles.infoStack}>
					<div className={styles.noteCard}>
						<Sparkles aria-hidden="true" />
						<p>Climb the ranks by writing useful, specific resume feedback.</p>
					</div>
					<div className={styles.pointsCard}>
						<Flame aria-hidden="true" />
						<div>
							<h2>What are Roast Points?</h2>
							<p>
								Roast Points reflect helpful feedback and review activity. The
								better your resume advice, the higher you climb.
							</p>
							<strong>{totalPoints.toLocaleString()} points on this board</strong>
						</div>
					</div>
				</aside>
			</div>

			<div className={styles.listHeader}>
				<div>
					<h2>Roaster list</h2>
					<p>
						{listRoasters.length
							? `Showing ranks ${listStartRank}-${visibleRoasters.length}`
							: topRoasters.length
								? "Top roasters currently fill this view"
								: "No roasters match this view"}
					</p>
				</div>
			</div>

			<StackedList
				message={message}
				roasters={listRoasters}
				searchQuery=""
				startRank={listStartRank}
			/>
		</section>
	);
}

function PodiumCard({
	rank,
	roaster,
}: {
	rank: number;
	roaster: LeaderboardRoaster;
}) {
	const isWinner = rank === 1;

	return (
		<article className={`${styles.podiumCard} ${isWinner ? styles.winnerCard : ""}`}>
			<div className={styles.rankBadge}>#{rank}</div>
			<div className={styles.avatar}>
				<img src="/assets/logo.png" alt="" aria-hidden="true" />
			</div>
			<h2>{nameFor(roaster)}</h2>
			<span className={styles.rolePill}>{roaster.role_tag}</span>
			<strong>
				<Flame aria-hidden="true" />
				{(roaster.roast_points ?? 0).toLocaleString()}
			</strong>
			<p>Roast Points</p>
			<em>+{roaster.improvement}% improvement</em>
			<Link
				href={
					roaster.top_roast
						? `/resume/${roaster.top_roast.resume_id}`
						: `/profile/${roaster.id}`
				}
			>
				View Roast
			</Link>
		</article>
	);
}
