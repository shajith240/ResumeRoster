"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { ResumeSummary, RoasterLeaderboardEntry } from "@/lib/supabase/types";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

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

      <section className="leaderboard-grid">
        <div className="leaderboard-panel">
          <div className="leaderboard-panel-header">
            <span>Top roasters</span>
            <p>Ranked by helpful votes</p>
          </div>

          {message ? <p className="form-message">{message}</p> : null}

          <div className="rank-list">
            {roasters.map((roaster, index) => {
              const name = roaster.username || "Anonymous roaster";
              return (
                <Link className="rank-row roaster-row" href={`/profile/${roaster.id}`} style={{ animationDelay: `${index * 100}ms` }} key={roaster.id}>
                  <strong>{index + 1}</strong>
                  <span className="rank-avatar">{initials(name)}</span>
                  <div>
                    <h2>{name}</h2>
                    <p>{[roaster.target_role, roaster.college].filter(Boolean).join(" · ") || "Community reviewer"}</p>
                  </div>
                  <em>{roaster.helpful_votes} votes</em>
                </Link>
              );
            })}
            {!roasters.length && !message ? (
              <div className="leaderboard-empty">
                <span className="empty-icon">#</span>
                <strong>No roasters yet</strong>
                <p>First useful roast gets the board moving.</p>
                <Link href="/feed">Be the first roaster -&gt;</Link>
              </div>
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
              <Link className="rank-row resume-rank-row" href={`/resume/${resume.id}`} style={{ animationDelay: `${index * 100}ms` }} key={resume.id}>
                <strong>{index + 1}</strong>
                <div>
                  <h2>{resume.title}</h2>
                  <p>
                    <span className={`badge ${resume.status === "closed" ? "badge-closed" : "badge-open"}`}>
                      {resume.status === "closed" ? "Closed" : "Open"}
                    </span>
                    {new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(resume.created_at))}
                  </p>
                </div>
                <em>{resume.roast_count} roasts{resume.roast_count > 5 ? " Hot" : ""}</em>
              </Link>
            ))}
            {!resumes.length ? (
              <div className="leaderboard-empty">
                <span className="empty-icon">R</span>
                <strong>No resume threads yet</strong>
                <p>Submit one and start the first public roast.</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
