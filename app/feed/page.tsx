import AuthGate from "@/components/AuthGate";
import CommunityStats from "@/components/CommunityStats";
import ResumeFeed, { type FeedSort } from "@/components/ResumeFeed";
import RouteHeader from "@/components/RouteHeader";
import RouteScrollProxy from "@/components/RouteScrollProxy";
import Link from "next/link";

type FeedPageProps = {
	searchParams?: Promise<{
		sort?: string | string[];
	}>;
};

function normalizeSort(value: string | string[] | undefined): FeedSort {
	const sort = Array.isArray(value) ? value[0] : value;

	return sort === "new" || sort === "top" ? sort : "best";
}

export default async function FeedPage({ searchParams }: FeedPageProps) {
	const params = await searchParams;
	const activeSort = normalizeSort(params?.sort);

	return (
		<AuthGate>
			<RouteHeader />
			<main className="feed-app-shell page-enter">
				<RouteScrollProxy targetSelector=".feed-center" />
				<section className="feed-center">
					<div className="feed-community-header">
						<div>
							<h1>Community Roast Feed</h1>
							<p>
								Anonymous resumes. Public feedback. Sharpest roasts voted to the
								top.
							</p>
						</div>
						<Link className="btn-primary" href="/submit">
							Post resume
						</Link>
					</div>
					<ResumeFeed activeSort={activeSort} />
				</section>

				<div className="feed-right-rail" aria-label="Community context">
					<section>
						<h2>About the feed</h2>
						<p>
							Post a redacted resume, get specific feedback, and vote for the
							roast that actually helps someone improve.
						</p>
						<div className="rail-meta">Created May 2026</div>
					</section>

					<section className="feed-stats-panel">
						<h2>Community stats</h2>
						<CommunityStats />
					</section>

					<section
						className="feed-rules-panel"
						aria-labelledby="feed-rules-title"
					>
						<div className="feed-rules-copy">
							<span className="feed-rules-eyebrow">Roast coach says</span>
							<h2 id="feed-rules-title">Community rules</h2>
							<ol className="feed-rules-list">
								<li>
									<strong>Redact first.</strong>
									<span>
										Hide names, emails, phone numbers, links, and IDs.
									</span>
								</li>
								<li>
									<strong>Roast the resume.</strong>
									<span>
										Attack weak bullets, unclear impact, and messy structure.
									</span>
								</li>
								<li>
									<strong>Give a fix.</strong>
									<span>
										Point out what to rewrite, reorder, quantify, or remove.
									</span>
								</li>
								<li>
									<strong>Keep it useful.</strong>
									<span>
										No personal shots, spam, or private details in comments.
									</span>
								</li>
							</ol>
						</div>
						<div className="feed-rules-visual" aria-hidden="true">
							<img
								className="feed-rules-guide"
								src="/assets/rules%20explaining%20image.png"
								alt=""
							/>
						</div>
					</section>
				</div>
			</main>
		</AuthGate>
	);
}
