import AuthGate from "@/components/AuthGate";
import CommunityStats from "@/components/CommunityStats";
import InfoHint from "@/components/InfoHint";
import PersonalizeLintedPrompt from "@/components/PersonalizeLintedPrompt";
import ResumeFeed, { type FeedSort } from "@/components/ResumeFeed";
import RouteHeader from "@/components/RouteHeader";
import Link from "next/link";

type FeedPageProps = {
	searchParams?: Promise<{
		sort?: string | string[];
		saved?: string | string[];
		welcome?: string | string[];
	}>;
};

type FeedWelcome = "candidate" | "reviewer" | "both";

const welcomeContent: Record<
	FeedWelcome,
	{
		body: string;
		primaryHref: string;
		primaryLabel: string;
		secondaryHref: string;
		secondaryLabel: string;
		title: string;
	}
> = {
	both: {
		body:
			"Post your own resume or help clear resumes waiting for feedback. Both paths stay open.",
		primaryHref: "/submit",
		primaryLabel: "Post resume",
		secondaryHref: "/feed?sort=needs",
		secondaryLabel: "Review needs queue",
		title: "You can get feedback and review",
	},
	candidate: {
		body:
			"Start with one resume. You can still review any open resume whenever you want to help.",
		primaryHref: "/submit",
		primaryLabel: "Post your first resume",
		secondaryHref: "/feed?sort=needs",
		secondaryLabel: "Browse resumes",
		title: "Ready to lint your resume",
	},
	reviewer: {
		body:
			"Start with resumes that have the fewest reviews, then finish your reviewer profile when you are ready.",
		primaryHref: "/feed?sort=needs",
		primaryLabel: "Find resumes to review",
		secondaryHref: "/profile/me",
		secondaryLabel: "Update profile",
		title: "Help the queue move",
	},
};

function normalizeSort(value: string | string[] | undefined): FeedSort {
	const sort = Array.isArray(value) ? value[0] : value;

	return sort === "new" || sort === "top" || sort === "needs" ? sort : "best";
}

function normalizeSaved(value: string | string[] | undefined) {
	const saved = Array.isArray(value) ? value[0] : value;

	return saved === "1" || saved === "true";
}

function normalizeWelcome(
	value: string | string[] | undefined,
): FeedWelcome | null {
	const welcome = Array.isArray(value) ? value[0] : value;

	return welcome === "candidate" || welcome === "reviewer" || welcome === "both"
		? welcome
		: null;
}

export default async function FeedPage({ searchParams }: FeedPageProps) {
	const params = await searchParams;
	const activeSort = normalizeSort(params?.sort);
	const savedOnly = normalizeSaved(params?.saved);
	const welcome = normalizeWelcome(params?.welcome);
	const welcomeState = welcome ? welcomeContent[welcome] : null;

	return (
		<AuthGate>
			<RouteHeader />
			<main className="feed-app-shell page-enter">
				<section className="feed-center">
					<div className="feed-community-header">
						<div>
							<h1>{savedOnly ? "Saved Resumes" : "Community Lint Feed"}</h1>
						</div>
						<Link className="btn-primary" href="/submit">
							Post resume
						</Link>
					</div>
					{welcomeState ? (
						<section
							className="feed-welcome-card"
							aria-label="Personalized start"
						>
							<div>
								<span>Setup complete</span>
								<h2 className="info-row">
									{welcomeState.title}
									<InfoHint align="right">{welcomeState.body}</InfoHint>
								</h2>
							</div>
							<div className="feed-welcome-actions">
								<Link className="btn-primary" href={welcomeState.primaryHref}>
									{welcomeState.primaryLabel}
								</Link>
								<Link
									className="feed-welcome-secondary"
									href={welcomeState.secondaryHref}
								>
									{welcomeState.secondaryLabel}
								</Link>
							</div>
						</section>
					) : null}
					<PersonalizeLintedPrompt disabled={Boolean(welcomeState) || savedOnly} />
					<ResumeFeed activeSort={activeSort} savedOnly={savedOnly} />
				</section>

				<div className="feed-right-rail" aria-label="Community context">
					<section>
						<h2 className="info-row">
							About the feed
							<InfoHint align="left">
								Post a resume, get specific feedback, and vote for the check
								that actually helps someone improve.
							</InfoHint>
						</h2>
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
									<strong className="info-row">
										Protect privacy
										<InfoHint align="right">
											Use the privacy mode that fits what you want reviewed.
										</InfoHint>
									</strong>
								</li>
								<li>
									<strong className="info-row">
										Lint the resume
										<InfoHint align="right">
											Attack weak bullets, unclear impact, and messy structure.
										</InfoHint>
									</strong>
								</li>
								<li>
									<strong className="info-row">
										Give a fix
										<InfoHint align="right">
											Point out what to rewrite, reorder, quantify, or remove.
										</InfoHint>
									</strong>
								</li>
								<li>
									<strong className="info-row">
										Keep it useful
										<InfoHint align="right">
											No personal shots, spam, or private details in comments.
										</InfoHint>
									</strong>
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
