"use client";

import { useEffect, useState } from "react";
import { CalendarDays } from "@/components/ui/solar-icons";

import { LeaderboardSkeleton } from "@/components/leaderboard/LeaderboardSkeleton";
import {
	StackedList,
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
import { loadOnlineProfileIds } from "@/lib/online-presence";
import { supabase } from "@/lib/supabase/client";
import styles from "./Leaderboard.module.css";

type TimeRange = "week" | "month" | "all";

const rangeLabels: Record<TimeRange, string> = {
	week: "This Week",
	month: "This Month",
	all: "All Time",
};


async function fetchLeaderboardFromApi(range: TimeRange): Promise<{
	leaderboard: { message: string; reviewers: LeaderboardReviewer[] };
	directory: { message: string; reviewers: LeaderboardReviewer[] };
}> {
	const res = await fetch(`/api/leaderboard?range=${range}`, { cache: "no-store" });
	if (!res.ok) {
		return {
			leaderboard: {
				message: "Leaderboard data is temporarily unavailable.",
				reviewers: [],
			},
			directory: { message: "", reviewers: [] },
		};
	}
	return res.json() as Promise<{
		leaderboard: { message: string; reviewers: LeaderboardReviewer[] };
		directory: { message: string; reviewers: LeaderboardReviewer[] };
	}>;
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

			const data = await fetchLeaderboardFromApi(range);
			// Single presence lookup covering both lists — avoids two Supabase RPC calls
			const allProfiles = [
				...data.leaderboard.reviewers,
				...data.directory.reviewers,
			];
			const onlineIds = allProfiles.length
				? await loadOnlineProfileIds(allProfiles.map((p) => p.id))
				: new Set<string>();
			const withOnline = (profiles: LeaderboardReviewer[]) =>
				profiles.map((p) => ({ ...p, is_online: onlineIds.has(p.id) }));
			const rankedReviewers = withOnline(data.leaderboard.reviewers);
			const rankedDirectory = withOnline(data.directory.reviewers);

			if (!active) return;

			setReviewers(rankedReviewers);
			setDirectoryReviewers(rankedDirectory);
			setMessage(data.leaderboard.message || data.directory.message);

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
			}, 800);
		}

		void loadLeaderboard();

		const channel = supabase.channel(`leaderboard-live-${range}`);
		channel
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "roasts" },
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
							<CalendarDays className={styles.rangeIcon} size={15} aria-hidden="true" />
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
