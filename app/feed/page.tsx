import AuthGate from "@/components/AuthGate";
import CommunityStats from "@/components/CommunityStats";
import ResumeFeed, { type FeedSort } from "@/components/ResumeFeed";
import RouteHeader from "@/components/RouteHeader";
import Link from "next/link";

type FeedPageProps = {
	searchParams?: Promise<{
		sort?: string | string[];
		saved?: string | string[];
	}>;
};

function normalizeSort(value: string | string[] | undefined): FeedSort {
	const sort = Array.isArray(value) ? value[0] : value;

	return sort === "new" || sort === "top" || sort === "needs" ? sort : "best";
}

function normalizeSaved(value: string | string[] | undefined) {
	const saved = Array.isArray(value) ? value[0] : value;

	return saved === "1" || saved === "true";
}

export default async function FeedPage({ searchParams }: FeedPageProps) {
	const params = await searchParams;
	const activeSort = normalizeSort(params?.sort);
	const savedOnly = normalizeSaved(params?.saved);

	return (
		<AuthGate>
			<RouteHeader />
			<main className="feed-app-shell page-enter">
				<section className="feed-center">
					<div className="feed-community-header">
						<div>
							<h1>{savedOnly ? "Saved Resumes" : "Community Lint Feed"}</h1>
							<p>
								{savedOnly
									? "Return to the resumes you saved for another read."
									: "Anonymous resumes. Public checks. Sharpest fixes voted to the top."}
							</p>
						</div>
						<Link className="btn-primary" href="/submit">
							Post resume
						</Link>
					</div>
					<ResumeFeed activeSort={activeSort} savedOnly={savedOnly} />
				</section>

				<div className="feed-right-rail" aria-label="Community context">
					<section>
						<h2>About the feed</h2>
						<p>
							Post a resume, get specific feedback, and vote for the check
							that actually helps someone improve.
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
							<span className="feed-rules-eyebrow">Lint coach says</span>
							<h2 id="feed-rules-title">Community rules</h2>
							<ol className="feed-rules-list">
								<li>
									<strong>Protect privacy.</strong>
									<span>
										Use the privacy mode that fits what you want reviewed.
									</span>
								</li>
								<li>
									<strong>Lint the resume.</strong>
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
