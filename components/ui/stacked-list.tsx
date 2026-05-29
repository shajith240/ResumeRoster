"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
	ArrowRight,
	FileText,
	Flame,
	ListOrdered,
	Search,
	TrendingUp,
	X,
} from "lucide-react";

import InfoHint from "@/components/InfoHint";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { resolveAvatarUrl } from "@/lib/supabase/avatars";
import type { RoasterLeaderboardEntry } from "@/lib/supabase/types";
import {
	canShowReviewerProfile,
	getReviewerDisplayLabel,
} from "@/lib/reviewer-validation";

export type LeaderboardRoastPreview = {
	id: string;
	resume_id: string;
	content: string;
	helpful_votes: number;
	created_at: string;
};

export type LeaderboardRoaster = RoasterLeaderboardEntry & {
	improvement?: number;
	roast_points?: number;
	role_tag?: string;
	top_roast?: LeaderboardRoastPreview;
};

type StackedListProps = {
	description?: string;
	heading?: string;
	message?: string;
	onSearchQueryChange?: (value: string) => void;
	roasters: LeaderboardRoaster[];
	searchQuery?: string;
	searchPlaceholder?: string;
	startRank?: number;
};

type RankedRoaster = {
	rank: number;
	roaster: LeaderboardRoaster;
	searchText: string;
};

const rowSpring = {
	type: "spring" as const,
	stiffness: 360,
	damping: 34,
	mass: 0.55,
};

