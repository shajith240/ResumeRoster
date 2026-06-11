const productFeatures = [
	{
		copy:
			"Resume owners can post with context, hide sensitive details, and ask for the kind of review they actually need.",
		kicker: "Safe resume posting",
		title: "Post safely with context.",
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
		title: "Rank useful advice.",
		visual: "fixes",
	},
	{
		copy:
			"Helpful reviewers build visible trust through useful contributions, leaderboards, and community reputation.",
		kicker: "Reviewer reputation",
		title: "Build reviewer trust.",
		visual: "trust",
	},
] as const;

function FeatureVisual({ type }: { type: (typeof productFeatures)[number]["visual"] }) {
	if (type === "feed") {
		return (
			<div className="feature-ui-window feature-ui-window-wide" aria-hidden="true">
				<div className="feature-ui-topbar">
					<span />
					<span />
					<span />
				</div>
				<div className="feature-ui-feed">
					<div className="feature-ui-profile">
						<span />
						<div>
							<strong>Resume Feed</strong>
							<p>Product intern • anonymized</p>
						</div>
					</div>
					<div className="feature-ui-resume-lines">
						<span />
						<span />
						<span />
						<span />
					</div>
					<div className="feature-ui-controls">
						<span>Identity hidden</span>
						<span>Context added</span>
					</div>
				</div>
			</div>
		);
	}

	if (type === "review") {
		return (
			<div className="feature-ui-review" aria-hidden="true">
				<div>
					<span>Weak bullet</span>
					<strong>“Worked on backend APIs”</strong>
				</div>
				<div>
					<span>Reviewer prompt</span>
					<strong>Add scope, metric, and user impact.</strong>
				</div>
			</div>
		);
	}

	if (type === "fixes") {
		return (
			<div className="feature-ui-fix-list" aria-hidden="true">
				{["Name the result", "Add proof", "Cut generic words"].map((item, index) => (
					<div key={item}>
						<span>{String(index + 1).padStart(2, "0")}</span>
						<p>{item}</p>
					</div>
				))}
			</div>
		);
	}

	return (
		<div className="feature-ui-trust" aria-hidden="true">
			<div>
				<strong>#08</strong>
				<span>Top reviewer</span>
			</div>
			<div>
				<strong>42</strong>
				<span>Helpful votes</span>
			</div>
			<div>
				<strong>Safe</strong>
				<span>Community trust</span>
			</div>
		</div>
	);
}

export function FeatureShowcase() {
	return (
		<section className="feature-lint-section" id="how-it-works">
			<div className="feature-system-shell">
				<div className="feature-system-header">
					<span className="section-kicker">How Linted works</span>
					<h2>Post, review, rank, and improve in one community loop.</h2>
					<p>
						Linted is not a resume score. It is a safer public review layer where
						people get specific fixes before they apply, and useful reviewers
						earn trust for helping.
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
