"use client";

import LintPointsFlame from "@/components/LintPointsFlame";
import { ArrowRight } from "@/components/ui/solar-icons";

const productFeatures = [
	{
		copy:
			"Resume owners can hide sensitive details, add role context, and ask for the kind of review they actually need.",
		kicker: "Privacy controls",
		title: "Post with privacy.",
		visual: "feed",
	},
	{
		copy:
			"Review prompts push people to point at the exact line, explain the risk, and suggest a useful next edit.",
		kicker: "Guided feedback",
		title: "Get guided line fixes.",
		visual: "review",
	},
	{
		copy:
			"Votes and rules move strong feedback above vague comments, jokes, and low-effort takes.",
		kicker: "Ranked fix list",
		title: "Fixes, ranked by votes.",
		visual: "fixes",
	},
	{
		copy:
			"Helpful reviewers build a public reputation through useful feedback, leaderboard rankings, and community contributions.",
		kicker: "Reviewer reputation",
		title: "Earn a public reputation.",
		visual: "trust",
	},
] as const;

const PRIVACY_OPTIONS = [
	{
		label: "Public",
		desc: "Your name and contact appear with the post.",
		selected: false,
	},
	{
		label: "Hide contacts",
		desc: "Name shows but email and phone are removed.",
		selected: true,
	},
	{
		label: "Anonymous",
		desc: "No name, contact, or profile links shown.",
		selected: false,
	},
];

const REVIEW_CHIPS = [
	{ label: "Missing impact", selected: true },
	{ label: "Clarity issue", selected: false },
	{ label: "Too generic", selected: false },
	{ label: "Weak project", selected: false },
	{ label: "Role fit", selected: false },
];

const RANKED_COMMENTS = [
	{
		handle: "@deepanalyze",
		initial: "D",
		avatarGrad: "linear-gradient(135deg, #6366f1, #8b5cf6)",
		text: `Name the result. "Led backend work" needs a metric and a user count.`,
		votes: 47,
		top: true,
	},
	{
		handle: "@carefulanalyst",
		initial: "C",
		avatarGrad: "linear-gradient(135deg, #06b6d4, #3b82f6)",
		text: "Cut 'responsible for'. Lead with the action verb and the outcome.",
		votes: 23,
		top: false,
	},
	{
		handle: "@resume_critic",
		initial: "R",
		avatarGrad: "linear-gradient(135deg, #f59e0b, #ef4444)",
		text: "Skills section lists 22 tools. Pick the 6 most relevant for this role.",
		votes: 8,
		top: false,
	},
];

const LEADERBOARD_ROWS = [
	{
		rank: 1,
		name: "Deep Analyze",
		role: "Frontend Lead",
		points: "1,240",
		initial: "D",
		avatarGrad: "linear-gradient(135deg, #6366f1, #8b5cf6)",
		top: true,
	},
	{
		rank: 2,
		name: "Careful Analyst",
		role: "Product Manager",
		points: "980",
		initial: "C",
		avatarGrad: "linear-gradient(135deg, #06b6d4, #3b82f6)",
		top: false,
	},
	{
		rank: 3,
		name: "Resume Critic",
		role: "Data Scientist",
		points: "847",
		initial: "R",
		avatarGrad: "linear-gradient(135deg, #f59e0b, #ef4444)",
		top: false,
	},
	{
		rank: 4,
		name: "Tech Reviewer",
		role: "Software Engineer",
		points: "612",
		initial: "T",
		avatarGrad: "linear-gradient(135deg, #10b981, #06b6d4)",
		top: false,
	},
	{
		rank: 5,
		name: "API Builder",
		role: "Backend Engineer",
		points: "534",
		initial: "A",
		avatarGrad: "linear-gradient(135deg, #ec4899, #8b5cf6)",
		top: false,
	},
	{
		rank: 6,
		name: "Product Lens",
		role: "UX Researcher",
		points: "481",
		initial: "P",
		avatarGrad: "linear-gradient(135deg, #f59e0b, #10b981)",
		top: false,
	},
	{
		rank: 7,
		name: "Nit Picker",
		role: "Staff Engineer",
		points: "392",
		initial: "N",
		avatarGrad: "linear-gradient(135deg, #3b82f6, #10b981)",
		top: false,
	},
	{
		rank: 8,
		name: "Word Surgeon",
		role: "Tech Lead",
		points: "318",
		initial: "W",
		avatarGrad: "linear-gradient(135deg, #ef4444, #f59e0b)",
		top: false,
	},
];

