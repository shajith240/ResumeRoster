"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowUp, MessageCircle as ChatCircle } from "@/components/ui/solar-icons";
import { supabase } from "@/lib/supabase/client";

type HighlightPost = {
	id: string;
	title: string;
	post_type: string;
	comment_count: number;
	upvote_count: number;
	created_at: string;
	authorName: string | null;
	imageUrl: string | null;
};

const TYPE_LABELS: Record<string, string> = {
	question: "Question",
	discussion: "Discussion",
	resource: "Resource",
	announcement: "Announcement",
};

function timeAgo(value: string): string {
	const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
	if (seconds < 60) return "just now";
	const m = Math.floor(seconds / 60);
	if (m < 60) return `${m}m ago`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ago`;
	const d = Math.floor(h / 24);
	if (d < 30) return `${d}d ago`;
	return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
		new Date(value),
	);
}

function HighlightCard({ post }: { post: HighlightPost }) {
	return (
		<Link className="ch-card" href={`/community/${post.id}`}>
			<div className="ch-card-inner">
				<div className="ch-card-content">
					<span className={`ch-type-badge ch-type-${post.post_type}`}>
						{TYPE_LABELS[post.post_type] ?? post.post_type}
					</span>
					<strong className="ch-title">{post.title}</strong>
					<div className="ch-footer">
						<div className="ch-meta">
							{post.authorName ? (
								<>
									<span>{post.authorName}</span>
									<span aria-hidden="true">·</span>
								</>
							) : null}
							<span>{timeAgo(post.created_at)}</span>
						</div>
						<div className="ch-stats">
							<span>
								<ChatCircle aria-hidden="true" />
								{post.comment_count}
							</span>
							{post.upvote_count > 0 ? (
								<span>
									<ArrowUp aria-hidden="true" />
									{post.upvote_count}
								</span>
							) : null}
						</div>
					</div>
				</div>
				{post.imageUrl ? (
					<div className="ch-thumb-wrap" aria-hidden="true">
						<img
							alt=""
							className="ch-thumb"
							loading="lazy"
							src={post.imageUrl}
						/>
					</div>
				) : null}
			</div>
		</Link>
	);
}

function SkeletonCard() {
	return (
		<div aria-hidden="true" className="ch-card ch-skeleton-card">
			<div className="ch-card-inner">
				<div className="ch-card-content">
					<span className="ch-skeleton-block ch-skeleton-badge" />
					<span className="ch-skeleton-block ch-skeleton-title-line" />
					<span className="ch-skeleton-block ch-skeleton-title-line ch-skeleton-title-short" />
					<span className="ch-skeleton-block ch-skeleton-meta-line" />
				</div>
			</div>
		</div>
	);
}

export default function CommunityHighlightsRail({ hidden }: { hidden?: boolean }) {
	const [posts, setPosts] = useState<HighlightPost[] | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function load() {
			const { data: rawPosts } = await supabase
				.from("community_posts")
				.select("id, title, post_type, comment_count, upvote_count, created_at, author_id")
				.in("status", ["active", "locked"])
				.order("last_activity_at", { ascending: false })
				.limit(3);

			if (cancelled) return;
			if (!rawPosts?.length) {
				setPosts([]);
				return;
			}

			const postIds = rawPosts.map((p) => p.id);
			const authorIds = [
				...new Set(rawPosts.map((p) => p.author_id).filter(Boolean)),
			] as string[];

			const [profileResult, attachmentResult] = await Promise.all([
				supabase
					.from("profiles")
					.select("id, username, full_name")
					.in("id", authorIds),
				supabase
					.from("community_post_attachments")
					.select("post_id, storage_path, display_order")
					.in("post_id", postIds)
					.order("display_order", { ascending: true }),
			]);

			if (cancelled) return;

			const nameMap = new Map(
				(profileResult.data ?? []).map((p) => [
					p.id,
					p.full_name || p.username || null,
				]),
			);

			const imageMap = new Map<string, string>();
			for (const att of attachmentResult.data ?? []) {
				if (!imageMap.has(att.post_id) && att.storage_path) {
					const { data } = supabase.storage
						.from("community-post-media")
						.getPublicUrl(att.storage_path);
					imageMap.set(att.post_id, data.publicUrl);
				}
			}

			setPosts(
				rawPosts.map((p) => ({
					id: p.id,
					title: p.title,
					post_type: p.post_type,
					comment_count: p.comment_count ?? 0,
					upvote_count: p.upvote_count ?? 0,
					created_at: p.created_at,
					authorName: nameMap.get(p.author_id) ?? null,
					imageUrl: imageMap.get(p.id) ?? null,
				})),
			);
		}

		void load();
		return () => {
			cancelled = true;
		};
	}, []);

	if (hidden) return null;

	if (posts === null) {
		return (
			<section aria-label="Community highlights loading" className="ch-rail">
				<div className="ch-header">
					<span className="ch-label">Community</span>
				</div>
				<div className="ch-scroll">
					<SkeletonCard />
					<SkeletonCard />
					<SkeletonCard />
				</div>
			</section>
		);
	}

	if (!posts.length) return null;

	return (
		<section aria-label="Community highlights" className="ch-rail">
			<div className="ch-header">
				<span className="ch-label">Community</span>
				<Link className="ch-view-all" href="/community">
					View all
					<ArrowRight aria-hidden="true" />
				</Link>
			</div>
			<div className="ch-scroll">
				{posts.map((post) => (
					<HighlightCard key={post.id} post={post} />
				))}
			</div>
		</section>
	);
}
