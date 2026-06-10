"use client";

import Link from "next/link";
import { ListChecks } from "@/components/ui/solar-icons";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "@/lib/supabase/client";
import type { ResumeSummary } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import styles from "./ResumeQueueProgress.module.css";

type QueueResumeRow = Pick<
	ResumeSummary,
	| "activation_reviews_completed"
	| "activation_reviews_required"
	| "title"
>;

type QueueProgress = {
	completed: number;
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
	"title,activation_reviews_required,activation_reviews_completed";
const REVIEW_FEED_HREF = "/feed?sort=needs";

function toQueueProgress(row: QueueResumeRow): QueueProgress {
	const required = Math.max(row.activation_reviews_required ?? 2, 1);
	const completed = Math.min(
		Math.max(row.activation_reviews_completed ?? 0, 0),
		required,
	);
	const remaining = Math.max(required - completed, 0);

	return {
		completed,
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

export default function ResumeQueueProgress({
	mobileChromeHidden,
	sidebarCollapsed,
	userId,
}: ResumeQueueProgressProps) {
	const [progress, setProgress] = useState<QueueProgress | null>(null);

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

			if (error) {
				setProgress(null);
				return;
			}

			const waitingResume = (data ?? [])[0] as QueueResumeRow | undefined;
			setProgress(waitingResume ? toQueueProgress(waitingResume) : null);
		}

		function scheduleRefresh() {
			if (refreshTimer) window.clearTimeout(refreshTimer);
			refreshTimer = window.setTimeout(() => {
				void loadQueueProgress();
			}, 120);
		}

		function refreshOnFocus() {
			void loadQueueProgress();
		}

		function refreshOnVisibility() {
			if (document.visibilityState === "visible") {
				void loadQueueProgress();
			}
		}

		setProgress(null);
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
				scheduleRefresh,
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

	const progressStyle = useMemo(
		() =>
			({
				"--queue-progress-ratio": progress?.ratio ?? 0,
			}) as CSSProperties,
		[progress?.ratio],
	);

	if (!progress) return null;

	const remainingLabel =
		progress.remaining > 0
			? `${progress.remaining} ${progress.remaining === 1 ? "review" : "reviews"} left`
			: "Ready for feed";
	const ariaLabel = buildAriaLabel(progress);

	return (
		<>
			{sidebarCollapsed ? null : (
				<Link
					aria-label={ariaLabel}
					className={styles.desktopShell}
					href={REVIEW_FEED_HREF}
					style={progressStyle}
				>
					<span className={styles.card}>
						<span className={styles.iconBox} aria-hidden="true">
							<ListChecks size={16} strokeWidth={2.2} />
						</span>
						<span className={styles.content}>
							<span className={styles.topRow}>
								<span className={styles.kicker}>Queue credits</span>
								<strong className={styles.count}>
									{progress.completed}/{progress.required}
								</strong>
							</span>
							<span className={styles.bar} aria-hidden="true">
								<span className={styles.barValue} />
							</span>
							<span className={styles.caption}>{remainingLabel}</span>
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
				href={REVIEW_FEED_HREF}
				style={progressStyle}
			>
				<span className={styles.mobileCard}>
					<span className={styles.iconBox} aria-hidden="true">
						<ListChecks size={15} strokeWidth={2.2} />
					</span>
					<span className={styles.mobileText}>
						<span className={styles.kicker}>Queue credits</span>
						<span className={styles.caption}>{remainingLabel}</span>
					</span>
					<strong className={styles.count}>
						{progress.completed}/{progress.required}
					</strong>
					<span className={styles.mobileBar} aria-hidden="true">
						<span className={styles.barValue} />
					</span>
				</span>
			</Link>
		</>
	);
}
