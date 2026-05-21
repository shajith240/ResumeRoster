"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Flame } from "lucide-react";

import { cn } from "@/lib/utils";
import type { RoasterLeaderboardEntry } from "@/lib/supabase/types";

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
	message?: string;
	roasters: LeaderboardRoaster[];
	searchQuery?: string;
	startRank?: number;
};

const rowSpring = {
	type: "spring" as const,
	stiffness: 420,
	damping: 38,
	mass: 0.45,
};

function initials(name: string) {
	return name
		.split(/\s+/)
		.map((part) => part[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
}

function roasterName(roaster: LeaderboardRoaster) {
	return roaster.username || "Anonymous roaster";
}

function roleTag(roaster: LeaderboardRoaster) {
	if (roaster.role_tag) return roaster.role_tag;

	const role = `${roaster.target_role ?? ""} ${roaster.college ?? ""}`.toLowerCase();

	if (role.includes("student") || role.includes("college") || role.includes("iit")) {
		return "Student";
	}

	if (role.includes("switch")) {
		return "Career Switcher";
	}

	return "Job Seeker";
}

function tagClass(label: string) {
	if (label === "Student") {
		return "border-[#D9D0FF] bg-[#F1EDFF] text-[#5137B8] dark:border-[rgba(169,149,255,0.28)] dark:bg-[rgba(169,149,255,0.14)] dark:text-[#d7ceff]";
	}

	if (label === "Career Switcher") {
		return "border-[#CBDCFF] bg-[#EEF4FF] text-[#244EA8] dark:border-[rgba(110,165,255,0.28)] dark:bg-[rgba(110,165,255,0.14)] dark:text-[#b9d4ff]";
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
	return roaster.improvement ?? Math.min(96, 18 + roaster.helpful_votes * 4 + roaster.roast_count * 2);
}

function tableQuote(roaster: LeaderboardRoaster) {
	return roaster.top_roast?.content ?? "Helpful feedback in progress.";
}

function LeaderboardAvatar({ name }: { name: string }) {
	return (
		<div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-[rgba(214,179,100,0.72)] bg-[var(--bg-elevated)] shadow-sm">
			<img
				src="/assets/logo.png"
				alt=""
				className="h-full w-full object-cover grayscale"
				aria-hidden="true"
			/>
			<span className="sr-only">{initials(name)}</span>
		</div>
	);
}

function LeaderboardRow({
	rank,
	roaster,
}: {
	rank: number;
	roaster: LeaderboardRoaster;
}) {
	const name = roasterName(roaster);
	const tag = roleTag(roaster);

	return (
		<motion.div
			variants={{
				hidden: { opacity: 0, y: 10 },
				visible: { opacity: 1, y: 0 },
			}}
			transition={rowSpring}
			className="grid grid-cols-[58px_minmax(220px,1.15fr)_150px_150px_130px_minmax(180px,1fr)_120px] items-center gap-4 border-b border-[var(--border-subtle)] px-5 py-4 last:border-b-0 max-[1280px]:grid-cols-[48px_minmax(180px,1fr)_130px_130px_116px_112px] max-[1280px]:[&_.top-roast-cell]:hidden max-[760px]:grid-cols-1 max-[760px]:gap-2"
		>
			<div className="font-[var(--font-body)] text-2xl font-semibold text-[var(--text-primary)] max-[760px]:text-sm">
				<span className="max-[760px]:text-[var(--text-tertiary)]">Rank </span>#{rank}
			</div>

			<Link
				href={`/profile/${roaster.id}`}
				className="flex min-w-0 items-center gap-3 text-[var(--text-primary)]"
			>
				<LeaderboardAvatar name={name} />
				<div className="min-w-0">
					<strong className="block truncate text-sm font-bold">{name}</strong>
					<span className="block truncate text-xs text-[var(--text-secondary)]">
						{roaster.target_role || roaster.college || "Community reviewer"}
					</span>
				</div>
			</Link>

			<div>
				<span
					className={cn(
						"inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
						tagClass(tag),
					)}
				>
					{tag}
				</span>
			</div>

			<div className="flex items-center gap-2 font-[var(--font-body)] text-xl font-semibold text-[var(--text-primary)] max-[760px]:text-base">
				<Flame className="h-4 w-4 text-[var(--brand)]" aria-hidden="true" />
				{roastPoints(roaster).toLocaleString()}
			</div>

			<div className="text-sm font-bold text-[var(--success)]">
				+{improvement(roaster)}%
			</div>

			<div className="top-roast-cell min-w-0">
				<p className="truncate text-sm text-[var(--text-secondary)]">"{tableQuote(roaster)}"</p>
			</div>

			<Link
				href={
					roaster.top_roast
						? `/resume/${roaster.top_roast.resume_id}`
						: `/profile/${roaster.id}`
				}
				className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-bold text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface)]"
			>
				View Roast
				<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
			</Link>
		</motion.div>
	);
}

export function StackedList({
	message = "",
	roasters,
	searchQuery = "",
	startRank = 4,
}: StackedListProps) {
	const query = searchQuery.trim().toLowerCase();
	const filteredRoasters = query
		? roasters.filter((roaster) =>
				[
					roasterName(roaster),
					roaster.target_role,
					roaster.college,
					roleTag(roaster),
					roaster.top_roast?.content,
				]
					.filter(Boolean)
					.some((value) => value!.toLowerCase().includes(query)),
			)
		: roasters;

	return (
		<section className="overflow-hidden rounded-[24px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-md)]">
			<div className="grid grid-cols-[58px_minmax(220px,1.15fr)_150px_150px_130px_minmax(180px,1fr)_120px] gap-4 border-b border-[var(--border-subtle)] px-5 py-3 text-xs font-bold uppercase tracking-[0.06em] text-[var(--text-tertiary)] max-[1280px]:grid-cols-[48px_minmax(180px,1fr)_130px_130px_116px_112px] max-[1280px]:[&_.top-roast-head]:hidden max-[760px]:hidden">
				<span>Rank</span>
				<span>User</span>
				<span>Role</span>
				<span>Roast Points</span>
				<span>Improvement</span>
				<span className="top-roast-head">Top Roast</span>
				<span>Action</span>
			</div>

			{message ? <p className="form-message m-5">{message}</p> : null}

			<motion.div
				initial="hidden"
				animate="visible"
				variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
			>
				{filteredRoasters.map((roaster, index) => (
					<LeaderboardRow
						key={roaster.id}
						rank={startRank + index}
						roaster={roaster}
					/>
				))}
			</motion.div>

			{!filteredRoasters.length && !message ? (
				<div className="leaderboard-empty">
					<span className="empty-icon">#</span>
					<strong>No matching roasters</strong>
					<p>Try another search or help someone with a resume roast.</p>
					<Link href="/feed">Open the feed -&gt;</Link>
				</div>
			) : null}
		</section>
	);
}

export default StackedList;
