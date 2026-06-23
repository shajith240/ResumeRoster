"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { supabase } from "@/lib/supabase/client";
import type { ResumeSummary } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import styles from "./ResumeQueueProgress.module.css";

type QueueResumeRow = Pick<
	ResumeSummary,
	| "activation_reviews_completed"
	| "activation_reviews_required"
	| "id"
	| "title"
>;

type QueueProgress = {
	completed: number;
	id: string;
	ratio: number;
	remaining: number;
	required: number;
	title: string;
};

type ResumeQueueProgressProps = {
	mobileChromeHidden: boolean;
	sidebarCollapsed: boolean;
	userId: string;
};

const QUEUE_PROGRESS_SELECT =
	"id,title,activation_reviews_required,activation_reviews_completed";
const REVIEW_FEED_HREF = "/feed?sort=needs";
const CELEBRATION_MS = 8000;

function toQueueProgress(row: QueueResumeRow): QueueProgress {
	const required = Math.max(row.activation_reviews_required ?? 2, 1);
	const completed = Math.min(
		Math.max(row.activation_reviews_completed ?? 0, 0),
		required,
	);
	const remaining = Math.max(required - completed, 0);

	return {
		completed,
		id: row.id,
		ratio: completed / required,
		remaining,
		required,
		title: row.title,
	};
}

function buildAriaLabel(progress: QueueProgress) {
	const remainingText =
		progress.remaining > 0
			? `${progress.remaining} more guided ${
					progress.remaining === 1 ? "review" : "reviews"
				} needed.`
			: "Your resume is ready to enter the feed.";

	return `Resume queue progress for ${progress.title}: ${progress.completed} of ${progress.required} guided reviews completed. ${remainingText}`;
}

function getCardState(completed: number, remaining: number): "start" | "progress" | "done" {
	if (remaining === 0) return "done";
	if (completed > 0) return "progress";
	return "start";
}

function getPriyaDialogue(completed: number, remaining: number, required: number): string {
	if (remaining === 0) return "You made it! Your resume is live in the feed right now!";
	if (completed === 0) {
		return `Do ${required} quick review${required === 1 ? "" : "s"} and I'll get yours up in the feed!`;
	}
	return remaining === 1
		? "Almost there, just one more review to go!"
		: `${remaining} more to go, you got this!`;
}

const PRIYA_IMAGES = [
	"/assets/priya-state1-forsidebar.png",
	"/assets/priya-state2-forsidebar.png",
	"/assets/priya-state3-forsidebar.png",
] as const;

function getPriyaImageSrc(completed: number, remaining: number): string {
	if (remaining === 0) return PRIYA_IMAGES[2];
	if (completed > 0) return PRIYA_IMAGES[1];
	return PRIYA_IMAGES[0];
}

const PROGRESS_CACHE_PREFIX = "rr_qp_";

function readCache(userId: string): QueueProgress | null {
	try {
		const raw = sessionStorage.getItem(PROGRESS_CACHE_PREFIX + userId);
		return raw ? (JSON.parse(raw) as QueueProgress) : null;
	} catch {
		return null;
	}
}

function writeCache(userId: string, p: QueueProgress | null) {
	try {
		if (p) {
			sessionStorage.setItem(PROGRESS_CACHE_PREFIX + userId, JSON.stringify(p));
		} else {
			sessionStorage.removeItem(PROGRESS_CACHE_PREFIX + userId);
		}
	} catch { /* sessionStorage unavailable (private browsing / SSR) */ }
}

function makeDoneProgress(id: string, title: string, required = 2): QueueProgress {
	return { completed: required, id, ratio: 1, remaining: 0, required, title };
}

