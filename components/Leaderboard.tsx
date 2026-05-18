"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { ResumeSummary, RoasterLeaderboardEntry } from "@/lib/supabase/types";

export default function Leaderboard() {
  const [roasters, setRoasters] = useState<RoasterLeaderboardEntry[]>([]);
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadLeaderboard() {
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
        setMessage(
          "Run supabase/leaderboard.sql once in Supabase, then refresh this page.",
        );
      } else {
        setRoasters(roasterResult.data ?? []);
      }

      if (!resumeResult.error) {
        setResumes(resumeResult.data ?? []);
      }

      setLoading(false);
    }

    void loadLeaderboard();
  }, []);

  if (loading) {
    return <p className="muted-text">Loading leaderboard...</p>;
  }

  return (
    <section className="leaderboard-layout">
      <div className="leaderboard-panel">
        <div className="leaderboard-panel-header">
          <span>Top roasters</span>
          <p>Ranked by helpful votes</p>
        </div>

        {message ? <p className="form-message">{message}</p> : null}

        <div className="rank-list">
          {roasters.map((roaster, index) => (
            <Link className="rank-row" href={`/profile/${roaster.id}`} key={roaster.id}>
              <strong>{index + 1}</strong>
              <div>
                <h2>{roaster.username || "Anonymous roaster"}</h2>
                <p>{[roaster.target_role, roaster.college].filter(Boolean).join(" - ") || "Community reviewer"}</p>
              </div>
              <span>{roaster.helpful_votes} helpful</span>
            </Link>
          ))}
          {!roasters.length && !message ? (
            <p className="muted-text">No roasters yet. First useful roast gets the board moving.</p>
          ) : null}
        </div>
      </div>

      <div className="leaderboard-panel">
        <div className="leaderboard-panel-header">
          <span>Most roasted resumes</span>
          <p>Threads attracting the most feedback</p>
        </div>

        <div className="rank-list">
          {resumes.map((resume, index) => (
            <Link className="rank-row" href={`/resume/${resume.id}`} key={resume.id}>
              <strong>{index + 1}</strong>
              <div>
                <h2>{resume.title}</h2>
                <p>{resume.status === "closed" ? "Closed roast" : "Open roast"}</p>
              </div>
              <span>{resume.roast_count} roasts</span>
            </Link>
          ))}
          {!resumes.length ? (
            <p className="muted-text">No resume threads yet. Submit one and start the first public roast.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
