"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BookmarkIcon } from "@/components/ui/bookmark";
import { EyeIcon } from "@/components/ui/eye";
import { LinkIcon } from "@/components/ui/link";
import { MessageCircleIcon } from "@/components/ui/message-circle";
import {
  getResumeAffiliationLabel,
  getResumePosterLabel,
  getResumeRoleLabel,
} from "@/lib/resume-display";
import { supabase } from "@/lib/supabase/client";
import type { ResumeAuthorProfile, ResumeSummary } from "@/lib/supabase/types";

const RESUME_SELECT_WITH_CONTEXT =
  "id,user_id,title,file_path,is_anonymous,status,roast_count,read_count,job_description,post_description,created_at";
const RESUME_SELECT_WITH_READS =
  "id,user_id,title,file_path,is_anonymous,status,roast_count,read_count,created_at";
const RESUME_SELECT_BASE =
  "id,user_id,title,file_path,is_anonymous,status,roast_count,created_at";
const AUTHOR_PROFILE_SELECT_WITH_STATUS =
  "id,username,full_name,avatar_url,avatar_path,college,target_role,current_position,app_status";
const AUTHOR_PROFILE_SELECT_BASE =
  "id,username,full_name,avatar_url,college,target_role";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatCount(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  }

  return value.toLocaleString();
}

function isReadCountFeatureError(error: { message?: string } | null) {
  return /read_count|schema cache|column/i.test(error?.message ?? "");
}

function isResumeContextFeatureError(error: { message?: string } | null) {
  return /job_description|post_description|read_count|schema cache|column/i.test(
    error?.message ?? "",
  );
}

function isAuthorProfileFeatureError(error: { message?: string } | null) {
  return /app_status|current_position|avatar_path|schema cache|column/i.test(
    error?.message ?? "",
  );
}

function withResumeDefaults(
  resume: Omit<
    ResumeSummary,
    "read_count" | "job_description" | "post_description"
  > &
    Partial<
      Pick<ResumeSummary, "read_count" | "job_description" | "post_description">
    >,
): ResumeSummary {
  return {
    ...resume,
    read_count: resume.read_count ?? 0,
    job_description: resume.job_description ?? null,
    post_description: resume.post_description ?? null,
  };
}

export type FeedSort = "best" | "new" | "top";

const sortOptions: Array<{ href: string; label: string; value: FeedSort }> = [
  { href: "/feed", label: "Best", value: "best" },
  { href: "/feed?sort=new", label: "New", value: "new" },
  { href: "/feed?sort=top", label: "Top rated", value: "top" },
];

function getBestScore(resume: ResumeSummary) {
  const ageHours = Math.max(
    1,
    (Date.now() - new Date(resume.created_at).getTime()) / 3_600_000,
  );

  return resume.roast_count * 8 + 48 / Math.pow(ageHours + 2, 1.2);
}

