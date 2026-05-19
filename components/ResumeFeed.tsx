"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { supabase } from "@/lib/supabase/client";
import type { ResumeSummary } from "@/lib/supabase/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function roleFromTitle(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("data")) return "Data Analyst";
  if (lower.includes("product")) return "Product Manager";
  if (lower.includes("mba")) return "MBA";
  if (lower.includes("intern")) return "SDE Intern";
  return "Full-time SDE";
}

function FeedSkeleton() {
  return (
    <div className="feed-skeleton-list" aria-label="Loading feed">
      {[0, 1, 2].map((item) => (
        <article className="resume-card skeleton-card" key={item}>
          <div className="post-content">
            <span className="skeleton skeleton-line meta" />
            <span className="skeleton skeleton-line title" />
            <span className="skeleton skeleton-line tags" />
            <span className="skeleton skeleton-line copy" />
            <span className="skeleton skeleton-line actions" />
          </div>
        </article>
      ))}
    </div>
  );
}

export default function ResumeFeed() {
  const { showToast } = useToast();
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [copiedId, setCopiedId] = useState("");

  useEffect(() => {
    async function loadResumes() {
      const started = Date.now();
      const { data, error } = await supabase
        .from("resumes")
        .select("id,user_id,title,file_path,is_anonymous,status,roast_count,created_at")
        .order("created_at", { ascending: false });

      if (error) {
        setMessage(error.message);
      } else {
        setResumes(data ?? []);
      }

      const elapsed = Date.now() - started;
      window.setTimeout(() => setLoading(false), Math.max(0, 300 - elapsed));
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
      showToast("Share sheet opened.");
      return;
    }

    await navigator.clipboard.writeText(url);
    setCopiedId(resume.id);
    showToast("Link copied.");
    window.setTimeout(() => setCopiedId(""), 1400);
  }

  if (loading) {
    return <FeedSkeleton />;
  }

  if (message) {
    return <p className="form-message">{message}</p>;
  }

  if (!resumes.length) {
    return (
      <div className="empty-state">
        <h2>No resumes yet</h2>
        <p>Be the first person brave enough to put a resume in the public roast pit.</p>
        <Link className="btn-primary" href="/submit">
          Submit a resume
        </Link>
      </div>
    );
  }

  return (
    <section className="community-feed stagger-children" aria-label="Open resumes">
      <div className="feed-sortbar pill-tabs" aria-label="Feed sort">
        <button className="active" type="button">Best</button>
        <button type="button">New</button>
        <button type="button">Most Roasted</button>
      </div>
      {resumes.map((resume, index) => {
        const heated = resume.roast_count > 5;

        return (
          <article className="resume-card" style={{ animationDelay: `${index * 50}ms` }} key={resume.id}>
            <div className="post-content">
              <div className="post-meta">
                <span>r/resumeroast</span>
                <span>posted anonymously</span>
                <time dateTime={resume.created_at}>{formatDate(resume.created_at)}</time>
                <span>3 min read</span>
              </div>
              <Link className="post-title-link" href={`/resume/${resume.id}`}>
                <h2>{resume.title}</h2>
              </Link>

              <div className="post-tags">
                <span className="badge role-badge">{roleFromTitle(resume.title)}</span>
                <span className="badge neutral-badge">Anonymous college</span>
                <span className={`badge ${heated ? "badge-hot" : resume.status === "closed" ? "badge-closed" : "badge-open"}`}>
                  {heated ? "Heated" : resume.status === "closed" ? "Closed" : "Open"}
                </span>
              </div>

              <p className="feed-snippet">
                Targeting recruiter screens with a resume that needs sharper bullets,
                clearer proof, and fewer weak first impressions.
              </p>

              <div className="post-actions reddit-actions">
                <Link className="post-action-button" href={`/resume/${resume.id}`}>
                  <span aria-hidden="true">C</span>
                  {resume.roast_count} {resume.roast_count === 1 ? "Roast" : "Roasts"}
                </Link>
                <button className="post-action-button copy-button" type="button" onClick={() => void shareResume(resume)}>
                  <span aria-hidden="true">S</span>
                  Share
                  {copiedId === resume.id ? <em>Copied!</em> : null}
                </button>
                <button className="post-action-button" type="button">
                  <span aria-hidden="true">B</span>
                  Save
                </button>
                <span className={`resume-status ${resume.status === "closed" ? "closed" : ""}`}>
                  {resume.status === "closed" ? "Closed" : "Open for roasting"}
                </span>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
