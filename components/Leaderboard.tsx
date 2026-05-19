"use client";

import { useEffect, useState } from "react";

import StackedList from "@/components/ui/stacked-list";
import { supabase } from "@/lib/supabase/client";
import type { ResumeSummary, RoasterLeaderboardEntry } from "@/lib/supabase/types";

export default function Leaderboard() {
  const [roasters, setRoasters] = useState<RoasterLeaderboardEntry[]>([]);
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadLeaderboard() {
      const started = Date.now();
      const [roasterResult, resumeResult] = await Promise.all([
        supabase.rpc("get_roaster_leaderboard", { limit_count: 10 }),
        supabase
          .from("resumes")
          .select("id,user_id,title,file_path,is_anonymous,status,roast_count,created_at")
          .order("roast_count", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (roasterResult.error) {
        setMessage("Run supabase/leaderboard.sql once in Supabase, then refresh this page.");
      } else {
        setRoasters(roasterResult.data ?? []);
      }

      if (!resumeResult.error) {
        setResumes(resumeResult.data ?? []);
      }

      const elapsed = Date.now() - started;
      window.setTimeout(() => setLoading(false), Math.max(0, 300 - elapsed));
    }

    void loadLeaderboard();
  }, []);

  if (loading) {
    return (
      <section className="leaderboard-grid">
        {[0, 1].map((panel) => (
          <div className="leaderboard-panel" key={panel}>
            <span className="skeleton skeleton-line title" />
            <span className="skeleton skeleton-line copy" />
            <span className="skeleton skeleton-line actions" />
          </div>
        ))}
      </section>
    );
  }

  return (
    <>
      <div className="pill-tabs leaderboard-tabs" aria-label="Leaderboard time range">
        <button className="active" type="button">This week</button>
        <button type="button">This month</button>
        <button type="button">All time</button>
      </div>

      <StackedList message={message} resumes={resumes} roasters={roasters} />
    </>
  );
}
