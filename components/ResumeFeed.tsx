"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { getLoginPath } from "@/lib/auth-redirect";
import {
	AUTH_SESSION_EXPIRED_MESSAGE,
	getSafeAuthErrorMessage,
	isAuthSessionError,
} from "@/lib/auth-errors";
import { getFreshAuthSession } from "@/lib/auth-session";
import { sortResumes, type FeedSort } from "@/lib/feed-ranking";
import {
	isSavedResumeSchemaMissingError,
	SAVED_RESUMES_UNAVAILABLE_MESSAGE,
	type SaveButtonPendingAction,
} from "@/lib/saved-resumes";
import { supabase } from "@/lib/supabase/client";
import type { ResumeSummary } from "@/lib/supabase/types";
import {
	FeedEmptyState,
	FeedSkeleton,
	FeedSortBar,
	ResumeFeedCard,
} from "./resume-feed/presentation";
import { isDuplicateSavedResumeError } from "./resume-feed/data";
import { loadFeedPage, FEED_PAGE_SIZE, type FeedPage } from "./resume-feed/feed-loader";

export type { FeedSort } from "@/lib/feed-ranking";

type ResumeFeedProps = {
	activeSort?: FeedSort;
	savedOnly?: boolean;
};

export default function ResumeFeed({
	activeSort = "best",
	savedOnly = false,
}: ResumeFeedProps) {
	const [copiedId, setCopiedId] = useState("");
	// Optimistic overrides for save-toggle; falls back to server state once query refetches
	const [savedOverrides, setSavedOverrides] = useState<Record<string, boolean>>({});
	const [saveFeatureReady, setSaveFeatureReady] = useState(true);
	const [savingActions, setSavingActions] = useState<
		Record<string, SaveButtonPendingAction>
	>({});

	const {
		data,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isLoading,
	} = useInfiniteQuery({
		queryKey: ["feed", activeSort, savedOnly],
		queryFn: ({ pageParam }: { pageParam: number }) =>
			loadFeedPage(pageParam, activeSort, savedOnly),
		initialPageParam: 0,
		getNextPageParam: (lastPage: FeedPage, _allPages: FeedPage[], lastPageParam: number) =>
			lastPage.hasMore ? lastPageParam + FEED_PAGE_SIZE : undefined,
	});

	const pages = data?.pages ?? [];
	const authErrorMessage = pages[0]?.authErrorMessage;

	// Single-pass memo: merge all pages, apply optimistic save overrides, then sort
	const allResumes = useMemo(() => {
		const merged = pages
			.flatMap((p) => p.resumes)
			.map((r) => ({
				...r,
				is_saved: savedOverrides[r.id] ?? r.is_saved,
			}))
			.filter((r) => !savedOnly || (savedOverrides[r.id] ?? r.is_saved));
		return sortResumes(merged, activeSort);
	}, [pages, activeSort, savedOverrides, savedOnly]);

	const previewUrlsById = useMemo(
		() => Object.assign({} as Record<string, string>, ...pages.map((p) => p.signedUrls)),
		[pages],
	);

	const reviewPreviewsById = useMemo(
		() => Object.assign({}, ...pages.map((p) => p.reviewPreviews)),
		[pages],
	);

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

	function setResumeSaving(
		resumeId: string,
		pendingAction: SaveButtonPendingAction | null,
	) {
		setSavingActions((current) => {
			const next = { ...current };
			if (pendingAction) {
				next[resumeId] = pendingAction;
			} else {
				delete next[resumeId];
			}
			return next;
		});
	}

	async function toggleSavedResume(
		resume: (typeof allResumes)[number],
	) {
		if (savingActions[resume.id]) return;

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
		const pendingAction: SaveButtonPendingAction = nextSaved ? "save" : "remove";

		setResumeSaving(resume.id, pendingAction);
		setSavedOverrides((prev) => ({ ...prev, [resume.id]: nextSaved }));

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
			// Rollback optimistic override
			setSavedOverrides((prev) => ({ ...prev, [resume.id]: wasSaved }));

			if (isSavedResumeSchemaMissingError(result.error)) {
				setSaveFeatureReady(false);
				toast.error(SAVED_RESUMES_UNAVAILABLE_MESSAGE);
			} else {
				toast.error("Could not update saved resumes.", {
					description: getSafeAuthErrorMessage(result.error),
				});
			}
		} else {
			toast.success(nextSaved ? "Resume saved." : "Removed from saved resumes.");
		}

		setResumeSaving(resume.id, null);
	}

	if (isLoading) {
		return <FeedSkeleton />;
	}

	if (authErrorMessage) {
		return <p className="form-message">{authErrorMessage}</p>;
	}

	if (!allResumes.length) {
		return <FeedEmptyState savedOnly={savedOnly} />;
	}

	return (
		<section
			className="resume-feed-list stagger-children"
			aria-label={savedOnly ? "Saved resumes" : "Open resumes"}
		>
			<FeedSortBar activeSort={activeSort} savedOnly={savedOnly} />
			{allResumes.map((resume, index) => (
				<ResumeFeedCard
					copiedId={copiedId}
					index={index}
					key={resume.id}
					onShare={(targetResume) => {
						void shareResume(targetResume);
					}}
					onToggleSaved={(targetResume) => {
						void toggleSavedResume(targetResume);
					}}
					previewUrl={previewUrlsById[resume.id]}
					previewUrlsLoading={false}
					resume={resume}
					reviewPreview={reviewPreviewsById[resume.id]}
					savePendingAction={savingActions[resume.id] ?? null}
				/>
			))}
			{(hasNextPage || isFetchingNextPage) && (
				<div className="feed-load-more">
					<button
						className="btn-primary btn-ghost"
						disabled={isFetchingNextPage}
						onClick={() => void fetchNextPage()}
						type="button"
					>
						{isFetchingNextPage ? "Loading…" : "Load more resumes"}
					</button>
				</div>
			)}
		</section>
	);
}
