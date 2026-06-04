"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FeedResumePreview from "@/components/FeedResumePreview";
import { toast } from "sonner";
import { BookmarkIcon } from "@/components/ui/bookmark";
import { EyeIcon } from "@/components/ui/eye";
import { LinkIcon } from "@/components/ui/link";
import { getLoginPath } from "@/lib/auth-redirect";
import {
	AUTH_SESSION_EXPIRED_MESSAGE,
	getSafeAuthErrorMessage,
	isAuthSessionError,
} from "@/lib/auth-errors";
import {
	getFreshAuthSession,
	refreshAuthSessionAfterError,
} from "@/lib/auth-session";
import { MessageCircleIcon } from "@/components/ui/message-circle";
import {
  getResumeAffiliationLabel,
  getResumePosterLabel,
  getResumeRoleLabel,
} from "@/lib/resume-display";
import {
  formatCount,
  mergeReviewCountsFromRows,
  sortResumes,
  withResumeDefaults,
  type FeedSort,
} from "@/lib/feed-ranking";
import {
  getSaveButtonState,
  getSavedResumeIds,
  isSavedResumeSchemaMissingError,
  mergeSavedResumeState,
  SAVED_RESUMES_UNAVAILABLE_MESSAGE,
  type SavedResumeReference,
} from "@/lib/saved-resumes";
import { supabase } from "@/lib/supabase/client";
import type { ResumeAuthorProfile, ResumeSummary } from "@/lib/supabase/types";

export type { FeedSort } from "@/lib/feed-ranking";

const RESUME_SELECT_WITH_CONTEXT =
  "id,user_id,title,file_path,is_anonymous,status,roast_count,read_count,job_description,post_description,created_at";
const RESUME_SELECT_WITH_READS =
  "id,user_id,title,file_path,is_anonymous,status,roast_count,read_count,created_at";
const RESUME_SELECT_BASE =
  "id,user_id,title,file_path,is_anonymous,status,roast_count,created_at";
const REVIEW_PREVIEW_SELECT_WITH_THREADS =
  "id,resume_id,parent_id,content,attachment_id,content_format,sticker_id,helpful_votes,is_deleted,created_at";
const REVIEW_PREVIEW_SELECT_BASE =
  "id,resume_id,content,helpful_votes,created_at";
const AUTHOR_PROFILE_SELECT_WITH_STATUS =
  "id,username,full_name,avatar_url,avatar_path,college,target_role,current_position,app_status";
const AUTHOR_PROFILE_SELECT_BASE =
  "id,username,full_name,avatar_url,college,target_role";
const FEED_PREVIEW_SIGNED_URL_TTL_SECONDS = 60 * 20;

type SavedResumeSummary = ResumeSummary & {
  is_saved: boolean;
};

type ReviewSignal = {
  className: "closed" | "hot" | "needs" | "open";
  label: string;
};

type ReviewPreviewRow = {
  id: string;
  resume_id: string;
  parent_id?: string | null;
  content: string;
  attachment_id?: string | null;
  content_format?: string | null;
  sticker_id?: string | null;
  helpful_votes: number;
  is_deleted?: boolean;
  created_at: string;
};

type ReviewPreview = {
  id: string;
  excerpt: string;
  label: string;
};

const ACTIONABLE_REVIEW_PATTERN =
  /\b(add|avoid|change|clarify|cut|drop|explain|fix|highlight|include|impact|improve|mention|metrics|move|proof|quantify|reduce|remove|replace|rewrite|show|shorten|specific|specify|tighten|use|vague|write)\b/i;
const GENERIC_REVIEW_PATTERN =
  /^(good|nice|great|ok|okay|cool|done|fine|thanks|thank you|looks good|good resume|good resume man|reviewed)$/i;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function getReviewSignal(resume: ResumeSummary): ReviewSignal {
  if (resume.status === "closed") {
    return { className: "closed", label: "Closed" };
  }

  if (resume.roast_count === 0) {
    return { className: "needs", label: "Needs first review" };
  }

  if (resume.roast_count > 5) {
    return { className: "hot", label: "Active discussion" };
  }

  return { className: "open", label: "Open for review" };
}

