"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	ArrowRight,
	Check,
	Clock,
	X,
} from "@/components/ui/solar-icons";
import { supabase } from "@/lib/supabase/client";
import type { ReviewerClaim } from "@/app/api/reviewer/claims/route";
import styles from "./ReviewerHub.module.css";

function getAuthorLabel(author: ReviewerClaim["author"]): string {
	if (!author) return "Anonymous";
	const name = author.full_name || author.username;
	if (!name) return "Anonymous";
	return author.username ? `@${author.username}` : name;
}

function getResumeTitle(claim: ReviewerClaim): string {
	return claim.title?.trim() || "Resume";
}

type ClaimState = "active" | "completed" | "expired";

function getClaimState(claim: ReviewerClaim): ClaimState {
	if (claim.has_review) return "completed";
	if (!claim.review_deadline) return "expired";
	return new Date(claim.review_deadline) > new Date() ? "active" : "expired";
}

function useCountdown(deadlineISO: string | null) {
	const getSecondsLeft = () => {
		if (!deadlineISO) return -1;
		return Math.floor((new Date(deadlineISO).getTime() - Date.now()) / 1000);
	};

	const [seconds, setSeconds] = useState(getSecondsLeft);

	useEffect(() => {
		if (!deadlineISO) return;
		const id = setInterval(() => setSeconds(getSecondsLeft()), 30_000);
		return () => clearInterval(id);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [deadlineISO]);

	if (seconds <= 0) return { expired: true, hours: 0, minutes: 0 };
	return {
		expired: false,
		hours: Math.floor(seconds / 3600),
		minutes: Math.floor((seconds % 3600) / 60),
	};
}

function ClaimTimer({ deadline }: { deadline: string | null }) {
	const { expired, hours, minutes } = useCountdown(deadline);

	if (expired) {
		return (
			<span className={`${styles.timer} ${styles.timerExpired}`}>
				<X size={12} aria-hidden="true" weight="bold" />
				Window closed
			</span>
		);
	}

	const label =
		hours > 0 ? `${hours}h ${minutes}m remaining` : `${minutes}m remaining`;

	const timerClass =
		hours >= 6
			? styles.timerSafe
			: hours >= 2
				? styles.timerWarning
				: styles.timerUrgent;

	return (
		<span className={`${styles.timer} ${timerClass}`}>
			<Clock size={12} aria-hidden="true" />
			{label}
		</span>
	);
}

function ClaimCard({ claim }: { claim: ReviewerClaim }) {
	const state = getClaimState(claim);
	const isDimmed = state !== "active";

	return (
		<div className={`${styles.card} ${isDimmed ? styles.cardDimmed : ""}`}>
			<div className={styles.cardLeft}>
				<span className={styles.cardTitle}>{getResumeTitle(claim)}</span>
				<span className={styles.cardMeta}>{getAuthorLabel(claim.author)}</span>
				{claim.post_description ? (
					<span className={styles.cardContext}>{claim.post_description}</span>
				) : null}

				{state === "active" ? (
					<ClaimTimer deadline={claim.review_deadline} />
				) : state === "completed" ? (
					<span className={`${styles.timer} ${styles.timerDone}`}>
						<Check size={12} aria-hidden="true" weight="bold" />
						Review posted
					</span>
				) : (
					<span className={`${styles.timer} ${styles.timerExpired}`}>
						<X size={12} aria-hidden="true" weight="bold" />
						Window closed
					</span>
				)}
			</div>

			<div className={styles.cardRight}>
				<Link
					href={`/resume/${claim.id}`}
					className={`${styles.actionLink} ${isDimmed ? styles.actionLinkMuted : ""}`}
				>
					{state === "active" ? "Review" : "View"}
					<ArrowRight size={13} aria-hidden="true" />
				</Link>
			</div>
		</div>
	);
}

function SkeletonGroup({ rows = 2 }: { rows?: number }) {
	return (
		<div className={styles.skeletonGroup}>
			{Array.from({ length: rows }).map((_, i) => (
				<div className={styles.skeletonCard} key={i}>
					<div className={styles.skeletonLine} style={{ width: "55%" }} />
					<div className={styles.skeletonLine} style={{ width: "35%" }} />
					<div className={styles.skeletonLine} style={{ width: "40%", marginTop: 4 }} />
				</div>
			))}
		</div>
	);
}

type HubState = "loading" | "access_denied" | "ready" | "error";

export function ReviewerHub() {
	const [hubState, setHubState] = useState<HubState>("loading");
	const [claims, setClaims] = useState<ReviewerClaim[]>([]);
	const fetchedRef = useRef(false);

	useEffect(() => {
		if (fetchedRef.current) return;
		fetchedRef.current = true;

		async function load() {
			const session = await supabase.auth.getSession();
			const token = session.data.session?.access_token;

			if (!token) {
				setHubState("access_denied");
				return;
			}

			const res = await fetch("/api/reviewer/claims", {
				headers: { Authorization: `Bearer ${token}` },
			});

			if (res.status === 403) {
				setHubState("access_denied");
				return;
			}

			if (!res.ok) {
				setHubState("error");
				return;
			}

			const data = (await res.json()) as { claims: ReviewerClaim[] };
			setClaims(data.claims ?? []);
			setHubState("ready");
		}

		void load().catch(() => setHubState("error"));
	}, []);

	const active = useMemo(
		() => claims.filter((c) => getClaimState(c) === "active"),
		[claims],
	);
	const completed = useMemo(
		() => claims.filter((c) => getClaimState(c) === "completed"),
		[claims],
	);
	const expired = useMemo(
		() => claims.filter((c) => getClaimState(c) === "expired"),
		[claims],
	);

	return (
		<div className={`${styles.shell} page-enter`}>
			<div className={styles.header}>
				<h1 className={styles.headline}>Reviewer queue</h1>
				<p className={styles.subline}>
					Resumes you have claimed. You have 24 hours from claim time to post
					your review.
				</p>
			</div>

			{hubState === "loading" && (
				<>
					<div className={styles.section}>
						<div className={styles.sectionHead}>
							<span className={styles.sectionLabel}>Active</span>
						</div>
						<SkeletonGroup rows={2} />
					</div>
					<div className={styles.section}>
						<div className={styles.sectionHead}>
							<span className={styles.sectionLabel}>Completed</span>
						</div>
						<SkeletonGroup rows={1} />
					</div>
				</>
			)}

			{hubState === "access_denied" && (
				<div className={styles.accessDenied}>
					<p className={styles.accessDeniedTitle}>Reviewer access required</p>
					<p className={styles.accessDeniedBody}>
						This page is only available to verified Linted reviewers. Apply from
						your profile to get started.
					</p>
					<Link className={styles.emptyLink} href="/profile">
						Go to your profile
						<ArrowRight size={13} aria-hidden="true" />
					</Link>
				</div>
			)}

			{hubState === "error" && (
				<div className={styles.accessDenied}>
					<p className={styles.accessDeniedTitle}>Could not load queue</p>
					<p className={styles.accessDeniedBody}>
						Something went wrong fetching your claims. Try refreshing the page.
					</p>
				</div>
			)}

			{hubState === "ready" && (
				<>
					<div className={styles.section}>
						<div className={styles.sectionHead}>
							<span className={styles.sectionLabel}>Active</span>
							{active.length > 0 && (
								<span className={styles.sectionCount}>{active.length}</span>
							)}
						</div>
						{active.length > 0 ? (
							<div className={styles.cardGroup}>
								{active.map((c) => (
									<ClaimCard claim={c} key={c.id} />
								))}
							</div>
						) : (
							<div className={styles.empty}>
								<p className={styles.emptyTitle}>No active claims</p>
								<p className={styles.emptyBody}>
									Claim a priority resume from the feed to add it here.
								</p>
								<Link className={styles.emptyLink} href="/feed?sort=new">
									Browse priority resumes
									<ArrowRight size={13} aria-hidden="true" />
								</Link>
							</div>
						)}
					</div>

					{completed.length > 0 && (
						<div className={styles.section}>
							<div className={styles.sectionHead}>
								<span className={styles.sectionLabel}>Completed</span>
								<span className={styles.sectionCount}>{completed.length}</span>
							</div>
							<div className={styles.cardGroup}>
								{completed.map((c) => (
									<ClaimCard claim={c} key={c.id} />
								))}
							</div>
						</div>
					)}

					{expired.length > 0 && (
						<div className={styles.section}>
							<div className={styles.sectionHead}>
								<span className={styles.sectionLabel}>Expired</span>
								<span className={styles.sectionCount}>{expired.length}</span>
							</div>
							<div className={styles.cardGroup}>
								{expired.map((c) => (
									<ClaimCard claim={c} key={c.id} />
								))}
							</div>
						</div>
					)}
				</>
			)}
		</div>
	);
}
