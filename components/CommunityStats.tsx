"use client";

import { useEffect, useState } from "react";
import {
	APP_PRESENCE_CHANNEL,
	APP_PRESENCE_ACTIVE_WINDOW_SECONDS,
	APP_PRESENCE_CHANGE_EVENT,
	isPresenceFeatureError,
	type AppPresencePayload,
} from "@/lib/app-presence";
import { supabase } from "@/lib/supabase/client";

type CommunityStatsState = {
	resumesRoastedThisWeek: number;
};

const EMPTY_STATS: CommunityStatsState = {
	resumesRoastedThisWeek: 0,
};

function getWeekStartIso() {
	const start = new Date();
	const daysSinceMonday = (start.getDay() + 6) % 7;
	start.setHours(0, 0, 0, 0);
	start.setDate(start.getDate() - daysSinceMonday);
	return start.toISOString();
}

function isDeleteFeatureError(error: { message?: string } | null) {
	return /is_deleted|schema cache|column/i.test(error?.message ?? "");
}

async function loadCommunityStats() {
	const weekStart = getWeekStartIso();
	const primaryResult = await supabase
		.from("roasts")
		.select("resume_id,author_id")
		.gte("created_at", weekStart)
		.eq("is_deleted", false);

	const result =
		primaryResult.error && isDeleteFeatureError(primaryResult.error)
			? await supabase
					.from("roasts")
					.select("resume_id,author_id")
					.gte("created_at", weekStart)
			: primaryResult;

	if (result.error) {
		throw result.error;
	}

	const rows = result.data ?? [];

	return {
		resumesRoastedThisWeek: new Set(rows.map((row) => row.resume_id)).size,
	};
}

async function loadActiveReviewers() {
	const reviewerResult = await supabase.rpc("get_active_reviewer_count", {
		window_seconds: APP_PRESENCE_ACTIVE_WINDOW_SECONDS,
	});

	const { data, error } =
		reviewerResult.error && isPresenceFeatureError(reviewerResult.error)
			? await supabase.rpc("get_active_roaster_count", {
					window_seconds: APP_PRESENCE_ACTIVE_WINDOW_SECONDS,
				})
			: reviewerResult;

	if (error) {
		if (isPresenceFeatureError(error)) {
			return { count: 0, featureReady: false };
		}
		throw error;
	}

	return { count: Number(data ?? 0), featureReady: true };
}

function countRealtimeReviewers(
	presenceState: Record<string, Array<AppPresencePayload>>,
) {
	const activeUserIds = new Set<string>();

	Object.values(presenceState).forEach((presences) => {
		presences.forEach((presence) => {
			if (presence.user_id) activeUserIds.add(presence.user_id);
		});
	});

	return activeUserIds.size;
}

function formatStat(value: number) {
	return value.toLocaleString();
}

