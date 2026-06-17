"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import BrandMark from "@/components/BrandMark";
import LandingCta from "@/components/LandingCta";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { LogoCloud } from "@/components/ui/logo-cloud-4";
import { getAppHomeRoute } from "@/lib/app-routes";
import { getLoginPath } from "@/lib/auth-redirect";
import {
	asset,
	benefitImages,
	benefits,
	comparisonRows,
	faqItems,
	productLoopSteps,
	reviewStandards,
	trustSignals,
	type BenefitKey,
} from "./content";
export { Footer } from "./footer";
export { FeatureShowcase } from "./feature-showcase";

type AuthLandingProps = {
	authReady: boolean;
	isSignedIn: boolean;
};

type LandingNavbarProps = AuthLandingProps & {
	navHidden: boolean;
};

type BenefitsSectionProps = {
	activeBenefit: BenefitKey;
	setActiveBenefit: Dispatch<SetStateAction<BenefitKey>>;
};

const productNavLinks = [
	{ href: "/community", label: "Community" },
	{ href: "/feed", label: "Resume Feed" },
	{ href: "/leaderboard", label: "Leaderboard" },
	{ href: "/guidelines", label: "Guidelines" },
];

export function LandingNavbar({
	authReady,
	isSignedIn,
	navHidden,
}: LandingNavbarProps) {
	const appHomeRoute = getAppHomeRoute();
	const [mobileNavOpen, setMobileNavOpen] = useState(false);
	const primaryCtaHref = isSignedIn ? appHomeRoute : "/submit";

	return (
		<nav className={`navbar${navHidden ? " nav-hidden" : ""}`} aria-label="Primary">
			<div className="container nav-content">
				<Link className="landing-wordmark" href="/" aria-label="Linted home">
					<BrandMark />
				</Link>

				<div
					className={`nav-links${mobileNavOpen ? " nav-links-open" : ""}`}
					id="landing-nav-links"
				>
					{productNavLinks.map((item) => (
						<Link
							href={item.href}
							key={item.href}
							onClick={() => setMobileNavOpen(false)}
						>
							{item.label}
						</Link>
					))}
				</div>

				<div className="nav-actions">
					{!isSignedIn ? (
						<Link className="nav-sign-in" href={getLoginPath(appHomeRoute)}>
							Sign in
						</Link>
					) : null}
					<LandingCta
						className="nav-button"
						href={primaryCtaHref}
						isSignedIn={isSignedIn}
					>
						{authReady && isSignedIn ? "Enter app" : "Post resume"}
					</LandingCta>
				</div>

				<button
					aria-controls="landing-nav-links"
					aria-expanded={mobileNavOpen}
					aria-label="Toggle navigation menu"
					className="nav-menu-button"
					onClick={() => setMobileNavOpen((open) => !open)}
					type="button"
				>
					{mobileNavOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
				</button>
			</div>
		</nav>
	);
}

export function HeroTrustSection({ authReady, isSignedIn }: AuthLandingProps) {
	const appHomeRoute = getAppHomeRoute();

	return (
		<div className="landing-first-screen">
			<section className="hero">
				<div className="container hero-content">
					<div className="hero-visual">
						<video
							className="hero-illustration"
							autoPlay
							muted
							loop
							playsInline
							aria-label="Linted preview"
						>
							<source src={asset("Hero_section_animation.webm")} type="video/webm" />
						</video>
					</div>

					<h1>Fix your resume before recruiters see it</h1>

					<p className="hero-subtext">
						Post safely, get line-level fixes, and apply with a cleaner resume.
					</p>

					<LandingCta
						className="hero-btn"
						href={isSignedIn ? appHomeRoute : "/submit"}
						isSignedIn={isSignedIn}
					>
						{authReady && isSignedIn ? "Enter community" : "Post my resume"}
					</LandingCta>
				</div>
			</section>

			<section className="trust-section" aria-label="Linted trust signals">
				<LogoCloud logos={trustSignals.map((signal) => ({ alt: signal }))} />
			</section>
		</div>
	);
}

export function ReviewStandardsSection() {
	return (
		<section className="review-standard-section" id="features">
			<div className="review-standard-copy">
				<span className="section-kicker">How reviews work</span>
				<h2>Linted keeps feedback specific.</h2>
				<p>
					Every piece of feedback must name the exact line, explain why it matters,
					and leave the resume owner with a clear next step.
				</p>
			</div>

			<div className="review-standard-panel" aria-label="Linted review standard">
				<div className="review-standard-visual" aria-hidden="true">
					<img src={asset("checklist_doodle.png")} alt="" />
				</div>

				<div className="review-standard-list">
					{reviewStandards.map((item, index) => (
						<article className="review-standard-item" key={item.title}>
							<span>{String(index + 1).padStart(2, "0")}</span>
							<div>
								<h3>{item.title}</h3>
								<p>{item.copy}</p>
							</div>
						</article>
					))}
				</div>
			</div>
		</section>
	);
}

export function BenefitsSection({
	activeBenefit,
	setActiveBenefit,
}: BenefitsSectionProps) {
	const benefitImage = benefitImages[activeBenefit];

	return (
		<section className="benefits" id="use-cases">
			<div className="benefits-copy">
				<h2>Built for real resume moments</h2>
				{benefits.map((benefit) => {
					const isActive = activeBenefit === benefit.key;
					return (
						<div
							className={`benefit-item${isActive ? " active" : ""}`}
							data-benefit={benefit.key}
							key={benefit.key}
						>
							<button
								className="benefit-toggle"
								type="button"
								aria-expanded={isActive}
								onClick={() => setActiveBenefit(benefit.key)}
							>
								<span>{benefit.label}</span>
							</button>
							<p>{benefit.copy}</p>
						</div>
					);
				})}
			</div>
			<figure className="benefit-image-card">
				<img src={benefitImage.src} alt={benefitImage.alt} />
			</figure>
		</section>
	);
}

export function ComparisonSection() {
	return (
		<section className="comparison-section" aria-labelledby="comparison-heading">
			<div className="comparison-header">
				<span className="section-kicker">Comparison</span>
				<h2 id="comparison-heading">Built for what AI resume tools miss.</h2>
				<p>
					Resume scanners and builders are great for speed. Linted covers the
					human step — specific fixes from real people, with votes to surface
					what actually helps.
				</p>
			</div>

			<div className="comparison-table-wrap">
				<table className="comparison-table">
					<caption className="sr-only">
						Linted compared with Resume Worded and Rezi
					</caption>
					<thead>
						<tr>
							<th scope="col">Decision point</th>
							<th className="comparison-primary" scope="col">
								Linted
							</th>
							<th scope="col">Resume Worded</th>
							<th scope="col">Rezi</th>
						</tr>
					</thead>
					<tbody>
						{comparisonRows.map((row) => (
							<tr key={row.feature}>
								<th scope="row">{row.feature}</th>
								<td className="comparison-primary">{row.linted}</td>
								<td>{row.resumeWorded}</td>
								<td>{row.rezi}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	);
}

export function FaqSection() {
	return (
		<section className="faq-section" aria-labelledby="faq-heading">
			<div className="faq-header">
				<span className="section-kicker">FAQ</span>
				<h2 id="faq-heading">Questions before you post.</h2>
				<p>
					The short version: Linted is for getting specific human feedback while
					keeping the community useful and safer to participate in.
				</p>
			</div>

			<Accordion className="faq-list" type="multiple">
				{faqItems.map((item) => (
					<AccordionItem className="faq-item" key={item.value} value={item.value}>
						<AccordionTrigger className="faq-trigger">
							{item.question}
						</AccordionTrigger>
						<AccordionContent className="faq-content">
							<p>{item.answer}</p>
						</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
		</section>
	);
}

export function ProductLoopSection() {
	return (
		<section className="product-loop-section" id="community-loop">
			<div className="product-loop-copy">
				<span className="section-kicker">Step by step</span>
				<h2>Post once. Leave with real fixes.</h2>
				<p>
					Linted is built for the stage just before applying: when your resume
					looks done, but someone else can still catch what is unclear.
				</p>
				<div className="product-loop-promise" aria-label="Linted product promise">
					<strong>No fake resume score.</strong>
					<span>Specific feedback, visible trust, and safer posting rules.</span>
				</div>
			</div>

			<div className="product-loop-flow" aria-label="How Linted works">
				{productLoopSteps.map((step, index) => (
					<article className="product-loop-step" key={step.title}>
						<span className="product-loop-index">
							{String(index + 1).padStart(2, "0")}
						</span>
						<div>
							<span>{step.label}</span>
							<h3>{step.title}</h3>
							<p>{step.copy}</p>
						</div>
					</article>
				))}

				<div className="product-loop-outcome">
					<span>Outcome</span>
					<p>
						The resume owner leaves with a ranked fix list. The community gets
						rewarded for feedback people can actually use.
					</p>
				</div>
			</div>
		</section>
	);
}
