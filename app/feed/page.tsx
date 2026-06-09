import AuthGate from "@/components/AuthGate";
import PersonalizeLintedPrompt from "@/components/PersonalizeLintedPrompt";
import RecentPostsPanel from "@/components/RecentPostsPanel";
import ResumeFeed, { type FeedSort } from "@/components/ResumeFeed";
import RouteHeader from "@/components/RouteHeader";
import ResumeFeedHeader from "@/components/resume-feed/ResumeFeedHeader";
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
			"Start with resumes that have the fewest reviews. Guided prompts will help you leave useful feedback.",
		primaryHref: "/feed?sort=needs",
		primaryLabel: "Find resumes to review",
		secondaryHref: "/submit",
		secondaryLabel: "Post your resume",
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
			<RouteHeader hideAppHeaderOnMobile />
			<main className="feed-app-shell resume-feed-route page-enter">
				<section className="feed-center">
					<ResumeFeedHeader
						actionHref="/submit"
						actionLabel="Post resume"
						description={
							savedOnly
								? "Return to the resumes you saved for another read."
								: "Anonymous resumes. Public checks. Sharpest fixes voted to the top."
						}
						title={savedOnly ? "Saved Resumes" : "Resume Feed"}
					/>
					{welcomeState ? (
						<section
							className="feed-welcome-card"
							aria-label="Personalized start"
						>
							<div>
								<span>Setup complete</span>
								<h2>{welcomeState.title}</h2>
								<p>{welcomeState.body}</p>
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

				<RecentPostsPanel kind="resume" surface="rail" />
			</main>
		</AuthGate>
	);
}