function PrivacyMockup() {
	return (
		<div className="fmock fmock-app-shell" aria-hidden="true">
			<div className="fmock-privacy-label">Privacy mode</div>
			<div className="fmock-privacy-grid">
				{PRIVACY_OPTIONS.map((opt) => (
					<div
						key={opt.label}
						className={`fmock-privacy-option${opt.selected ? " is-selected" : ""}`}
					>
						<div className="fmock-radio">
							<div
								className={`fmock-radio-dot${opt.selected ? " is-selected" : ""}`}
							/>
							<span className="fmock-privacy-title">{opt.label}</span>
						</div>
						<div className="fmock-privacy-desc">{opt.desc}</div>
					</div>
				))}
			</div>
			<div className="fmock-privacy-hint">
				Good default: hides contact details while keeping links that help reviewers judge project credibility.
			</div>
		</div>
	);
}

function FeedbackMockup() {
	return (
		<div className="fmock fmock-app-shell" aria-hidden="true">
			<div className="fmock-composer">
				<div className="fmock-chip-row">
					{REVIEW_CHIPS.map((chip) => (
						<span
							key={chip.label}
							className={`fmock-chip${chip.selected ? " is-selected" : ""}`}
						>
							{chip.label}
						</span>
					))}
				</div>
				<div>
					<div className="fmock-field-label">What is the issue?</div>
					<div className="fmock-field">
						"Worked on backend APIs" — no metrics, no scope, no user impact.
					</div>
				</div>
				<div>
					<div className="fmock-field-label">What should they change?</div>
					<div className="fmock-field">
						Add scope + a metric. E.g. "Built 3 REST APIs serving 12k users monthly."
					</div>
				</div>
				<div className="fmock-submit-row">
					<div className="fmock-submit-btn">Submit</div>
				</div>
			</div>
		</div>
	);
}

function RankedMockup() {
	return (
		<div className="fmock fmock-app-shell" aria-hidden="true">
			<div className="fmock-comment-header">
				<span>3 reviews</span>
				<span>by votes</span>
			</div>
			<div className="fmock-comment-list">
				{RANKED_COMMENTS.map((c) => (
					<div
						key={c.handle}
						className={`fmock-comment${c.top ? " is-top" : ""}`}
					>
						<div className="fmock-comment-meta">
							<div className="fmock-avatar-row">
								<div
									className="fmock-avatar"
									style={{ background: c.avatarGrad }}
								>
									{c.initial}
								</div>
								<span className="fmock-handle">{c.handle}</span>
							</div>
							<div className={`fmock-vote${c.top ? " is-top" : ""}`}>
								♥ {c.votes}
							</div>
						</div>
						<div className="fmock-comment-text">{c.text}</div>
					</div>
				))}
			</div>
		</div>
	);
}

function ReputationMockup() {
	return (
		<div className="fmock fmock-app-shell" aria-hidden="true">
			<div className="fmock-board-header">
				<span className="fmock-board-title">Top Reviewers</span>
				<span className="fmock-board-range">This week</span>
			</div>
			<div className="fmock-reviewer-list">
				{LEADERBOARD_ROWS.map((r) => (
					<div
						key={r.rank}
						className={`fmock-reviewer-row${r.top ? " is-top" : ""}`}
					>
						<span className="fmock-rank">#{r.rank}</span>
						<div
							className="fmock-avatar"
							style={{ background: r.avatarGrad }}
						>
							{r.initial}
						</div>
						<div>
							<div className="fmock-reviewer-name">{r.name}</div>
							<div className="fmock-reviewer-role">{r.role}</div>
						</div>
						<div className="fmock-points">
							<LintPointsFlame
								animated
								className="h-[18px] w-[18px]"
								fallbackClassName="h-[18px] w-[18px]"
							/>
							{r.points}
						</div>
						<div className="fmock-arrow">
							<ArrowRight className="h-3 w-3" aria-hidden="true" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

function FeatureVisual({
	type,
}: {
	type: (typeof productFeatures)[number]["visual"];
}) {
	if (type === "feed") return <PrivacyMockup />;
	if (type === "review") return <FeedbackMockup />;
	if (type === "fixes") return <RankedMockup />;
	return <ReputationMockup />;
}

export function FeatureShowcase() {
	return (
		<section className="feature-lint-section" id="how-it-works">
			<div className="feature-system-shell">
				<div className="feature-system-header">
					<span className="section-kicker">How Linted works</span>
					<h2>Post. Review. Rank. Improve.</h2>
					<p>
						Linted is not a resume score. It is a community where job seekers
						get real, specific feedback before applying, and helpful reviewers
						earn a public reputation for it.
					</p>
				</div>

				<div className="feature-system-grid" aria-label="Linted product features">
					{productFeatures.map((feature, index) => {
						const isLarge = index === 0 || index === 3;
						return (
							<article
								className={`feature-system-card${
									isLarge ? " feature-system-card-large" : ""
								}`}
								key={feature.title}
							>
								<div className="feature-system-copy">
									<span>{feature.kicker}</span>
									<h3>{feature.title}</h3>
									<p>{feature.copy}</p>
								</div>

								<div
									className="feature-system-visual"
									data-visual={feature.visual}
								>
									<FeatureVisual type={feature.visual} />
								</div>
							</article>
						);
					})}
				</div>
			</div>
		</section>
	);
}
