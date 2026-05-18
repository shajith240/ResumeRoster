"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { ResumeSummary } from "@/lib/supabase/types";

export default function ResumeFeed() {
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
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
        const loadedResumes = data ?? [];
        setResumes(loadedResumes);

        const signedEntries = await Promise.all(
          loadedResumes.map(async (resume) => {
            const signed = await supabase.storage
              .from("resumes")
              .createSignedUrl(resume.file_path, 60 * 20);

            return [resume.id, signed.error ? "" : signed.data.signedUrl] as const;
          }),
        );

        setSignedUrls(Object.fromEntries(signedEntries));
      }

      setLoading(false);
    }

    void loadResumes();
  }, []);

  async function shareResume(resume: ResumeSummary) {
    const url = `${window.location.origin}/resume/${resume.id}`;

    if (navigator.share) {
      await navigator.share({
        title: resume.title,
        text: "Roast this resume on ResumeRoster",
        url,
      });
      return;
    }

    await navigator.clipboard.writeText(url);
  }

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
        <article className="reddit-post-card" key={resume.id}>
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
            <Link href={`/resume/${resume.id}`}>
              <h2>{resume.title}</h2>
            </Link>

            <Link className="feed-resume-preview" href={`/resume/${resume.id}`}>
              {signedUrls[resume.id] ? (
                <iframe title={`${resume.title} resume preview`} src={`${signedUrls[resume.id]}#toolbar=0&navpanes=0`} />
              ) : (
                <div className="resume-preview-fallback">Resume preview unavailable</div>
              )}
            </Link>

            <div className="post-actions reddit-actions">
              <div className="post-vote-pill" aria-label={`${resume.roast_count} post score`}>
                <button type="button" aria-label="Upvote resume">
                  ^
                </button>
                <strong>{resume.roast_count}</strong>
                <button type="button" aria-label="Downvote resume">
                  v
                </button>
              </div>
              <Link className="post-action-button" href={`/resume/${resume.id}`}>
                {resume.roast_count} {resume.roast_count === 1 ? "roast" : "roasts"}
              </Link>
              <button className="post-action-button" type="button" aria-label="React to resume">
                React
              </button>
              <button className="post-action-button" type="button" onClick={() => void shareResume(resume)}>
                Share
              </button>
              <span className={`resume-status ${resume.status === "closed" ? "closed" : ""}`}>
                {resume.status === "closed" ? "Closed" : "Open"}
              </span>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