function sortResumes(resumes: ResumeSummary[], sort: FeedSort) {
  return [...resumes].sort((a, b) => {
    if (sort === "new") {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }

    if (sort === "top") {
      return (
        b.roast_count - a.roast_count ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    return (
      getBestScore(b) - getBestScore(a) ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });
}

async function mergeLiveRoastCounts(resumeRows: ResumeSummary[]) {
  if (!resumeRows.length) return resumeRows;

  const activeRoastResult = await supabase
    .from("roasts")
    .select("resume_id")
    .in("resume_id", resumeRows.map((resume) => resume.id))
    .eq("is_deleted", false);

  const { data, error } =
    activeRoastResult.error && /is_deleted|schema cache|column/i.test(activeRoastResult.error.message)
      ? await supabase
          .from("roasts")
          .select("resume_id")
          .in("resume_id", resumeRows.map((resume) => resume.id))
      : activeRoastResult;

  if (error) return resumeRows;

  const countsByResume = new Map<string, number>();
  for (const roast of data ?? []) {
    countsByResume.set(
      roast.resume_id,
      (countsByResume.get(roast.resume_id) ?? 0) + 1,
    );
  }

  return resumeRows.map((resume) => ({
    ...resume,
    roast_count: countsByResume.get(resume.id) ?? 0,
  }));
}

async function fetchPublicAuthorProfiles(resumeRows: ResumeSummary[]) {
  const authorIds = Array.from(
    new Set(
      resumeRows
        .filter((resume) => !resume.is_anonymous)
        .map((resume) => resume.user_id),
    ),
  );

  if (!authorIds.length) return new Map<string, ResumeAuthorProfile>();

  const primaryResult = await supabase
    .from("profiles")
    .select(AUTHOR_PROFILE_SELECT_WITH_STATUS)
    .in("id", authorIds);

  let profileRows = (primaryResult.data ?? []) as ResumeAuthorProfile[];
  let profileError = primaryResult.error;

  if (profileError && isAuthorProfileFeatureError(profileError)) {
    const fallbackResult = await supabase
      .from("profiles")
      .select(AUTHOR_PROFILE_SELECT_BASE)
      .in("id", authorIds);

    profileRows = (fallbackResult.data ?? []) as ResumeAuthorProfile[];
    profileError = fallbackResult.error;
  }

  if (profileError) return new Map<string, ResumeAuthorProfile>();

  return new Map(profileRows.map((profile) => [profile.id, profile]));
}

async function attachPublicAuthorProfiles(resumeRows: ResumeSummary[]) {
  const profilesById = await fetchPublicAuthorProfiles(resumeRows);

  if (!profilesById.size) return resumeRows;

  return resumeRows.map((resume) => ({
    ...resume,
    author_profile: resume.is_anonymous
      ? null
      : profilesById.get(resume.user_id) ?? null,
  }));
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

type ResumeFeedProps = {
  activeSort?: FeedSort;
};

export default function ResumeFeed({ activeSort = "best" }: ResumeFeedProps) {
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [copiedId, setCopiedId] = useState("");

  useEffect(() => {
    let active = true;

    async function loadResumes() {
      setLoading(true);
      setMessage("");
      const started = Date.now();
      let query = supabase
        .from("resumes")
        .select(RESUME_SELECT_WITH_CONTEXT);

      if (activeSort === "top") {
        query = query
          .order("roast_count", { ascending: false })
          .order("created_at", { ascending: false });
      } else {
        query = query.order("created_at", { ascending: false });
      }

      const { data, error } = await query;

      let resumeRows = (data ?? []).map(withResumeDefaults);
      let resumeError = error;

      if (error && isResumeContextFeatureError(error)) {
        let fallbackQuery = supabase
          .from("resumes")
          .select(RESUME_SELECT_WITH_READS);

        if (activeSort === "top") {
          fallbackQuery = fallbackQuery
            .order("roast_count", { ascending: false })
            .order("created_at", { ascending: false });
        } else {
          fallbackQuery = fallbackQuery.order("created_at", { ascending: false });
        }

        const fallbackResult = await fallbackQuery;
        resumeRows = (fallbackResult.data ?? []).map(withResumeDefaults);
        resumeError = fallbackResult.error;

        if (fallbackResult.error && isReadCountFeatureError(fallbackResult.error)) {
          let baseQuery = supabase
            .from("resumes")
            .select(RESUME_SELECT_BASE);

          if (activeSort === "top") {
            baseQuery = baseQuery
              .order("roast_count", { ascending: false })
              .order("created_at", { ascending: false });
          } else {
            baseQuery = baseQuery.order("created_at", { ascending: false });
          }

          const baseResult = await baseQuery;
          resumeRows = (baseResult.data ?? []).map(withResumeDefaults);
          resumeError = baseResult.error;
        }
      }

      if (!active) return;

      if (resumeError) {
        setMessage(resumeError.message);
      } else {
        const rowsWithProfiles = await attachPublicAuthorProfiles(resumeRows);
        if (!active) return;
        const rowsWithLiveCounts = await mergeLiveRoastCounts(rowsWithProfiles);
        if (!active) return;
        setResumes(sortResumes(rowsWithLiveCounts, activeSort));
      }

      const elapsed = Date.now() - started;
      window.setTimeout(() => {
        if (active) {
          setLoading(false);
        }
      }, Math.max(0, 300 - elapsed));
    }

    void loadResumes();
    return () => {
      active = false;
    };
  }, [activeSort]);

  const sortedResumes = useMemo(
    () => sortResumes(resumes, activeSort),
    [activeSort, resumes],
  );

  async function shareResume(resume: ResumeSummary) {
    const url = `${window.location.origin}/resume/${resume.id}`;

    if (navigator.share) {
      await navigator.share({
        title: resume.title,
        text: "Roast this resume on ResumeRoster",
        url,
      });
      toast.success("Share sheet opened.");
      return;
    }

    await navigator.clipboard.writeText(url);
    setCopiedId(resume.id);
    toast.success("Link copied.");
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
      <div className="empty-state feed-empty-state">
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
      <nav className="feed-sortbar pill-tabs" aria-label="Feed sort">
        {sortOptions.map((option) => (
          <Link
            aria-current={activeSort === option.value ? "page" : undefined}
            className={activeSort === option.value ? "active" : ""}
            href={option.href}
            key={option.value}
          >
            {option.label}
          </Link>
        ))}
      </nav>
      {sortedResumes.map((resume, index) => {
        const heated = resume.roast_count > 5;
        const authorProfile = resume.author_profile ?? null;
        const posterLabel = getResumePosterLabel(resume, authorProfile);
        const snippet =
          resume.post_description?.trim() ||
          "Targeting recruiter screens with a resume that needs sharper bullets, clearer proof, and fewer weak first impressions.";

        return (
          <article className="resume-card" style={{ animationDelay: `${index * 50}ms` }} key={resume.id}>
            <div className="post-content">
              <div className="post-meta">
                {resume.is_anonymous ? (
                  <span>{posterLabel}</span>
                ) : (
                  <Link className="post-author-link" href={`/profile/${resume.user_id}`}>
                    {posterLabel}
                  </Link>
                )}
                <time dateTime={resume.created_at}>{formatDate(resume.created_at)}</time>
                <span className="post-read-count">
                  <EyeIcon className="post-meta-icon" size={15} aria-hidden="true" />
                  {formatCount(resume.read_count)} reads
                </span>
              </div>
              <Link className="post-title-link" href={`/resume/${resume.id}`}>
                <h2>{resume.title}</h2>
              </Link>

              <div className="post-tags">
                <span className="badge role-badge">
                  {getResumeRoleLabel(resume, authorProfile)}
                </span>
                <span className="badge neutral-badge">
                  {getResumeAffiliationLabel(resume, authorProfile)}
                </span>
                <span className={`badge ${heated ? "badge-hot" : resume.status === "closed" ? "badge-closed" : "badge-open"}`}>
                  {heated ? "Heated" : resume.status === "closed" ? "Closed" : "Open"}
                </span>
              </div>

              <p className="feed-snippet">
                {snippet}
              </p>

              <div className="post-actions">
                <Link className="post-action-button" href={`/resume/${resume.id}`} aria-label={`Open ${resume.roast_count} roasts`}>
                  <MessageCircleIcon className="post-action-icon" size={16} aria-hidden="true" />
                  {formatCount(resume.roast_count)} {resume.roast_count === 1 ? "Roast" : "Roasts"}
                </Link>
                <button className="post-action-button copy-button" type="button" onClick={() => void shareResume(resume)} aria-label="Share resume">
                  <LinkIcon className="post-action-icon" size={16} aria-hidden="true" />
                  Share
                  {copiedId === resume.id ? <em>Copied!</em> : null}
                </button>
                <button className="post-action-button" type="button" aria-label="Save resume">
                  <BookmarkIcon className="post-action-icon" size={16} aria-hidden="true" />
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