export default function ResumeQueueProgress({
	mobileChromeHidden,
	sidebarCollapsed,
	userId,
}: ResumeQueueProgressProps) {
	const [progress, setProgress] = useState<QueueProgress | null>(() => readCache(userId));
	const [celebrating, setCelebrating] = useState(false);

	// Track whether a waiting resume was observed this session so we can
	// detect the waiting→active transition and show the celebration state.
	const wasWaitingRef = useRef(progress !== null);
	// Guard: only trigger celebration after the first query has resolved.
	// Without this, a stale cache entry would cause a spurious celebration on mount.
	const hasInitialLoadedRef = useRef(false);
	// Remember the last id/title/required for the celebration card after progress clears.
	const lastIdRef = useRef(progress?.id ?? "");
	const lastTitleRef = useRef(progress?.title ?? "");
	const lastRequiredRef = useRef(progress?.required ?? 2);

	useEffect(() => {
		PRIYA_IMAGES.forEach((src) => { new Image().src = src; });
	}, []);

	// Auto-dismiss celebration after CELEBRATION_MS
	useEffect(() => {
		if (!celebrating) return;
		const timer = window.setTimeout(() => setCelebrating(false), CELEBRATION_MS);
		return () => window.clearTimeout(timer);
	}, [celebrating]);

	useEffect(() => {
		let active = true;
		let refreshTimer: number | undefined;

		async function loadQueueProgress() {
			const { data, error } = await supabase
				.from("resumes")
				.select(QUEUE_PROGRESS_SELECT)
				.eq("user_id", userId)
				.eq("status", "open")
				.eq("review_queue_status", "waiting")
				.order("created_at", { ascending: true })
				.limit(1);

			if (!active) return;
			if (error) return;

			const waitingResume = (data ?? [])[0] as QueueResumeRow | undefined;

			if (!waitingResume) {
				// No waiting resume — may have just transitioned to active.
				if (wasWaitingRef.current && hasInitialLoadedRef.current) {
					setCelebrating(true);
				}
				wasWaitingRef.current = false;
				setProgress(null);
				writeCache(userId, null);
			} else {
				const next = toQueueProgress(waitingResume);
				wasWaitingRef.current = true;
				lastIdRef.current = next.id;
				lastTitleRef.current = next.title;
				lastRequiredRef.current = next.required;
				setProgress(next);
				writeCache(userId, next);
			}

			hasInitialLoadedRef.current = true;
		}

		function scheduleRefresh() {
			if (refreshTimer) window.clearTimeout(refreshTimer);
			refreshTimer = window.setTimeout(() => {
				void loadQueueProgress();
			}, 80);
		}

		function refreshOnFocus() {
			void loadQueueProgress();
		}

		function refreshOnVisibility() {
			if (document.visibilityState === "visible") void loadQueueProgress();
		}

		void loadQueueProgress();

		const channel = supabase
			.channel(`resume-queue-progress:${userId}`)
			.on(
				"postgres_changes",
				{
					event: "*",
					filter: `user_id=eq.${userId}`,
					schema: "public",
					table: "resumes",
				},
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(payload: any) => {
					const row = payload.new as Record<string, unknown> | null | undefined;

					if (row && (payload.eventType === "INSERT" || payload.eventType === "UPDATE")) {
						if (row.review_queue_status === "waiting" && row.status === "open") {
							// Instant optimistic update — no extra round-trip
							const next = toQueueProgress(row as unknown as QueueResumeRow);
							wasWaitingRef.current = true;
							lastIdRef.current = next.id;
							lastTitleRef.current = next.title;
							lastRequiredRef.current = next.required;
							setProgress(next);
							writeCache(userId, next);
						} else if (
							row.review_queue_status === "active" &&
							wasWaitingRef.current
						) {
							// Waiting → active detected via realtime: trigger celebration
							wasWaitingRef.current = false;
							setCelebrating(true);
							setProgress(null);
							writeCache(userId, null);
						}
					}

					// Background refresh to confirm server state
					scheduleRefresh();
				},
			)
			.subscribe();

		window.addEventListener("focus", refreshOnFocus);
		document.addEventListener("visibilitychange", refreshOnVisibility);

		return () => {
			active = false;
			if (refreshTimer) window.clearTimeout(refreshTimer);
			window.removeEventListener("focus", refreshOnFocus);
			document.removeEventListener("visibilitychange", refreshOnVisibility);
			void supabase.removeChannel(channel);
		};
	}, [userId]);

	// When celebrating, synthesise a "done" progress so the done card renders.
	const displayProgress = celebrating
		? makeDoneProgress(lastIdRef.current, lastTitleRef.current, lastRequiredRef.current)
		: progress;

	const progressStyle = useMemo(
		() =>
			({
				"--queue-progress-ratio": displayProgress?.ratio ?? 0,
			}) as CSSProperties,
		[displayProgress?.ratio],
	);

	if (!displayProgress) return null;

	// Waiting: open the resume so the user can review or delete it.
	// Active/celebrating: open the live resume.
	const resumeHref = displayProgress.id
		? `/resume/${displayProgress.id}`
		: REVIEW_FEED_HREF;

	const remainingLabel =
		displayProgress.remaining > 0
			? `${displayProgress.remaining} more to go`
			: "You're in the feed!";
	const ariaLabel = buildAriaLabel(displayProgress);
	const dialogue = getPriyaDialogue(
		displayProgress.completed,
		displayProgress.remaining,
		displayProgress.required,
	);
	const priyaSrc = getPriyaImageSrc(displayProgress.completed, displayProgress.remaining);
	const dialogueKey = `${displayProgress.completed}-${displayProgress.remaining}`;
	const cardState = getCardState(displayProgress.completed, displayProgress.remaining);

	return (
		<>
			{sidebarCollapsed ? null : (
				<Link
					aria-label={ariaLabel}
					className={styles.desktopShell}
					href={resumeHref}
					style={progressStyle}
				>
					<img
						src={priyaSrc}
						alt=""
						aria-hidden="true"
						className={styles.priyaImg}
					/>
					<span className={styles.card} data-state={cardState}>
						<span className={styles.content}>
							<p className={styles.dialogue} key={dialogueKey}>
								{dialogue}
							</p>
							<span className={styles.metaRow}>
								<span className={styles.kicker}>Queue credits</span>
								<strong className={styles.count}>
									{displayProgress.completed}/{displayProgress.required}
								</strong>
							</span>
						</span>
						<span className={styles.bottomBar} aria-hidden="true">
							<span className={styles.bottomBarFill} />
						</span>
					</span>
				</Link>
			)}

			<Link
				aria-label={ariaLabel}
				className={cn(
					styles.mobileShell,
					mobileChromeHidden && styles.mobileShellHidden,
				)}
				href={resumeHref}
				style={progressStyle}
			>
				<img
					src={priyaSrc}
					alt=""
					aria-hidden="true"
					className={styles.mobilePriyaImg}
				/>
				<span className={styles.mobileCard} data-state={cardState}>
					<span className={styles.mobileText}>
						<span className={styles.kicker}>Queue credits</span>
						<span className={styles.caption}>{remainingLabel}</span>
					</span>
					<strong className={styles.count}>
						{displayProgress.completed}/{displayProgress.required}
					</strong>
					<span className={styles.mobileBar} aria-hidden="true">
						<span className={styles.barValue} />
					</span>
				</span>
			</Link>
		</>
	);
}
