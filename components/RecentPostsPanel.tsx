"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clock, Menu, MessageCircle, X } from "@/components/ui/solar-icons";
import {
	clearRecentPosts,
	RECENT_POSTS_EVENT,
	readRecentPosts,
	removeRecentPosts,
	type RecentPostItem,
	type RecentPostKind,
} from "@/lib/recent-posts";
import { formatCount } from "@/lib/feed-ranking";
import { supabase } from "@/lib/supabase/client";

type RecentPostsPanelProps = {
	kind: RecentPostKind;
	surface?: "mobile-trigger" | "rail" | "rail-content";
};

function formatVisitedAt(value: string) {
	const date = new Date(value);
	const diff = Date.now() - date.getTime();
	const minute = 60_000;
	const hour = 60 * minute;
	const day = 24 * hour;

	if (!Number.isFinite(diff) || diff < minute) return "Now";
	if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))}m`;
	if (diff < day) return `${Math.floor(diff / hour)}h`;
	return `${Math.floor(diff / day)}d`;
}

function getPanelTitle(kind: RecentPostKind) {
	return kind === "resume" ? "Recent Resumes" : "Recent Posts";
}

function getEmptyCopy(kind: RecentPostKind) {
	return kind === "resume"
		? "Open a resume and it will appear here."
		: "Open a community post and it will appear here.";
}

async function getAvailableRecentPostIds(kind: RecentPostKind, ids: string[]) {
	if (!ids.length) return new Set<string>();

	if (kind === "community") {
		const { data, error } = await supabase
			.from("community_posts")
			.select("id,status")
			.in("id", ids);

		if (error) return null;

		return new Set(
			(data ?? [])
				.filter((post) => post.status === "active" || post.status === "locked")
				.map((post) => post.id),
		);
	}

	const { data, error } = await supabase
		.from("resumes")
		.select("id")
		.in("id", ids);

	if (error) return null;

	return new Set((data ?? []).map((resume) => resume.id));
}

function RecentPostPreview({ item }: { item: RecentPostItem }) {
	return (
		<Link className="recent-post-item" href={item.href}>
			<span className="recent-post-item-copy">
				<span className="recent-post-item-meta">
					{item.author ? <span>{item.author}</span> : null}
					<span aria-hidden="true">&middot;</span>
					<time dateTime={item.visitedAt}>{formatVisitedAt(item.visitedAt)}</time>
				</span>
				<strong>{item.title}</strong>
				<span className="recent-post-item-stats">
					{typeof item.votes === "number" ? (
						<span>{formatCount(item.votes)} points</span>
					) : null}
					{typeof item.comments === "number" ? (
						<span>
							<MessageCircle aria-hidden="true" />
							{formatCount(item.comments)}
						</span>
					) : null}
					{item.meta ? <span>{item.meta}</span> : null}
				</span>
			</span>
			{item.imageUrl ? (
				<span className="recent-post-thumb" aria-hidden="true">
					<img alt="" src={item.imageUrl} />
				</span>
			) : null}
		</Link>
	);
}

export default function RecentPostsPanel({
	kind,
	surface = "rail",
}: RecentPostsPanelProps) {
	const [items, setItems] = useState<RecentPostItem[]>([]);
	const [mobileOpen, setMobileOpen] = useState(false);
	const title = useMemo(() => getPanelTitle(kind), [kind]);

	useEffect(() => {
		function syncItems() {
			setItems(readRecentPosts(kind));
		}

		function handleRecentPostsChange(event: Event) {
			const detail = (event as CustomEvent<{ kind?: RecentPostKind }>).detail;
			if (!detail?.kind || detail.kind === kind) {
				syncItems();
			}
		}

		syncItems();
		window.addEventListener(RECENT_POSTS_EVENT, handleRecentPostsChange);
		window.addEventListener("storage", syncItems);

		return () => {
			window.removeEventListener(RECENT_POSTS_EVENT, handleRecentPostsChange);
			window.removeEventListener("storage", syncItems);
		};
	}, [kind]);

	useEffect(() => {
		if (!items.length) return;

		let cancelled = false;
		const itemIds = items.map((item) => item.id);

		async function pruneUnavailableItems() {
			const availableIds = await getAvailableRecentPostIds(kind, itemIds);
			if (cancelled || !availableIds) return;

			const staleIds = itemIds.filter((id) => !availableIds.has(id));
			if (staleIds.length) {
				removeRecentPosts(kind, staleIds);
			}
		}

		void pruneUnavailableItems();

		return () => {
			cancelled = true;
		};
	}, [items, kind]);

	useEffect(() => {
		if (!mobileOpen) return;

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				setMobileOpen(false);
			}
		}

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		window.addEventListener("keydown", handleKeyDown);

		return () => {
			document.body.style.overflow = previousOverflow;
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [mobileOpen]);

	function renderPanel(surface: "desktop" | "mobile") {
		const panelId = `recent-posts-${kind}-${surface}`;

		return (
			<section
				aria-label={title}
				className={`recent-posts-panel recent-posts-panel-${surface}`}
				id={panelId}
			>
				<header>
					<div>
						<h2>{title}</h2>
					</div>
					{items.length ? (
						<button
							className="recent-posts-clear"
							onClick={() => clearRecentPosts(kind)}
							type="button"
						>
							Clear
						</button>
					) : null}
					{surface === "mobile" ? (
						<button
							aria-label="Close recent posts"
							className="recent-posts-close"
							onClick={() => setMobileOpen(false)}
							type="button"
						>
							<X aria-hidden="true" />
						</button>
					) : null}
				</header>
				{items.length ? (
					<div className="recent-post-list">
						{items.map((item) => (
							<RecentPostPreview item={item} key={item.id} />
						))}
					</div>
				) : (
					<div className="recent-post-empty">
						<Clock aria-hidden="true" />
						<p>{getEmptyCopy(kind)}</p>
					</div>
				)}
			</section>
		);
	}

	if (surface === "rail") {
		return (
			<aside className="feed-right-rail recent-posts-rail">
				{renderPanel("desktop")}
			</aside>
		);
	}

	if (surface === "rail-content") {
		return renderPanel("desktop");
	}

	return (
		<>
			<button
				aria-controls={`recent-posts-${kind}-mobile`}
				aria-expanded={mobileOpen}
				className="recent-posts-mobile-trigger"
				onClick={() => setMobileOpen(true)}
				type="button"
			>
				<Menu aria-hidden="true" />
				<span>Recent</span>
			</button>
			{mobileOpen ? (
				<div
					className="recent-posts-drawer-backdrop"
					onClick={() => setMobileOpen(false)}
				>
					<div
						className="recent-posts-drawer"
						onClick={(event) => event.stopPropagation()}
					>
						{renderPanel("mobile")}
					</div>
				</div>
			) : null}
		</>
	);
}
