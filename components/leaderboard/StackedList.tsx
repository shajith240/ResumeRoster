"use client";

import Link from "next/link";
import { X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
	ArrowRight,
	FileText,
	ListOrdered,
	Search,
} from "@/components/ui/solar-icons";

import LintPointsFlame from "@/components/LintPointsFlame";
import { Input } from "@/components/ui/input";
import { PresenceAvatar } from "@/components/user-presence/PresenceAvatar";
import { cn } from "@/lib/utils";
import {
	getGeneratedAvatarUrl,
	resolveProfileAvatarUrl,
} from "@/lib/supabase/avatars";
import type { ReviewerProfileStats } from "@/lib/supabase/types";
import {
	canShowReviewerProfile,
	getReviewerDisplayLabel,
} from "@/lib/reviewer-validation";

export type LeaderboardReviewPreview = {
	id: string;
	resume_id: string;
	content: string;
	helpful_votes: number;
	created_at: string;
};

export type LeaderboardReviewer = ReviewerProfileStats & {
	lint_points?: number;
	roast_points?: number;
	role_tag?: string;
	top_review?: LeaderboardReviewPreview;
	top_roast?: LeaderboardReviewPreview;
};

type StackedListProps = {
	directoryReviewers?: LeaderboardReviewer[];
	message?: string;
	onSearchQueryChange?: (value: string) => void;
	reviewers: LeaderboardReviewer[];
	searchQuery?: string;
	searchPlaceholder?: string;
	startRank?: number;
};

type RankedReviewer = {
	rank: number;
	reviewer: LeaderboardReviewer;
	searchText: string;
};

const rowSpring = {
	type: "spring" as const,
	stiffness: 360,
	damping: 34,
	mass: 0.55,
};

function reviewerName(reviewer: LeaderboardReviewer) {
	return reviewer.full_name || reviewer.username || "Anonymous reviewer";
}

function roleTag(reviewer: LeaderboardReviewer) {
	if (reviewer.role_tag) return reviewer.role_tag;

	if (
		canShowReviewerProfile(
			reviewer.community_role,
			reviewer.reviewer_type,
			reviewer.reviewer_verification_status,
		)
	) {
		return getReviewerDisplayLabel(reviewer);
	}

	const label = `${reviewer.current_position ?? ""} ${reviewer.target_role ?? ""} ${
		reviewer.college ?? ""
	}`.toLowerCase();

	if (label.includes("switch")) return "Career Switcher";
	if (label.includes("intern")) return "Intern";
	if (label.includes("student") || label.includes("college") || label.includes("iit")) {
		return "Student";
	}

	return "Job Seeker";
}

function tagClass(label: string) {
	if (label === "Trusted reviewer") {
		return "border-[rgba(255,184,95,0.34)] bg-[var(--brand-muted)] text-[var(--brand)]";
	}

	if (label === "Student") {
		return "border-[#D9D0FF] bg-[#F1EDFF] text-[#5137B8] dark:border-[rgba(169,149,255,0.28)] dark:bg-[rgba(169,149,255,0.14)] dark:text-[#d7ceff]";
	}

	if (label === "Career Switcher") {
		return "border-[#CBDCFF] bg-[#EEF4FF] text-[#244EA8] dark:border-[rgba(110,165,255,0.28)] dark:bg-[rgba(110,165,255,0.14)] dark:text-[#b9d4ff]";
	}

	if (label === "Intern") {
		return "border-[#CBE8DA] bg-[#EEF9F3] text-[#1D6F45] dark:border-[rgba(103,211,145,0.26)] dark:bg-[rgba(103,211,145,0.12)] dark:text-[#a9ecc0]";
	}

	return "border-[#F6D794] bg-[#FFF3D8] text-[#8A5B11] dark:border-[rgba(255,184,95,0.28)] dark:bg-[rgba(255,184,95,0.14)] dark:text-[#ffd28a]";
}

function reviewerLintPoints(reviewer: LeaderboardReviewer) {
	return reviewer.lint_points ?? reviewer.roast_points ?? reviewer.helpful_votes;
}

function tableQuote(reviewer: LeaderboardReviewer) {
	return reviewer.top_review?.content ?? reviewer.top_roast?.content ?? "No top feedback yet.";
}

