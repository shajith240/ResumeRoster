"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { ResumeSummary } from "@/lib/supabase/types";

export default function ResumeFeed() {
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadResumes() {
      const { data, error } = await supabase
        .from("resumes")
        .select("id,user_id,title,file_path,is_anonymous,status,roast_count,created_at")
        .order("created_at", { ascending: false });

      if (error) {
        setMessage(error.message);
      } else {
        setResumes(data ?? []);
      }

      setLoading(false);
    }

    void loadResumes();
  }, []);

  if (loading) {
    return <p className="muted-text">Loading public roast feed...</p>;
  }

  if (message) {
    return <p className="form-message">{message}</p>;
  }

  if (!resumes.length) {
    return (
      <div className="empty-state">
        <h2>No resumes yet</h2>
        <p>Be the first person brave enough to put a resume in the public roast pit.</p>
        <Link className="app-button" href="/submit">
          Submit a resume
        </Link>
      </div>
    );
  }

  return (
    <section className="community-feed" aria-label="Open resumes">
      <div className="feed-sortbar" aria-label="Feed sort">
        <span>Best</span>
        <span>New</span>
        <span>Most roasted</span>
      </div>
      {resumes.map((resume) => (
        <Link className="reddit-post-card" href={`/resume/${resume.id}`} key={resume.id}>
          <div className="vote-rail" aria-hidden="true">
            <span>▲</span>
            <strong>{resume.roast_count}</strong>
            <span>▼</span>
          </div>
          <div className="post-content">
            <div className="post-meta">
              <span>r/resumeroast</span>
              <span>posted anonymously</span>
              <time dateTime={resume.created_at}>
                {new Intl.DateTimeFormat("en", {
                  month: "short",
                  day: "numeric",
                }).format(new Date(resume.created_at))}
              </time>
            </div>
            <h2>{resume.title}</h2>
            <div className="post-actions">
              <span>{resume.roast_count} {resume.roast_count === 1 ? "roast" : "roasts"}</span>
              <span className={`resume-status ${resume.status === "closed" ? "closed" : ""}`}>
                {resume.status === "closed" ? "Closed" : "Open"}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </section>
  );
}
