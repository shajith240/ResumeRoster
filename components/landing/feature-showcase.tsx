"use client";

import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "@/components/ui/solar-icons";
import {
	featureContent,
	featureTabs,
	type FeatureKey,
} from "./content";

type FeatureShowcaseProps = {
	activeFeature: FeatureKey;
	setActiveFeature: Dispatch<SetStateAction<FeatureKey>>;
};

export function FeatureShowcase({
	activeFeature,
	setActiveFeature,
}: FeatureShowcaseProps) {
	const feature = featureContent[activeFeature];
	const fallbackFeatureTab = featureTabs[0];
	const foundFeatureIndex = featureTabs.findIndex(
		(tab) => tab.key === activeFeature,
	);
	const activeFeatureIndex = foundFeatureIndex >= 0 ? foundFeatureIndex : 0;
	const activeFeatureTab = featureTabs[activeFeatureIndex] ?? fallbackFeatureTab;
	const setAdjacentFeature = (direction: -1 | 1) => {
		const nextIndex =
			(activeFeatureIndex + direction + featureTabs.length) % featureTabs.length;
		const nextFeature = featureTabs[nextIndex] ?? fallbackFeatureTab;
		setActiveFeature(nextFeature.key);
	};

	return (
		<section className="feature-lint-section" id="how-it-works">
			<div className="feature-header">
				<h2>A lint pass for your career</h2>

				<div
					className="feature-tabs"
					role="tablist"
					aria-label="Linted community features"
				>
					{featureTabs.map((tab) => {
						const isActive = activeFeature === tab.key;
						return (
							<button
								className={`feature-tab${isActive ? " active" : ""}`}
								type="button"
								role="tab"
								aria-selected={isActive}
								data-feature={tab.key}
								onClick={() => setActiveFeature(tab.key)}
								key={tab.key}
							>
								{tab.label}
							</button>
						);
					})}
				</div>

				<div
					className="feature-mobile-control"
					aria-label="Linted feature showcase controls"
				>
					<button
						aria-label="Previous feature"
						className="feature-mobile-arrow"
						onClick={() => setAdjacentFeature(-1)}
						type="button"
					>
						<ChevronLeft aria-hidden="true" size={16} strokeWidth={2.2} />
					</button>

					<div className="feature-mobile-status" aria-live="polite">
						<strong>{activeFeatureTab.mobileLabel}</strong>
					</div>

					<div
						className="feature-dots"
						role="tablist"
						aria-label="Select showcase step"
					>
						{featureTabs.map((tab) => {
							const isActive = activeFeature === tab.key;
							return (
								<button
									aria-label={`Show ${tab.label}`}
									aria-selected={isActive}
									className={`feature-dot${isActive ? " active" : ""}`}
									key={tab.key}
									onClick={() => setActiveFeature(tab.key)}
									role="tab"
									type="button"
								/>
							);
						})}
					</div>

					<button
						aria-label="Next feature"
						className="feature-mobile-arrow"
						onClick={() => setAdjacentFeature(1)}
						type="button"
					>
						<ChevronRight aria-hidden="true" size={16} strokeWidth={2.2} />
					</button>
				</div>
			</div>

			<div
				className="feature-showcase"
				data-feature-section
				data-theme={feature.theme}
			>
				<div className="showcase-wrapper">
					<div className="showcase-info">
						<h3>{feature.title}</h3>
						<p>{feature.copy}</p>
						<Link className="showcase-link" href="/feed">
							Open Resume Feed
						</Link>
					</div>

					<div className="showcase-video">
						<div className="resume-window">
							<div className="window-top">
								<span />
								<span />
								<span />
							</div>
							<div className="score-strip">
								<div>
									<strong>{feature.score}</strong>
									<span>{feature.scoreLabel}</span>
								</div>
								<p>{feature.insight}</p>
							</div>
							<div className="resume-grid">
								<div className="resume-page">
									<h4>{feature.panelTitle}</h4>
									<p className="line wide" />
									<p className="line" />
									<p className="line short" />
									<div className="note good">{feature.good}</div>
									<div className="note warn">{feature.warn}</div>
									<p className="line wide" />
									<p className="line" />
									<p className="line short" />
								</div>
								<div className="insight-panel">
									<h4>{feature.listTitle}</h4>
									<ul>
										{feature.points.map((point) => (
											<li key={point}>{point}</li>
										))}
									</ul>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