function normalizeSearchValue(value: string) {
	return value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[@#"'.,/\\|()[\]{}:;!?+%_-]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function buildSearchText(reviewer: LeaderboardReviewer, rank: number) {
	const points = reviewerLintPoints(reviewer);
	const topReview = reviewer.top_review ?? reviewer.top_roast;

	return normalizeSearchValue(
		[
			`rank ${rank}`,
			`#${rank}`,
			String(rank),
			`${points} lint points`,
			`${points} points`,
			reviewerName(reviewer),
			reviewer.username,
			reviewer.current_position,
			reviewer.target_role,
			reviewer.college,
			reviewer.reviewer_headline,
			reviewer.reviewer_expertise?.join(" "),
			reviewer.reviewer_verification_status,
			roleTag(reviewer),
			topReview?.content,
			topReview?.helpful_votes
				? `${topReview.helpful_votes} helpful`
				: "",
		]
			.filter(Boolean)
			.join(" "),
	);
}

function queryTerms(query: string) {
	return normalizeSearchValue(query).split(" ").filter(Boolean);
}

function matchesQuery(searchText: string, terms: string[]) {
	if (!terms.length) return true;

	return terms.every((term) => searchText.includes(term));
}

function LeaderboardAvatar({
	name,
	reviewer,
}: {
	name: string;
	reviewer: LeaderboardReviewer;
}) {
	const fallbackUrl = getGeneratedAvatarUrl(reviewer.id || name);
	const avatarUrl = resolveProfileAvatarUrl(reviewer, reviewer.id || name);

	return (
		<PresenceAvatar isOnline={reviewer.is_online} size="lg">
			<span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-[rgba(214,179,100,0.52)] bg-[var(--bg-elevated)]">
				<img
					src={avatarUrl}
					alt={`${name} profile photo`}
					className="h-full w-full object-cover"
					onError={(event) => {
						if (event.currentTarget.src !== fallbackUrl) {
							event.currentTarget.src = fallbackUrl;
						}
					}}
				/>
			</span>
		</PresenceAvatar>
	);
}

function RankCell({ rank }: { rank: number }) {
	const isTopThree = rank <= 3;

	return (
		<div
			className={cn(
				"flex h-10 w-10 items-center justify-start rounded-none border-0 bg-transparent font-[var(--font-post-title)] text-sm font-semibold tabular-nums",
				isTopThree
					? "text-[var(--brand)]"
					: "text-[var(--text-secondary)]",
			)}
			aria-label={`Rank ${rank}`}
		>
			#{rank}
		</div>
	);
}

function LeaderboardRow({
	rank,
	reducedMotion,
	reviewer,
}: {
	rank: number;
	reducedMotion: boolean;
	reviewer: LeaderboardReviewer;
}) {
	const name = reviewerName(reviewer);
	const tag = roleTag(reviewer);
	const points = reviewerLintPoints(reviewer);
	const topReview = reviewer.top_review ?? reviewer.top_roast;
	const topReviewHref = topReview
		? `/resume/${topReview.resume_id}`
		: `/profile/${reviewer.id}`;

	return (
		<motion.article
			layout={!reducedMotion}
			initial={reducedMotion ? false : { opacity: 0, y: 10 }}
			animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
			exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
			transition={reducedMotion ? { duration: 0 } : rowSpring}
			className="group grid grid-cols-[64px_minmax(230px,1.15fr)_minmax(116px,0.45fr)_140px_minmax(180px,1fr)_120px] items-center gap-4 border-b border-[var(--border-subtle)] px-5 py-4 last:border-b-0 hover:bg-[color-mix(in_srgb,var(--bg-elevated)_58%,transparent)] max-[1320px]:grid-cols-[58px_minmax(220px,1.1fr)_136px_minmax(180px,1fr)_112px] max-[1320px]:[&_.role-cell]:hidden max-[1080px]:grid-cols-[54px_minmax(220px,1fr)_132px_112px] max-[1080px]:[&_.top-review-cell]:hidden max-[760px]:grid-cols-[38px_minmax(0,1fr)_auto_42px] max-[760px]:items-center max-[760px]:gap-x-3 max-[760px]:gap-y-0 max-[760px]:px-4"
		>
			<RankCell rank={rank} />

			<Link
				href={`/profile/${reviewer.id}`}
				className="flex min-w-0 items-center gap-3 text-[var(--text-primary)]"
			>
				<LeaderboardAvatar name={name} reviewer={reviewer} />
				<div className="min-w-0">
					<strong className="block truncate font-[var(--font-post-title)] text-[15px] font-medium leading-tight">
						{name}
					</strong>
					<span className="mt-1 block truncate text-xs font-normal text-[var(--text-secondary)]">
						{reviewer.reviewer_headline ||
							reviewer.current_position ||
							reviewer.target_role ||
							reviewer.college ||
							"Community reviewer"}
					</span>
				</div>
			</Link>

			<div className="role-cell max-[760px]:col-start-2">
				<span
					className={cn(
						"inline-flex max-w-full rounded-full border px-2.5 py-1 text-xs font-medium leading-none",
						tagClass(tag),
					)}
				>
					{tag}
				</span>
			</div>

			<div className="flex items-center gap-1.5 font-[var(--font-post-title)] text-base font-medium tabular-nums text-[var(--text-primary)] max-[760px]:col-start-3 max-[760px]:row-start-1 max-[760px]:justify-self-end max-[760px]:text-sm max-[760px]:leading-none">
				<LintPointsFlame
					className="h-[18px] w-[18px]"
					fallbackClassName="h-4 w-4"
				/>
				{points.toLocaleString()}
			</div>

			<div className="top-review-cell min-w-0">
				<p className="truncate text-sm font-normal text-[var(--text-secondary)]">
					"{tableQuote(reviewer)}"
				</p>
			</div>

			<Link
				href={topReviewHref}
				aria-label={`View ${name}`}
				className="inline-grid h-10 w-10 select-none place-items-center rounded-[var(--button-radius)] border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)] transition-all duration-200 ease-out hover:-translate-y-px hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface)] active:translate-y-px max-[760px]:col-start-4 max-[760px]:row-start-1 max-[760px]:h-10 max-[760px]:w-10 max-[760px]:self-center"
			>
				<span className="sr-only">View</span>
				<ArrowRight className="h-4 w-4" aria-hidden="true" />
			</Link>
		</motion.article>
	);
}

function AvatarStack({ reviewers }: { reviewers: RankedReviewer[] }) {
	const visible = reviewers.slice(0, 3);
	const remaining = Math.max(0, reviewers.length - visible.length);

	return (
		<div className="flex -space-x-3">
			{visible.map(({ reviewer }) => {
				const name = reviewerName(reviewer);
				const fallbackUrl = getGeneratedAvatarUrl(reviewer.id || name);
				const avatarUrl = resolveProfileAvatarUrl(reviewer, reviewer.id || name);

				return (
					<PresenceAvatar
						key={reviewer.id}
						isOnline={reviewer.is_online}
						size="md"
					>
						<img
							alt={`${name} profile photo`}
							className="h-10 w-10 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] object-cover ring-2 ring-[var(--bg-surface)]"
							onError={(event) => {
								if (event.currentTarget.src !== fallbackUrl) {
									event.currentTarget.src = fallbackUrl;
								}
							}}
							src={avatarUrl}
						/>
					</PresenceAvatar>
				);
			})}
			{remaining ? (
				<div className="relative z-0 grid h-10 w-10 place-items-center rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] text-xs font-medium tabular-nums text-[var(--text-secondary)] ring-2 ring-[var(--bg-surface)]">
					+{remaining}
				</div>
			) : null}
		</div>
	);
}

function DirectoryRow({
	item,
}: {
	item: RankedReviewer;
}) {
	const { rank, reviewer } = item;
	const name = reviewerName(reviewer);
	const tag = roleTag(reviewer);
	const points = reviewerLintPoints(reviewer);

	return (
		<div className="flex items-center gap-3 border-b border-[var(--border-subtle)] py-3 last:border-b-0">
			<LeaderboardAvatar name={name} reviewer={reviewer} />
			<Link href={`/profile/${reviewer.id}`} className="min-w-0 flex-1">
				<strong className="block truncate text-sm font-medium text-[var(--text-primary)]">
					{name}
				</strong>
				<span className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-xs font-normal text-[var(--text-secondary)]">
					<span className="shrink-0">Rank #{rank}</span>
					<span aria-hidden="true" className="shrink-0">
						-
					</span>
					<LintPointsFlame className="h-4 w-4" fallbackClassName="h-3.5 w-3.5" />
					<span className="truncate">{points.toLocaleString()} lint points</span>
				</span>
			</Link>
			<span
				className={cn(
					"inline-flex max-w-[150px] shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium leading-none",
					tagClass(tag),
				)}
			>
				{tag}
			</span>
		</div>
	);
}

export function StackedList({
	directoryReviewers,
	message = "",
	onSearchQueryChange,
	reviewers,
	searchQuery = "",
	searchPlaceholder = "Search contributors, roles, top feedback...",
	startRank = 1,
}: StackedListProps) {
	const [localQuery, setLocalQuery] = useState(searchQuery);
	const [directoryOpen, setDirectoryOpen] = useState(false);
	const [directoryQuery, setDirectoryQuery] = useState("");
	const reducedMotion = Boolean(useReducedMotion());

	useEffect(() => {
		setLocalQuery(searchQuery);
	}, [searchQuery]);

	const activeQuery = (onSearchQueryChange ? searchQuery : localQuery).trim();
	const deferredQuery = useDeferredValue(activeQuery);
	const deferredDirectoryQuery = useDeferredValue(directoryQuery);
	const activeTerms = useMemo(() => queryTerms(deferredQuery), [deferredQuery]);
	const directoryTerms = useMemo(
		() => queryTerms(deferredDirectoryQuery),
		[deferredDirectoryQuery],
	);
	const rankedReviewers = useMemo<RankedReviewer[]>(
		() =>
			reviewers.slice(0, 100).map((reviewer, index) => {
				const rank = startRank + index;

				return {
					rank,
					reviewer,
					searchText: buildSearchText(reviewer, rank),
				};
			}),
		[reviewers, startRank],
	);
	const directoryRankedReviewers = useMemo<RankedReviewer[]>(
		() =>
			(directoryReviewers ?? reviewers).map((reviewer, index) => {
				const rank = index + 1;

				return {
					rank,
					reviewer,
					searchText: buildSearchText(reviewer, rank),
				};
			}),
		[directoryReviewers, reviewers],
	);
	const filteredReviewers = useMemo(
		() =>
			rankedReviewers.filter(({ searchText }) =>
				matchesQuery(searchText, activeTerms),
			),
		[activeTerms, rankedReviewers],
	);
	const directoryResults = useMemo(() => {
		return directoryRankedReviewers.filter(({ searchText }) =>
			matchesQuery(searchText, directoryTerms),
		);
	}, [directoryRankedReviewers, directoryTerms]);

	function handleSearch(value: string) {
		if (onSearchQueryChange) {
			onSearchQueryChange(value);
			return;
		}

		setLocalQuery(value);
	}

	return (
		<section className="relative min-h-[560px] w-full overflow-hidden rounded-[18px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] pb-24 font-[var(--font-app-body)] shadow-none">
			<div className="border-b border-[var(--border-subtle)] px-5 py-4 max-[760px]:px-4">
				<label className="relative block max-w-[560px]">
					<Search
						aria-hidden="true"
						className="absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]"
					/>
					<span className="sr-only">Search contributors</span>
					<Input
						autoComplete="off"
						className="h-11 rounded-[var(--button-radius)] border-[var(--border-default)] bg-[var(--bg-elevated)] pl-10 pr-10 text-sm font-normal text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus-visible:ring-[var(--ring)]"
						onChange={(event) => handleSearch(event.target.value)}
						placeholder={searchPlaceholder}
						spellCheck={false}
						type="search"
						value={activeQuery}
					/>
					{activeQuery ? (
						<button
							aria-label="Clear leaderboard search"
							className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-[8px] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
							onClick={() => handleSearch("")}
							type="button"
						>
							<X className="h-4 w-4" aria-hidden="true" />
						</button>
					) : null}
				</label>
			</div>

			<div className="hidden grid-cols-[64px_minmax(230px,1.15fr)_minmax(116px,0.45fr)_140px_minmax(180px,1fr)_120px] gap-4 border-b border-[var(--border-subtle)] px-5 py-3 text-xs font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)] max-[1320px]:grid-cols-[58px_minmax(220px,1.1fr)_136px_minmax(180px,1fr)_112px] max-[1320px]:[&_.role-head]:hidden max-[1080px]:grid-cols-[54px_minmax(220px,1fr)_132px_112px] max-[1080px]:[&_.top-review-head]:hidden md:grid">
				<span>Rank</span>
					<span>Contributor</span>
				<span className="role-head">Role</span>
				<span>Lint Points</span>
				<span className="top-review-head">Top feedback</span>
				<span>Action</span>
			</div>

			{message ? <p className="form-message m-5">{message}</p> : null}

			<motion.div
				className="max-h-[min(62vh,720px)] overflow-y-auto"
				layout={!reducedMotion}
			>
				<AnimatePresence initial={false}>
					{filteredReviewers.map(({ rank, reviewer }) => (
						<LeaderboardRow
							key={reviewer.id}
							rank={rank}
							reducedMotion={reducedMotion}
							reviewer={reviewer}
						/>
					))}
				</AnimatePresence>
			</motion.div>

			{!filteredReviewers.length && !message ? (
				<div className="leaderboard-empty">
					<span className="empty-icon">
						<FileText aria-hidden="true" />
					</span>
					<strong>No matching reviewers</strong>
					<p>Try another search or help someone lint a resume.</p>
					<Link href="/feed">Open Resume Feed -&gt;</Link>
				</div>
			) : null}

			<AnimatePresence initial={false}>
				{!directoryOpen ? (
					<motion.button
						animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
						aria-label="Open community directory"
						className="absolute bottom-4 left-4 right-4 z-30 flex h-[76px] items-center justify-between gap-4 overflow-hidden rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 text-left shadow-[0_18px_48px_rgba(0,0,0,0.22)] transition-colors hover:bg-[var(--bg-surface)] will-change-transform max-[760px]:bottom-3 max-[760px]:left-3 max-[760px]:right-3"
						exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.992 }}
						initial={reducedMotion ? false : { opacity: 0, y: 8, scale: 0.992 }}
						key="directory-closed"
						onClick={() => setDirectoryOpen(true)}
						transition={reducedMotion ? { duration: 0 } : { duration: 0.16, ease: [0.2, 0, 0, 1] }}
						type="button"
					>
						<div className="flex min-w-0 items-center gap-3">
							<div className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)]">
								<ListOrdered className="h-5 w-5" aria-hidden="true" />
							</div>
							<div className="min-w-0">
								<h3 className="m-0 truncate text-base font-medium leading-none text-[var(--text-primary)]">
									Community Directory
								</h3>
								<p className="mt-1 truncate text-xs font-normal text-[var(--text-secondary)]">
									{directoryRankedReviewers.length} community members
								</p>
							</div>
						</div>

						<AvatarStack reviewers={directoryRankedReviewers} />
					</motion.button>
				) : (
					<motion.section
						animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
						aria-label="Community directory"
						className="absolute inset-[10px] z-30 flex flex-col overflow-hidden rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-[0_18px_48px_rgba(0,0,0,0.22)] will-change-transform"
						exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.99 }}
						initial={reducedMotion ? false : { opacity: 0, y: 12, scale: 0.985 }}
						key="directory-open"
						transition={reducedMotion ? { duration: 0 } : { duration: 0.18, ease: [0.2, 0, 0, 1] }}
					>
						<div className="flex h-[76px] shrink-0 items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-4">
							<div className="flex min-w-0 items-center gap-3">
								<div className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)]">
									<ListOrdered className="h-5 w-5" aria-hidden="true" />
								</div>
								<div className="min-w-0">
									<h3 className="m-0 truncate text-base font-medium leading-none text-[var(--text-primary)]">
									Community Directory
									</h3>
									<p className="mt-1 truncate text-xs font-normal text-[var(--text-secondary)]">
										{directoryRankedReviewers.length} community members
									</p>
								</div>
							</div>

							<button
								aria-label="Close community directory"
								className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
								onClick={() => setDirectoryOpen(false)}
								type="button"
							>
								<X className="h-4 w-4" aria-hidden="true" />
							</button>
						</div>

						<div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-3 p-4 pt-3">
							<label className="relative block">
								<Search
									aria-hidden="true"
									className="absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]"
								/>
								<span className="sr-only">Search community directory</span>
								<Input
									autoComplete="off"
									className="h-11 rounded-[12px] border-[var(--border-default)] bg-[var(--bg-elevated)] pl-10 pr-4 text-sm font-normal text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus-visible:ring-[var(--ring)]"
									onChange={(event) => setDirectoryQuery(event.target.value)}
									placeholder="Search community members..."
									spellCheck={false}
									type="search"
									value={directoryQuery}
								/>
							</label>

							<div className="min-h-0 overflow-y-auto pr-1">
								{directoryResults.map((item) => (
									<DirectoryRow
										item={item}
										key={`directory-${item.reviewer.id}`}
									/>
								))}

								{!directoryResults.length ? (
									<div className="grid min-h-40 place-items-center text-center">
										<div>
											<strong className="block text-sm font-medium text-[var(--text-primary)]">
												No community members found
											</strong>
											<p className="mt-1 text-xs text-[var(--text-secondary)]">
												Try a different name, role, or feedback keyword.
											</p>
										</div>
									</div>
								) : null}
							</div>
						</div>
					</motion.section>
				)}
			</AnimatePresence>
		</section>
	);
}
