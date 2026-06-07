"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import {
	isPublicFeedResume,
	sortResumes,
	type FeedSort,
} from "@/lib/feed-ranking";
import {
  isSavedResumeSchemaMissingError,
  mergeSavedResumeState,
  SAVED_RESUMES_UNAVAILABLE_MESSAGE,
} from "@/lib/saved-resumes";
import { supabase } from "@/lib/supabase/client";
import type { ResumeSummary } from "@/lib/supabase/types";
import {
	FeedEmptyState,
	FeedSkeleton,
	FeedSortBar,
	ResumeFeedCard,
} from "./resume-feed/presentation";
import {
  attachPublicAuthorProfiles,
  FEED_PREVIEW_SIGNED_URL_TTL_SECONDS,
  fetchSavedResumeIds,
  getReviewPreviewsByResumeId,
  isDuplicateSavedResumeError,
  isReadCountFeatureError,
  isResumeContextFeatureError,
  isReviewPreviewFeatureError,
  mergeLiveReviewCounts,
  RESUME_SELECT_BASE,
  RESUME_SELECT_WITH_CONTEXT,
  RESUME_SELECT_WITH_READS,
  REVIEW_PREVIEW_SELECT_BASE,
  REVIEW_PREVIEW_SELECT_WITH_THREADS,
  withResumeDefaults,
  type ReviewPreview,
  type ReviewPreviewRow,
  type SavedResumeSummary,
} from "./resume-feed/data";

export type { FeedSort } from "@/lib/feed-ranking";

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
        .select(RESUME_SELECT_WITH_CONTEXT)
        .eq("review_queue_status", "active");

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
          const visibleRows = rowsWithSavedState.filter(
            (resume) => isPublicFeedResume(resume) && (!savedOnly || resume.is_saved),
          );
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
    return <FeedEmptyState savedOnly={savedOnly} />;
  }

  return (
    <section className="community-feed stagger-children" aria-label={savedOnly ? "Saved resumes" : "Open resumes"}>
      <FeedSortBar activeSort={activeSort} savedOnly={savedOnly} />
      {sortedResumes.map((resume, index) => (
        <ResumeFeedCard
          copiedId={copiedId}
          index={index}
          isSaving={savingIds.has(resume.id)}
          key={resume.id}
          onShare={(targetResume) => {
            void shareResume(targetResume);
          }}
          onToggleSaved={(targetResume) => {
            void toggleSavedResume(targetResume);
          }}
          previewUrl={previewUrlsById[resume.id]}
          previewUrlsLoading={previewUrlsLoading}
          resume={resume}
          reviewPreview={reviewPreviewsById[resume.id]}
        />
      ))}
    </section>
  );
}
