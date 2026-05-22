"use client";

import { useEffect, useState } from "react";
import {
	APP_PRESENCE_ACTIVE_WINDOW_SECONDS,
	APP_PRESENCE_CHANGE_EVENT,
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

function isPresenceFeatureError(error: { message?: string } | null) {
	return /record_app_presence|get_active_roaster_count|app_presence_sessions|schema cache|function|relation/i.test(
		error?.message ?? "",
	);
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

async function loadActiveRoasters() {
	const { data, error } = await supabase.rpc("get_active_roaster_count", {
		window_seconds: APP_PRESENCE_ACTIVE_WINDOW_SECONDS,
	});

	if (error) {
		if (isPresenceFeatureError(error)) return 0;
		throw error;
	}

	return Number(data ?? 0);
}

function formatStat(value: number) {
	return value.toLocaleString();
}

export default function CommunityStats() {
	const [stats, setStats] = useState<CommunityStatsState>(EMPTY_STATS);
	const [statsLoading, setStatsLoading] = useState(true);
	const [activeRoastersLoading, setActiveRoastersLoading] = useState(true);
	const [activeRoasters, setActiveRoasters] = useState(0);

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
		let refreshTimer: number | null = null;
		let pollTimer: number | null = null;

		async function refreshActiveRoasters() {
			try {
				const nextActiveRoasters = await loadActiveRoasters();
				if (active) setActiveRoasters(nextActiveRoasters);
			} catch {
				if (active) setActiveRoasters(0);
			} finally {
				if (active) setActiveRoastersLoading(false);
			}
		}

		function queueActiveRefresh() {
			if (refreshTimer) window.clearTimeout(refreshTimer);
			refreshTimer = window.setTimeout(() => void refreshActiveRoasters(), 120);
		}

		window.addEventListener(APP_PRESENCE_CHANGE_EVENT, queueActiveRefresh);
		void refreshActiveRoasters();
		pollTimer = window.setInterval(() => {
			void refreshActiveRoasters();
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
			aria-busy={statsLoading || activeRoastersLoading}
		>
			<div>
				<span>Resumes roasted this week</span>
				<strong>
					{statsLoading ? "--" : formatStat(stats.resumesRoastedThisWeek)}
				</strong>
			</div>
			<div>
				<span>Active roasters</span>
				<strong>
					{activeRoastersLoading ? "--" : formatStat(activeRoasters)}
				</strong>
			</div>
		</div>
	);
}