export default function CommunityStats() {
	const [stats, setStats] = useState<CommunityStatsState>(EMPTY_STATS);
	const [statsLoading, setStatsLoading] = useState(true);
	const [activeReviewersLoading, setActiveReviewersLoading] = useState(true);
	const [serverActiveReviewers, setServerActiveReviewers] = useState<number | null>(
		null,
	);
	const [realtimeActiveReviewers, setRealtimeActiveReviewers] = useState(0);
	const [localSessionActive, setLocalSessionActive] = useState(false);
	const activeReviewers = Math.max(
		serverActiveReviewers ?? 0,
		realtimeActiveReviewers,
		localSessionActive ? 1 : 0,
	);

	useEffect(() => {
		let active = true;
		let refreshTimer: number | null = null;

		async function refreshStats() {
			try {
				const nextStats = await loadCommunityStats();
				if (active) setStats(nextStats);
			} catch {
				if (active) setStats(EMPTY_STATS);
			} finally {
				if (active) setStatsLoading(false);
			}
		}

		function queueRefresh() {
			if (refreshTimer) window.clearTimeout(refreshTimer);
			refreshTimer = window.setTimeout(() => void refreshStats(), 180);
		}

		void refreshStats();

		const channel = supabase
			.channel("community-stats")
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "roasts" },
				queueRefresh,
			)
			.subscribe();

		return () => {
			active = false;
			if (refreshTimer) window.clearTimeout(refreshTimer);
			void supabase.removeChannel(channel);
		};
	}, []);

	useEffect(() => {
		let active = true;
		let syncTimer: number | null = null;

		function syncRealtimeCount() {
			if (!active) return;
			if (syncTimer) window.clearTimeout(syncTimer);
			syncTimer = window.setTimeout(() => {
				if (!active) return;
				setRealtimeActiveReviewers(
					countRealtimeReviewers(
						channel.presenceState() as Record<
							string,
							Array<AppPresencePayload>
						>,
					),
				);
				setActiveReviewersLoading(false);
			}, 80);
		}

		function handleLocalPresence(event: Event) {
			const presence = (event as CustomEvent<AppPresencePayload>).detail;
			if (!presence?.user_id) return;
			setRealtimeActiveReviewers((current) => Math.max(current, 1));
			setActiveReviewersLoading(false);
		}

		const channel = supabase
			.channel(APP_PRESENCE_CHANNEL)
			.on("presence", { event: "sync" }, syncRealtimeCount)
			.on("presence", { event: "join" }, syncRealtimeCount)
			.on("presence", { event: "leave" }, syncRealtimeCount)
			.subscribe((subscriptionStatus) => {
				if (subscriptionStatus === "SUBSCRIBED") syncRealtimeCount();
			});

		window.addEventListener(APP_PRESENCE_CHANGE_EVENT, handleLocalPresence);

		return () => {
			active = false;
			if (syncTimer) window.clearTimeout(syncTimer);
			window.removeEventListener(APP_PRESENCE_CHANGE_EVENT, handleLocalPresence);
			void supabase.removeChannel(channel);
		};
	}, []);

	useEffect(() => {
		let active = true;

		function updateLocalSessionActive(hasUser: boolean) {
			if (!active) return;
			setLocalSessionActive(
				hasUser && document.visibilityState !== "hidden",
			);
			if (hasUser) setActiveReviewersLoading(false);
		}

		function handleVisibilityChange() {
			void supabase.auth
				.getUser()
				.then(({ data }) => updateLocalSessionActive(Boolean(data.user)));
		}

		void supabase.auth
			.getUser()
			.then(({ data }) => updateLocalSessionActive(Boolean(data.user)));

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			updateLocalSessionActive(Boolean(session?.user));
		});

		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			active = false;
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			subscription.unsubscribe();
		};
	}, []);

	useEffect(() => {
		let active = true;
		let presenceFeatureReady = true;
		let refreshTimer: number | null = null;
		let pollTimer: number | null = null;

		async function refreshActiveReviewers() {
			if (!presenceFeatureReady) return;

			try {
				const nextActiveReviewers = await loadActiveReviewers();
				presenceFeatureReady = nextActiveReviewers.featureReady;
				if (!presenceFeatureReady && pollTimer) {
					window.clearInterval(pollTimer);
					pollTimer = null;
				}
				if (active) {
					setServerActiveReviewers(
						nextActiveReviewers.featureReady ? nextActiveReviewers.count : null,
					);
				}
			} catch {
				if (active) setServerActiveReviewers(null);
			} finally {
				if (active) setActiveReviewersLoading(false);
			}
		}

		function queueActiveRefresh() {
			if (refreshTimer) window.clearTimeout(refreshTimer);
			refreshTimer = window.setTimeout(() => void refreshActiveReviewers(), 120);
		}

		window.addEventListener(APP_PRESENCE_CHANGE_EVENT, queueActiveRefresh);
		void refreshActiveReviewers();
		pollTimer = window.setInterval(() => {
			void refreshActiveReviewers();
		}, 15_000);

		return () => {
			active = false;
			window.removeEventListener(APP_PRESENCE_CHANGE_EVENT, queueActiveRefresh);
			if (refreshTimer) window.clearTimeout(refreshTimer);
			if (pollTimer) window.clearInterval(pollTimer);
		};
	}, []);

	return (
		<div
			className="feed-stats-grid"
			aria-busy={statsLoading || activeReviewersLoading}
		>
			<div>
				<span>Resumes reviewed this week</span>
				<strong>
					{statsLoading ? "--" : formatStat(stats.resumesRoastedThisWeek)}
				</strong>
			</div>
			<div>
				<span>Active reviewers</span>
				<strong>
					{activeReviewersLoading ? "--" : formatStat(activeReviewers)}
				</strong>
			</div>
		</div>
	);
}
