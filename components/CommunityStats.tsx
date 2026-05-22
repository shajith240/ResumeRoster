"use client";

import { useEffect, useState } from "react";
import {
  APP_PRESENCE_CHANNEL,
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

function formatStat(value: number) {
  return value.toLocaleString();
}

export default function CommunityStats() {
  const [stats, setStats] = useState<CommunityStatsState>(EMPTY_STATS);
  const [statsLoading, setStatsLoading] = useState(true);
  const [presenceReady, setPresenceReady] = useState(false);
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
    let mounted = true;

    function syncPresence() {
      const state = presenceChannel.presenceState<AppPresencePayload>();
      const userIds = new Set<string>();

      for (const [key, presences] of Object.entries(state)) {
        const userId = presences.find((presence) => presence.user_id)?.user_id;
        userIds.add(userId || key);
      }

      if (mounted) {
        setActiveRoasters(userIds.size);
        setPresenceReady(true);
      }
    }

    const presenceChannel = supabase
      .channel(APP_PRESENCE_CHANNEL)
      .on("presence", { event: "sync" }, syncPresence)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          syncPresence();
        }
      });

    return () => {
      mounted = false;
      void supabase.removeChannel(presenceChannel);
    };
  }, []);

  return (
    <div className="feed-stats-grid" aria-busy={statsLoading || !presenceReady}>
      <div>
        <span>Resumes roasted this week</span>
        <strong>
          {statsLoading ? "--" : formatStat(stats.resumesRoastedThisWeek)}
        </strong>
      </div>
      <div>
        <span>Active roasters</span>
        <strong>{presenceReady ? formatStat(activeRoasters) : "--"}</strong>
      </div>
    </div>
  );
}