function initials(name: string) {
	const letters = name
		.split(/\s+/)
		.filter(Boolean)
		.map((part) => part[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();

	return letters || "#";
}

function roasterName(roaster: LeaderboardRoaster) {
	return roaster.full_name || roaster.username || "Anonymous reviewer";
}

function roleTag(roaster: LeaderboardRoaster) {
	if (roaster.role_tag) return roaster.role_tag;

	if (canShowReviewerProfile(roaster.community_role, roaster.reviewer_type)) {
		return getReviewerDisplayLabel(roaster);
	}

	const role = `${roaster.target_role ?? ""} ${roaster.college ?? ""}`.toLowerCase();

	if (role.includes("student") || role.includes("college") || role.includes("iit")) {
		return "Student";
	}

	if (role.includes("switch")) {
		return "Career Switcher";
	}

	if (role.includes("intern")) {
		return "Intern";
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

function roastPoints(roaster: LeaderboardRoaster) {
	return (
		roaster.roast_points ??
		roaster.helpful_votes * 120 + roaster.roast_count * 60
	);
}

function improvement(roaster: LeaderboardRoaster) {
	return (
		roaster.improvement ??
		Math.min(96, 18 + roaster.helpful_votes * 4 + roaster.roast_count * 2)
	);
}

function tableQuote(roaster: LeaderboardRoaster) {
	return roaster.top_roast?.content ?? "No top feedback yet.";
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

function buildSearchText(roaster: LeaderboardRoaster, rank: number) {
	const points = roastPoints(roaster);
	const improve = improvement(roaster);

	return normalizeSearchValue(
		[
			`rank ${rank}`,
			`#${rank}`,
			String(rank),
			`${points} points`,
			`${improve} improvement`,
			roasterName(roaster),
			roaster.username,
			roaster.target_role,
			roaster.college,
			roaster.reviewer_headline,
			roaster.reviewer_expertise?.join(" "),
			roaster.reviewer_verification_status,
			roleTag(roaster),
			roaster.top_roast?.content,
			roaster.top_roast?.helpful_votes
				? `${roaster.top_roast.helpful_votes} helpful`
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
	roaster,
}: {
	name: string;
	roaster: LeaderboardRoaster;
}) {
	const avatarUrl = resolveAvatarUrl(roaster.avatar_url, roaster.avatar_path);

	return (
		<div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-[rgba(214,179,100,0.52)] bg-[var(--bg-elevated)]">
			{avatarUrl ? (
				<img
					src={avatarUrl}
					alt={`${name} profile photo`}
					className="h-full w-full object-cover"
				/>
			) : (
				<span className="font-[var(--font-app-body)] text-sm font-medium text-[var(--text-primary)]">
					{initials(name)}
				</span>
			)}
		</div>
	);
}

function RankCell({ rank }: { rank: number }) {
	const isTopThree = rank <= 3;

	return (
		<div
			className={cn(
				"flex h-10 w-10 items-center justify-center rounded-[12px] border font-[var(--font-app-body)] text-sm font-medium tabular-nums",
				isTopThree
					? "border-[rgba(255,184,95,0.42)] bg-[var(--brand-muted)] text-[var(--brand)]"
					: "border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]",
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
	roaster,
}: {
	rank: number;
	reducedMotion: boolean;
	roaster: LeaderboardRoaster;
}) {
	const name = roasterName(roaster);
	const tag = roleTag(roaster);
	const points = roastPoints(roaster);
	const topRoastHref = roaster.top_roast
		? `/resume/${roaster.top_roast.resume_id}`
		: `/profile/${roaster.id}`;

	return (
		<motion.article
			layout={!reducedMotion}
			initial={reducedMotion ? false : { opacity: 0, y: 10 }}
			animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
			exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
			transition={reducedMotion ? { duration: 0 } : rowSpring}
			className="group grid grid-cols-[64px_minmax(230px,1.15fr)_minmax(116px,0.45fr)_140px_118px_minmax(180px,1fr)_120px] items-center gap-4 border-b border-[var(--border-subtle)] px-5 py-4 last:border-b-0 hover:bg-[color-mix(in_srgb,var(--bg-elevated)_58%,transparent)] max-[1320px]:grid-cols-[58px_minmax(220px,1.1fr)_136px_118px_minmax(180px,1fr)_112px] max-[1320px]:[&_.role-cell]:hidden max-[1080px]:grid-cols-[54px_minmax(220px,1fr)_132px_112px_112px] max-[1080px]:[&_.top-roast-cell]:hidden max-[760px]:grid-cols-[48px_minmax(0,1fr)] max-[760px]:items-start max-[760px]:gap-3 max-[760px]:px-4"
		>
			<RankCell rank={rank} />

			<Link
				href={`/profile/${roaster.id}`}
				className="flex min-w-0 items-center gap-3 text-[var(--text-primary)]"
			>
				<LeaderboardAvatar name={name} roaster={roaster} />
				<div className="min-w-0">
					<strong className="block truncate font-[var(--font-app-body)] text-[15px] font-medium leading-tight">
						{name}
					</strong>
					<span className="mt-1 block truncate text-xs font-normal text-[var(--text-secondary)]">
						{roaster.reviewer_headline ||
							roaster.target_role ||
							roaster.college ||
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

			<div className="flex items-center gap-2 font-[var(--font-app-body)] text-base font-medium tabular-nums text-[var(--text-primary)] max-[760px]:col-start-2">
				<Flame className="h-4 w-4 text-[var(--brand)]" aria-hidden="true" />
				{points.toLocaleString()}
			</div>

			<div className="flex items-center gap-2 text-sm font-medium tabular-nums text-[var(--success)] max-[760px]:col-start-2">
				<TrendingUp className="h-4 w-4" aria-hidden="true" />+
				{improvement(roaster)}%
			</div>

			<div className="top-roast-cell min-w-0">
				<p className="truncate text-sm font-normal text-[var(--text-secondary)]">
					"{tableQuote(roaster)}"
				</p>
			</div>

			<Link
				href={topRoastHref}
				className="inline-flex min-h-11 w-fit select-none items-center gap-2 rounded-[var(--button-radius)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-all duration-200 ease-out hover:-translate-y-px hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface)] active:translate-y-px max-[760px]:col-start-2"
			>
				View
				<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
			</Link>
		</motion.article>
	);
}

function AvatarStack({ roasters }: { roasters: RankedRoaster[] }) {
	const visible = roasters.slice(0, 3);
	const remaining = Math.max(0, roasters.length - visible.length);

	return (
		<div className="flex -space-x-3">
			{visible.map(({ roaster }) => {
				const name = roasterName(roaster);
				const avatarUrl = resolveAvatarUrl(roaster.avatar_url, roaster.avatar_path);

				return avatarUrl ? (
					<img
						alt={`${name} profile photo`}
						className="h-10 w-10 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] object-cover ring-2 ring-[var(--bg-surface)]"
						key={roaster.id}
						src={avatarUrl}
					/>
				) : (
					<div
						className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-xs font-medium text-[var(--text-primary)] ring-2 ring-[var(--bg-surface)]"
						key={roaster.id}
					>
						{initials(name)}
					</div>
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
	reducedMotion,
}: {
	item: RankedRoaster;
	reducedMotion: boolean;
}) {
	const { rank, roaster } = item;
	const name = roasterName(roaster);
	const tag = roleTag(roaster);

	return (
		<motion.div
			variants={{
				hidden: { opacity: 0, x: 8, y: 10 },
				visible: { opacity: 1, x: 0, y: 0 },
			}}
			transition={reducedMotion ? { duration: 0 } : rowSpring}
			className="flex items-center gap-3 border-b border-[var(--border-subtle)] py-3 last:border-b-0"
		>
			<LeaderboardAvatar name={name} roaster={roaster} />
			<Link href={`/profile/${roaster.id}`} className="min-w-0 flex-1">
				<strong className="block truncate text-sm font-medium text-[var(--text-primary)]">
					{name}
				</strong>
				<span className="mt-1 block truncate text-xs font-normal text-[var(--text-secondary)]">
					Rank #{rank} - {roastPoints(roaster).toLocaleString()} points
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
		</motion.div>
	);
}

export function StackedList({
	description = "Reviewer directory ranked by useful resume feedback.",
	heading = "Top 100",
	message = "",
	onSearchQueryChange,
	roasters,
	searchQuery = "",
	searchPlaceholder = "Search reviewers, roles, top feedback...",
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
	const rankedRoasters = useMemo<RankedRoaster[]>(
		() =>
			roasters.slice(0, 100).map((roaster, index) => {
				const rank = startRank + index;

				return {
					rank,
					roaster,
					searchText: buildSearchText(roaster, rank),
				};
			}),
		[roasters, startRank],
	);
	const filteredRoasters = useMemo(
		() =>
			rankedRoasters.filter(({ searchText }) =>
				matchesQuery(searchText, activeTerms),
			),
		[activeTerms, rankedRoasters],
	);
	const directoryResults = useMemo(() => {
		return rankedRoasters.filter(({ searchText }) =>
			matchesQuery(searchText, directoryTerms),
		);
	}, [directoryTerms, rankedRoasters]);

	function handleSearch(value: string) {
		if (onSearchQueryChange) {
			onSearchQueryChange(value);
			return;
		}

		setLocalQuery(value);
	}

	return (
		<section className="relative min-h-[560px] w-full overflow-hidden rounded-[18px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] pb-24 font-[var(--font-app-body)] shadow-none max-[760px]:pb-0">
			<div className="border-b border-[var(--border-subtle)] p-5 pb-4">
				<div className="mb-4 flex items-center justify-between gap-4">
					<div className="min-w-0">
						<h2 className="m-0 flex items-center gap-2 font-[var(--font-display)] text-[34px] font-normal leading-none tracking-normal text-[var(--text-primary)]">
							{heading}
							<InfoHint align="right">{description}</InfoHint>
						</h2>
					</div>
				</div>

				<label className="relative block max-w-[560px]">
					<Search
						aria-hidden="true"
						className="absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]"
					/>
					<span className="sr-only">Search reviewers</span>
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

			<div className="hidden grid-cols-[64px_minmax(230px,1.15fr)_minmax(116px,0.45fr)_140px_118px_minmax(180px,1fr)_120px] gap-4 border-b border-[var(--border-subtle)] px-5 py-3 text-xs font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)] max-[1320px]:grid-cols-[58px_minmax(220px,1.1fr)_136px_118px_minmax(180px,1fr)_112px] max-[1320px]:[&_.role-head]:hidden max-[1080px]:grid-cols-[54px_minmax(220px,1fr)_132px_112px_112px] max-[1080px]:[&_.top-roast-head]:hidden md:grid">
				<span>Rank</span>
				<span>Reviewer</span>
				<span className="role-head">Role</span>
				<span>Points</span>
				<span>Improve</span>
				<span className="top-roast-head">Top feedback</span>
				<span>Action</span>
			</div>

			{message ? <p className="form-message m-5">{message}</p> : null}

			<motion.div
				className="max-h-[min(62vh,720px)] overflow-y-auto"
				layout={!reducedMotion}
			>
				<AnimatePresence initial={false}>
					{filteredRoasters.map(({ rank, roaster }) => (
						<LeaderboardRow
							key={roaster.id}
							rank={rank}
							reducedMotion={reducedMotion}
							roaster={roaster}
						/>
					))}
				</AnimatePresence>
			</motion.div>

			{!filteredRoasters.length && !message ? (
				<div className="leaderboard-empty">
					<span className="empty-icon">
						<FileText aria-hidden="true" />
					</span>
					<strong>No matching reviewers</strong>
					<Link href="/feed">Open the feed -&gt;</Link>
				</div>
			) : null}

			<motion.div
				animate={{
					bottom: directoryOpen ? 10 : 16,
					height: directoryOpen ? "calc(100% - 20px)" : 76,
					left: directoryOpen ? 10 : 16,
					right: directoryOpen ? 10 : 16,
					borderRadius: directoryOpen ? 16 : 18,
				}}
				className="absolute z-30 flex flex-col overflow-hidden border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-[0_18px_48px_rgba(0,0,0,0.22)] max-[760px]:hidden"
				initial={false}
				onClick={() => {
					if (!directoryOpen) setDirectoryOpen(true);
				}}
				style={{ cursor: directoryOpen ? "default" : "pointer" }}
				transition={
					reducedMotion
						? { duration: 0 }
						: {
								type: "spring",
								stiffness: 240,
								damping: 30,
								mass: 0.8,
							}
				}
			>
				<div
					className={cn(
						"flex h-[76px] shrink-0 items-center justify-between gap-4 px-4 transition-colors",
						directoryOpen ? "border-b border-[var(--border-subtle)]" : "hover:bg-[var(--bg-surface)]",
					)}
				>
					<div className="flex min-w-0 items-center gap-3">
						<div className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)]">
							<ListOrdered className="h-5 w-5" aria-hidden="true" />
						</div>
						<div className="min-w-0">
							<h3 className="m-0 truncate text-base font-medium leading-none text-[var(--text-primary)]">
								Reviewer Directory
							</h3>
							<p className="mt-1 truncate text-xs font-normal text-[var(--text-secondary)]">
								{rankedRoasters.length} reviewers ranked
							</p>
						</div>
					</div>

					<div className="flex shrink-0 items-center gap-3">
						{directoryOpen ? (
							<button
								aria-label="Close reviewer directory"
								className="grid h-11 w-11 place-items-center rounded-[12px] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
								onClick={(event) => {
									event.stopPropagation();
									setDirectoryOpen(false);
								}}
								type="button"
							>
								<X className="h-4 w-4" aria-hidden="true" />
							</button>
						) : (
							<AvatarStack roasters={rankedRoasters} />
						)}
					</div>
				</div>

				<AnimatePresence initial={false}>
					{directoryOpen ? (
						<motion.div
							animate={{ opacity: 1, y: 0 }}
							className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-3 p-4 pt-3"
							exit={{ opacity: 0, y: -8 }}
							initial={{ opacity: 0, y: -8 }}
							transition={reducedMotion ? { duration: 0 } : { duration: 0.18 }}
						>
							<label className="relative block">
								<Search
									aria-hidden="true"
									className="absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]"
								/>
								<span className="sr-only">Search reviewer directory</span>
								<Input
									autoComplete="off"
									className="h-11 rounded-[12px] border-transparent bg-[var(--bg-surface)] pl-10 pr-4 text-sm font-normal text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus-visible:ring-[var(--ring)]"
									onChange={(event) => setDirectoryQuery(event.target.value)}
									placeholder="Search reviewers..."
									spellCheck={false}
									type="search"
									value={directoryQuery}
								/>
							</label>

							<div className="min-h-0 overflow-y-auto pr-1">
								<motion.div
									animate="visible"
									initial="hidden"
									variants={{
										visible: {
											transition: { staggerChildren: reducedMotion ? 0 : 0.025 },
										},
									}}
								>
									{directoryResults.map((item) => (
										<DirectoryRow
											item={item}
											key={`directory-${item.roaster.id}`}
											reducedMotion={reducedMotion}
										/>
									))}
								</motion.div>

								{!directoryResults.length ? (
									<div className="grid min-h-40 place-items-center text-center">
										<div>
											<strong className="block text-sm font-medium text-[var(--text-primary)]">
												No reviewers found
											</strong>
											<p className="mt-1 text-xs text-[var(--text-secondary)]">
												Try a different name, role, or roast keyword.
											</p>
										</div>
									</div>
								) : null}
							</div>
						</motion.div>
					) : null}
				</AnimatePresence>
			</motion.div>
		</section>
	);
}

export default StackedList;