function cleanReviewExcerpt(content: string) {
  const normalized = content
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length <= 170) return normalized;

  return `${normalized.slice(0, 167).trim()}...`;
}

function isFeatureWorthyReview(excerpt: string) {
  const words = excerpt.match(/[a-z0-9]+/gi) ?? [];
  const normalized = excerpt.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();

  if (GENERIC_REVIEW_PATTERN.test(normalized)) return false;

  return (
    (words.length >= 4 && excerpt.length >= 24 && ACTIONABLE_REVIEW_PATTERN.test(excerpt)) ||
    (words.length >= 8 && excerpt.length >= 42)
  );
}

function getReviewPreview(row: ReviewPreviewRow): ReviewPreview | null {
  const hasMediaHint =
    Boolean(row.attachment_id) ||
    Boolean(row.sticker_id) ||
    /!\[[^\]]*]\([^)]+\)/.test(row.content);
  const excerpt = cleanReviewExcerpt(row.content);

  if (excerpt && isFeatureWorthyReview(excerpt)) {
    return {
      id: row.id,
      excerpt,
      label: hasMediaHint ? "Media note" : "Recent fix",
    };
  }

  if (hasMediaHint) {
    return {
      id: row.id,
      excerpt: "A reviewer added a media note. Open the thread to inspect the visual feedback.",
      label: "Media note",
    };
  }

  return null;
}

function getThreadPrompt(resume: ResumeSummary) {
  if (resume.roast_count > 0) {
    const commentLabel =
      resume.roast_count === 1
        ? "1 comment is"
        : `${formatCount(resume.roast_count)} comments are`;

    return `${commentLabel} in the thread. Open it to read the feedback.`;
  }

  if (resume.status === "closed") {
    return "This thread is closed, but the feedback is still useful to study.";
  }

  return "No reviews yet. Be the first to lint this resume.";
}

function getThreadActionLabel(resume: ResumeSummary) {
  if (resume.roast_count === 0) {
    return resume.status === "closed" ? "Thread" : "Review";
  }

  if (resume.roast_count > 5) {
    return "Fixes";
  }

  return resume.roast_count === 1 ? "Comment" : "Comments";
}

function getThreadActionAria(resume: ResumeSummary) {
  if (resume.roast_count === 0) {
    return resume.status === "closed"
      ? `Open closed thread for ${resume.title}`
      : `Review ${resume.title}`;
  }

  return `Open ${resume.roast_count} comments for ${resume.title}`;
}

