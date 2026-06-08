"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import BrandMark from "@/components/BrandMark";
import LandingCta from "@/components/LandingCta";
import { getAppHomeRoute } from "@/lib/app-routes";
import {
	asset,
	benefitImages,
	benefits,
	ratingStars,
	stackCards,
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

type StickyFeatureSectionProps = {
	pinHeadingRef: RefObject<HTMLDivElement | null>;
	pinSectionRef: RefObject<HTMLElement | null>;
	pinTrackRef: RefObject<HTMLDivElement | null>;
};

type BenefitsSectionProps = {
	activeBenefit: BenefitKey;
	setActiveBenefit: Dispatch<SetStateAction<BenefitKey>>;
};

type CardsStackSectionProps = {
	cardsStackRef: RefObject<HTMLElement | null>;
};

type QuoteSectionProps = {
	second?: boolean;
};

export function LandingNavbar({
	authReady,
	isSignedIn,
	navHidden,
}: LandingNavbarProps) {
	const appHomeRoute = getAppHomeRoute();

	return (
		<nav className={`navbar${navHidden ? " nav-hidden" : ""}`}>
			<div className="container nav-content">
				<Link className="landing-wordmark" href="/" aria-label="Linted home">
					<BrandMark />
				</Link>

				<div className="nav-links">
					{isSignedIn ? (
						<>
							<Link href={appHomeRoute}>Community</Link>
							<Link href="/feed">Resume Feed</Link>
							<Link href="/submit">Post resume</Link>
							<Link href="/leaderboard">Leaderboard</Link>
						</>
					) : (
						<>
							<a href="#how-it-works">How it works</a>
							<a href="#features">Features</a>
							<a href="#use-cases">Use cases</a>
							<a href="#proof">Proof</a>
						</>
					)}
				</div>

				<LandingCta
					className="nav-button"
					href={isSignedIn ? appHomeRoute : "/submit"}
					isSignedIn={isSignedIn}
				>
					{authReady && isSignedIn ? "Enter app" : "Sign up now"}
				</LandingCta>
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

					<h1>Resume feedback before you apply</h1>

					<p className="hero-subtext">
						Post anonymously. Get specific fixes from real people.
					</p>

					<LandingCta
						className="hero-btn"
						href={isSignedIn ? appHomeRoute : "/submit"}
						isSignedIn={isSignedIn}
					>
						{authReady && isSignedIn ? "Enter community" : "Lint my resume"}
					</LandingCta>
				</div>
			</section>

			<section className="trust-section" aria-label="Linted trust signals">
				<div className="trust-marquee">
					{[0, 1].map((groupIndex) => (
						<div
							aria-hidden={groupIndex === 1 ? "true" : undefined}
							className="trust-track"
							key={groupIndex}
						>
							{trustSignals.map((signal) => (
								<div className="trust-signal" key={`${groupIndex}-${signal}`}>
									<span>{signal}</span>
								</div>
							))}
						</div>
					))}
				</div>
			</section>
		</div>
	);
}

export function StickyFeatureSection({
	pinHeadingRef,
	pinSectionRef,
	pinTrackRef,
}: StickyFeatureSectionProps) {
	return (
		<section
			className="sticky-feature-section"
			id="features"
			data-pin-section
			ref={pinSectionRef}
		>
			<div className="sticky-content">
				<div className="stack-doodle-layer" aria-hidden="true">
					<img
						className="stack-doodle doodle-trash"
						src={asset("trashcan_doodle.png")}
						alt=""
					/>
					<img
						className="stack-doodle doodle-clock"
						src={asset("clock_doodle.png")}
						alt=""
					/>
					<img
						className="stack-doodle doodle-rejected"
						src={asset("rejected_doodle.png")}
						alt=""
					/>
					<img
						className="stack-doodle doodle-checklist"
						src={asset("checklist_doodle.png")}
						alt=""
					/>
					<img
						className="stack-doodle doodle-riphope"
						src={asset("riphope_doodle.png")}
						alt=""
					/>
					<img
						className="stack-doodle doodle-tryharder"
						src={asset("tryharder_doodle.png")}
						alt=""
					/>
				</div>
				<div className="sticky-heading" ref={pinHeadingRef}>
					<h2>Humans catch what scans miss</h2>
				</div>

				<div className="feature-cards" data-pin-track ref={pinTrackRef}>
					<div className="feature-card">
						<div className="feature-illustration feature-illustration-privacy">
							<img
								src={asset("post_without_exposing.png")}
								alt=""
								aria-hidden="true"
								loading="lazy"
								decoding="async"
							/>
						</div>
						<h3>Post without exposing yourself</h3>
						<p>
							Upload a redacted resume to the public feed so the work gets
							judged, not your name, college, or phone number.
						</p>
					</div>

					<div className="feature-card">
						<div className="feature-illustration feature-illustration-compiler">
							<img
								src={asset("Catch bugs before the compiler.png")}
								alt=""
								aria-hidden="true"
								loading="lazy"
								decoding="async"
							/>
						</div>
						<h3>Catch bugs before the compiler</h3>
						<p>
							Students, job seekers, and trusted reviewers point out vague
							bullets, missing proof, and recruiter red flags.
						</p>
					</div>

					<div className="feature-card">
						<div className="feature-illustration feature-illustration-promote">
							<img
								src={asset("promote the fix not the noise.png")}
								alt=""
								aria-hidden="true"
								loading="lazy"
								decoding="async"
							/>
						</div>
						<h3>Promote the fix, not the noise</h3>
						<p>
							Votes push the most useful fixes upward, while trusted reviewers
							build reputation for feedback that actually helps.
						</p>
					</div>
				</div>
			</div>
		</section>
	);
}

export function QuoteSection({ second = false }: QuoteSectionProps) {
	return (
		<section className={`quote-section${second ? " second-quote" : ""}`}>
			<div className="stars" aria-label="Five star review">
				{ratingStars.map((star) => (
					<Star aria-hidden="true" key={star} />
				))}
			</div>
			<blockquote>
				{second
					? '"My resume did not need a generic score. It needed someone to point at the bug and tell me the fix."'
					: '"The best comment read like a lint error: exact line, exact problem, exact fix."'}
			</blockquote>
			<p>{second ? "Anonymous software job seeker" : "Anonymous final-year student"}</p>
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
				<h2>Career linting, in public</h2>
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

export function CardsStackSection({ cardsStackRef }: CardsStackSectionProps) {
	return (
		<section className="cards-stack" ref={cardsStackRef}>
			<div className="stack-stage">
				<div className="stack-scene">
					<h2>Post. Fix. Apply.</h2>
					<div className="stack-list">
						{stackCards.map((card) => (
							<article className={`stack-card ${card.className}`} key={card.title}>
								<img
									className="stack-art"
									src={asset(card.image)}
									alt=""
									aria-hidden="true"
								/>
								<h3>{card.title}</h3>
								<p>{card.copy}</p>
							</article>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}

export function CtaBanner({ isSignedIn }: Pick<AuthLandingProps, "isSignedIn">) {
	return (
		<section className="cta-banner">
			<div>
				<h2>Pass the first scan</h2>
				<p>
					Run it through Linted before the recruiter/compiler rejects it. Post
					anonymously, collect fixes, and ship a cleaner version.
				</p>
				<LandingCta className="cta-link" href="/submit" isSignedIn={isSignedIn}>
					Run a lint pass
				</LandingCta>
			</div>
			<video
				className="cta-video"
				autoPlay
				muted
				loop
				playsInline
				aria-label="Resume first scan preview"
			>
				<source
					src={asset("Your resume should survive the first scan.webm")}
					type="video/webm"
				/>
			</video>
		</section>
	);
}