function getReviewPreviewsByResumeId(rows: ReviewPreviewRow[]) {
  const previews = new Map<string, ReviewPreview>();
  const sortedRows = [...rows].sort(
    (a, b) =>
      (b.helpful_votes ?? 0) - (a.helpful_votes ?? 0) ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  for (const row of sortedRows) {
    if (row.is_deleted || row.parent_id) continue;
    if (previews.has(row.resume_id)) continue;

    const preview = getReviewPreview(row);
    if (!preview) continue;

    previews.set(row.resume_id, preview);
  }

  return Object.fromEntries(previews);
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

function isReviewPreviewFeatureError(error: { message?: string } | null) {
  return /parent_id|is_deleted|attachment_id|content_format|sticker_id|schema cache|column/i.test(
    error?.message ?? "",
  );
}

function isDuplicateSavedResumeError(error: { code?: string; message?: string } | null) {
  return error?.code === "23505" || /duplicate key|unique/i.test(error?.message ?? "");
}

const sortOptions: Array<{
  href: string;
  label: string;
  shortLabel?: string;
  value: FeedSort;
}> = [
  { href: "/feed", label: "Best", value: "best" },
  { href: "/feed?sort=new", label: "New", value: "new" },
  { href: "/feed?sort=top", label: "Top rated", shortLabel: "Top", value: "top" },
  {
    href: "/feed?sort=needs",
    label: "Needs review",
    shortLabel: "Needs",
    value: "needs",
  },
];

async function mergeLiveReviewCounts(resumeRows: ResumeSummary[]) {
  if (!resumeRows.length) return resumeRows;

  const activeReviewResult = await supabase
    .from("roasts")
    .select("resume_id")
    .in("resume_id", resumeRows.map((resume) => resume.id))
    .eq("is_deleted", false);

  const { data, error } =
    activeReviewResult.error && /is_deleted|schema cache|column/i.test(activeReviewResult.error.message)
      ? await supabase
          .from("roasts")
          .select("resume_id")
          .in("resume_id", resumeRows.map((resume) => resume.id))
      : activeReviewResult;

  if (error) return resumeRows;

  return mergeReviewCountsFromRows(resumeRows, data ?? []);
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

async function fetchSavedResumeIds(userId: string | null) {
  if (!userId) {
    return {
      savedResumeIds: new Set<string>(),
      schemaMissing: false,
      error: null,
    };
  }

  const { data, error } = await supabase
    .from("saved_resumes")
    .select("resume_id")
    .eq("user_id", userId);

  if (error) {
    return {
      savedResumeIds: new Set<string>(),
      schemaMissing: isSavedResumeSchemaMissingError(error),
      error,
    };
  }

  return {
    savedResumeIds: getSavedResumeIds((data ?? []) as SavedResumeReference[]),
    schemaMissing: false,
    error: null,
  };
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
            <span className="skeleton skeleton-line preview" />
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
  savedOnly?: boolean;
};

export default function ResumeFeed({ activeSort = "best", savedOnly = false }: ResumeFeedProps) {
  const [resumes, setResumes] = useState<SavedResumeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [previewUrlsById, setPreviewUrlsById] = useState<Record<string, string>>({});
  const [reviewPreviewsById, setReviewPreviewsById] = useState<Record<string, ReviewPreview>>({});
  const [previewUrlsLoading, setPreviewUrlsLoading] = useState(false);
  const [saveFeatureReady, setSaveFeatureReady] = useState(true);
  const [savingIds, setSavingIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let active = true;

    function finishLoading(started: number) {
      const elapsed = Date.now() - started;
      window.setTimeout(() => {
        if (active) {
          setLoading(false);
        }
      }, Math.max(0, 300 - elapsed));
    }

    async function loadResumes(retriedAfterAuthRefresh = false) {
      setLoading(true);
      setMessage("");
      const started = Date.now();
      const { session, error: sessionError } = await getFreshAuthSession();

      if (!active) return;

      if (sessionError || !session?.user) {
        setResumes([]);
        setMessage(AUTH_SESSION_EXPIRED_MESSAGE);
        finishLoading(started);
        return;
      }

      const user = session.user;
      const savedResult = await fetchSavedResumeIds(user?.id ?? null);
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
      setSaveFeatureReady(!savedResult.schemaMissing);

      if (resumeError) {
        if (
          isAuthSessionError(resumeError) &&
          !retriedAfterAuthRefresh &&
          (await refreshAuthSessionAfterError(resumeError))
        ) {
          if (active) await loadResumes(true);
          return;
        }

        setMessage(getSafeAuthErrorMessage(resumeError));
      } else {
        const rowsWithProfiles = await attachPublicAuthorProfiles(resumeRows);
        if (!active) return;
        const rowsWithLiveCounts = await mergeLiveReviewCounts(rowsWithProfiles);
        if (!active) return;
        if (savedResult.error && savedOnly) {
          if (
            isAuthSessionError(savedResult.error) &&
            !retriedAfterAuthRefresh &&
            (await refreshAuthSessionAfterError(savedResult.error))
          ) {
            if (active) await loadResumes(true);
            return;
          }

          setMessage(
            savedResult.schemaMissing
              ? SAVED_RESUMES_UNAVAILABLE_MESSAGE
              : getSafeAuthErrorMessage(savedResult.error),
          );
          setResumes([]);
        } else {
          const rowsWithSavedState = mergeSavedResumeState(
            rowsWithLiveCounts,
            savedResult.savedResumeIds,
          );
          const visibleRows = savedOnly
            ? rowsWithSavedState.filter((resume) => resume.is_saved)
            : rowsWithSavedState;
          setResumes(sortResumes(visibleRows, activeSort));
        }
      }

      finishLoading(started);
    }

    void loadResumes();
    return () => {
      active = false;
    };
  }, [activeSort, savedOnly]);

  const sortedResumes = useMemo(
    () => sortResumes(resumes, activeSort),
    [activeSort, resumes],
  );
  const previewTargets = useMemo(
    () =>
      sortedResumes.map((resume) => ({
        filePath: resume.file_path,
        id: resume.id,
      })),
    [sortedResumes],
  );
  const previewResumeIds = useMemo(
    () => sortedResumes.map((resume) => resume.id),
    [sortedResumes],
  );

  useEffect(() => {
    let active = true;

    async function loadPreviewUrls() {
      if (!previewTargets.length) {
        setPreviewUrlsById({});
        setPreviewUrlsLoading(false);
        return;
      }

      setPreviewUrlsLoading(true);

      const { data, error } = await supabase.storage
        .from("resumes")
        .createSignedUrls(
          previewTargets.map((resume) => resume.filePath),
          FEED_PREVIEW_SIGNED_URL_TTL_SECONDS,
        );

      if (!active) return;

      if (error) {
        setPreviewUrlsById({});
        setPreviewUrlsLoading(false);
        return;
      }

      const nextPreviewUrls = previewTargets.reduce<Record<string, string>>(
        (previewUrls, resume, index) => {
          const signedUrl = data?.[index]?.signedUrl;

          if (signedUrl) {
            previewUrls[resume.id] = signedUrl;
          }

          return previewUrls;
        },
        {},
      );

      setPreviewUrlsById(nextPreviewUrls);
      setPreviewUrlsLoading(false);
    }

    void loadPreviewUrls();

    return () => {
      active = false;
    };
  }, [previewTargets]);

  useEffect(() => {
    let active = true;

    async function loadReviewPreviews() {
      if (!previewResumeIds.length) {
        setReviewPreviewsById({});
        return;
      }

      const primaryResult = await supabase
        .from("roasts")
        .select(REVIEW_PREVIEW_SELECT_WITH_THREADS)
        .in("resume_id", previewResumeIds)
        .eq("is_deleted", false)
        .is("parent_id", null)
        .order("helpful_votes", { ascending: false })
        .order("created_at", { ascending: false });

      const previewResult =
        primaryResult.error && isReviewPreviewFeatureError(primaryResult.error)
          ? await supabase
              .from("roasts")
              .select(REVIEW_PREVIEW_SELECT_BASE)
              .in("resume_id", previewResumeIds)
              .order("helpful_votes", { ascending: false })
              .order("created_at", { ascending: false })
          : primaryResult;

      if (!active) return;

      if (previewResult.error) {
        setReviewPreviewsById({});
        return;
      }

      setReviewPreviewsById(
        getReviewPreviewsByResumeId((previewResult.data ?? []) as ReviewPreviewRow[]),
      );
    }

    void loadReviewPreviews();

    return () => {
      active = false;
    };
  }, [previewResumeIds]);

  async function shareResume(resume: ResumeSummary) {
    const url = `${window.location.origin}/resume/${resume.id}`;

    if (navigator.share) {
      await navigator.share({
        title: resume.title,
        text: "Lint this resume on Linted",
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

  function setResumeSaving(resumeId: string, isSaving: boolean) {
    setSavingIds((current) => {
      const next = new Set(current);
      if (isSaving) {
        next.add(resumeId);
      } else {
        next.delete(resumeId);
      }
      return next;
    });
  }

  async function toggleSavedResume(resume: SavedResumeSummary) {
    if (savingIds.has(resume.id)) return;

    if (!saveFeatureReady) {
      toast.error(SAVED_RESUMES_UNAVAILABLE_MESSAGE);
      return;
    }

    const { session, error: authError } = await getFreshAuthSession();
    const user = session?.user ?? null;

    if (authError || !user) {
      toast.error(
        isAuthSessionError(authError)
          ? AUTH_SESSION_EXPIRED_MESSAGE
          : "Sign in to save resumes.",
      );
      window.location.assign(
        getLoginPath(`${window.location.pathname}${window.location.search}`),
      );
      return;
    }

    const wasSaved = resume.is_saved;
    const nextSaved = !wasSaved;
    setResumeSaving(resume.id, true);
    setResumes((current) => {
      const next = current.map((row) =>
        row.id === resume.id ? { ...row, is_saved: nextSaved } : row,
      );

      return savedOnly && !nextSaved
        ? next.filter((row) => row.id !== resume.id)
        : next;
    });

    const result = nextSaved
      ? await supabase
          .from("saved_resumes")
          .insert({ user_id: user.id, resume_id: resume.id })
      : await supabase
          .from("saved_resumes")
          .delete()
          .eq("user_id", user.id)
          .eq("resume_id", resume.id);

    if (result.error && !(nextSaved && isDuplicateSavedResumeError(result.error))) {
      setResumes((current) => {
        if (savedOnly && !current.some((row) => row.id === resume.id)) {
          return sortResumes([...current, { ...resume, is_saved: wasSaved }], activeSort);
        }

        return current.map((row) =>
          row.id === resume.id ? { ...row, is_saved: wasSaved } : row,
        );
      });

      if (isSavedResumeSchemaMissingError(result.error)) {
        setSaveFeatureReady(false);
        toast.error(SAVED_RESUMES_UNAVAILABLE_MESSAGE);
      } else {
        toast.error("Could not update saved resumes.", {
          description: getSafeAuthErrorMessage(result.error),
        });
      }

      setResumeSaving(resume.id, false);
      return;
    }

    toast.success(nextSaved ? "Resume saved." : "Removed from saved resumes.");
    setResumeSaving(resume.id, false);
  }

  if (loading) {
    return <FeedSkeleton />;
  }

  if (message) {
    return <p className="form-message">{message}</p>;
  }

  if (!resumes.length) {
    if (savedOnly) {
      return (
        <div className="empty-state feed-empty-state">
          <h2>No saved resumes yet</h2>
          <p>Save resumes from the feed when you want to revisit their fixes later.</p>
          <Link className="btn-primary" href="/feed">
            Browse feed
          </Link>
        </div>
      );
    }

    return (
      <div className="empty-state feed-empty-state">
        <h2>No resumes yet</h2>
        <p>Be the first person brave enough to run a resume through the public lint pass.</p>
        <Link className="btn-primary" href="/submit">
          Submit a resume
        </Link>
      </div>
    );
  }

  return (
    <section className="community-feed stagger-children" aria-label={savedOnly ? "Saved resumes" : "Open resumes"}>
      <nav className="feed-sortbar pill-tabs" aria-label="Feed sort">
        {sortOptions.map((option) => (
          <Link
            aria-current={!savedOnly && activeSort === option.value ? "page" : undefined}
            className={!savedOnly && activeSort === option.value ? "active" : ""}
            href={option.href}
            key={option.value}
          >
            <span className="sort-label-full">{option.label}</span>
            <span className="sort-label-short">
              {option.shortLabel ?? option.label}
            </span>
          </Link>
        ))}
        <Link
          aria-current={savedOnly ? "page" : undefined}
          className={savedOnly ? "active" : ""}
          href="/feed?saved=1"
        >
          <span className="sort-label-full">Saved</span>
          <span className="sort-label-short">Saved</span>
        </Link>
      </nav>
      {sortedResumes.map((resume, index) => {
        const authorProfile = resume.author_profile ?? null;
        const posterLabel = getResumePosterLabel(resume, authorProfile);
        const isSaving = savingIds.has(resume.id);
        const saveButtonState = getSaveButtonState(resume.is_saved, isSaving);
        const reviewSignal = getReviewSignal(resume);
        const reviewPreview = reviewPreviewsById[resume.id];
        const threadActionLabel = getThreadActionLabel(resume);
        const snippet =
          resume.post_description?.trim() ||
          "Targeting recruiter screens with a resume that needs sharper bullets, clearer proof, and fewer weak first impressions.";

        return (
          <article className="resume-card" style={{ animationDelay: `${index * 50}ms` }} key={resume.id}>
            <div className="post-content">
              <div className="post-meta">
                <div className="post-meta-main">
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
                <span className={`feed-status-pill ${reviewSignal.className}`}>
                  {reviewSignal.label}
                </span>
              </div>
              <div className="feed-title-row">
                <Link className="post-title-link" href={`/resume/${resume.id}`}>
                  <h2>{resume.title}</h2>
                </Link>
              </div>

              <div className="post-tags">
                <span className="badge role-badge">
                  {getResumeRoleLabel(resume, authorProfile)}
                </span>
                <span className="badge neutral-badge">
                  {getResumeAffiliationLabel(resume, authorProfile)}
                </span>
              </div>

              <div className="feed-card-body">
                <div className="feed-review-summary">
                  <span className="feed-section-label">Review request</span>
                  <p className="feed-snippet">
                    {snippet}
                  </p>
                  <Link
                    className={`feed-thread-preview ${reviewPreview ? "has-review" : "needs-review"}`}
                    href={`/resume/${resume.id}`}
                  >
                    <span className="feed-thread-label">
                      {reviewPreview?.label ?? (resume.roast_count > 0 ? "Discussion started" : "Needs reviewer")}
                    </span>
                    <p>
                      {reviewPreview?.excerpt ?? getThreadPrompt(resume)}
                    </p>
                  </Link>
                </div>

                <Link
                  aria-label={`Open resume preview for ${resume.title}`}
                  className="feed-preview-link"
                  href={`/resume/${resume.id}`}
                >
                  <FeedResumePreview
                    fileUrl={previewUrlsById[resume.id]}
                    isLoading={previewUrlsLoading}
                    title={resume.title}
                  />
                </Link>
              </div>

              <div className="post-actions">
                <Link className="post-action-button" href={`/resume/${resume.id}`} aria-label={getThreadActionAria(resume)}>
                  <MessageCircleIcon className="post-action-icon" size={16} aria-hidden="true" />
                  {resume.roast_count > 0 ? (
                    <span className="post-action-count">
                      {formatCount(resume.roast_count)}
                    </span>
                  ) : null}
                  <span className="post-action-label">{threadActionLabel}</span>
                </Link>
                <button className="post-action-button copy-button" type="button" onClick={() => void shareResume(resume)} aria-label="Share resume">
                  <LinkIcon className="post-action-icon" size={16} aria-hidden="true" />
                  <span className="post-action-label">Share</span>
                  {copiedId === resume.id ? <em>Copied!</em> : null}
                </button>
                <button
                  aria-label={saveButtonState.ariaLabel}
                  aria-pressed={resume.is_saved}
                  className={`post-action-button save-button ${resume.is_saved ? "is-saved" : ""}`}
                  disabled={isSaving}
                  onClick={() => void toggleSavedResume(resume)}
                  type="button"
                >
                  <BookmarkIcon className="post-action-icon" size={16} aria-hidden="true" />
                  <span className="post-action-label">{saveButtonState.label}</span>
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
