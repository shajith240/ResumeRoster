"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import LoadingScreen from "@/components/LoadingScreen";
import { type BenefitKey, type FeatureKey } from "@/components/landing/content";
import {
	BenefitsSection,
	CardsStackSection,
	CtaBanner,
	FeatureShowcase,
	Footer,
	HeroTrustSection,
	LandingNavbar,
	QuoteSection,
	StickyFeatureSection,
} from "@/components/landing/sections";
import { getAppHomeRoute } from "@/lib/app-routes";
import { supabase } from "@/lib/supabase/client";

function isSmallScreen() {
	return typeof window.matchMedia === "function"
		? window.matchMedia("(max-width: 760px)").matches
		: window.innerWidth <= 760;
}

export default function Home() {
	const router = useRouter();
	const [activeFeature, setActiveFeature] = useState<FeatureKey>("ats");
	const [activeBenefit, setActiveBenefit] = useState<BenefitKey>("students");
	const [navHidden, setNavHidden] = useState(false);
	const [user, setUser] = useState<User | null>(null);
	const [authReady, setAuthReady] = useState(false);
	const pinSectionRef = useRef<HTMLElement | null>(null);
	const pinTrackRef = useRef<HTMLDivElement | null>(null);
	const pinHeadingRef = useRef<HTMLDivElement | null>(null);
	const cardsStackRef = useRef<HTMLElement | null>(null);
	const lastScrollY = useRef(0);
	const isSignedIn = Boolean(user);
	const appHomeRoute = getAppHomeRoute();

	useEffect(() => {
		let active = true;

		supabase.auth.getUser().then(({ data }) => {
			if (!active) return;
			setUser(data.user);
			setAuthReady(true);
			if (data.user) {
				router.replace(appHomeRoute);
			}
		});

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			setUser(session?.user ?? null);
			setAuthReady(true);
			if (session?.user) {
				router.replace(appHomeRoute);
			}
		});

		return () => {
			active = false;
			subscription.unsubscribe();
		};
	}, [appHomeRoute, router]);

	useEffect(() => {
		function updateNavbarVisibility() {
			const currentScrollY = window.scrollY;
			const scrollingDown = currentScrollY > lastScrollY.current;
			const pastHeroStart = currentScrollY > 120;

			setNavHidden(scrollingDown && pastHeroStart);
			lastScrollY.current = currentScrollY;
		}

		updateNavbarVisibility();
		window.addEventListener("scroll", updateNavbarVisibility, { passive: true });
		return () => window.removeEventListener("scroll", updateNavbarVisibility);
	}, []);

	useEffect(() => {
		function updatePinnedFeature() {
			const pinSection = pinSectionRef.current;
			const pinTrack = pinTrackRef.current;
			const pinHeading = pinHeadingRef.current;

			if (!pinSection || !pinTrack) return;

			if (isSmallScreen()) {
				pinSection.style.removeProperty("height");
				pinTrack.style.removeProperty("--pin-y");
				if (pinHeading) {
					pinHeading.style.removeProperty("--heading-y");
					pinHeading.style.removeProperty("--heading-opacity");
				}
				return;
			}

			const viewportHeight = window.innerHeight;
			const releaseDistance = Math.max(
				pinTrack.scrollHeight - viewportHeight * 0.48,
				0,
			);

			const rect = pinSection.getBoundingClientRect();
			const scrollable = pinSection.offsetHeight - viewportHeight;
			const progress = Math.min(Math.max(-rect.top / scrollable, 0), 1);
			const headingPhase = 0.18;
			const headingProgress = Math.min(progress / headingPhase, 1);
			const contentProgress = Math.min(
				Math.max((progress - headingPhase) / (1 - headingPhase), 0),
				1,
			);
			const y = -contentProgress * releaseDistance;

			if (pinHeading) {
				pinHeading.style.setProperty("--heading-y", `${-headingProgress * 150}px`);
				pinHeading.style.setProperty(
					"--heading-opacity",
					String(1 - headingProgress),
				);
			}

			pinTrack.style.setProperty("--pin-y", `${y}px`);
		}

		updatePinnedFeature();
		window.addEventListener("scroll", updatePinnedFeature, { passive: true });
		window.addEventListener("resize", updatePinnedFeature);
		return () => {
			window.removeEventListener("scroll", updatePinnedFeature);
			window.removeEventListener("resize", updatePinnedFeature);
		};
	}, []);

	useEffect(() => {
		let animationFrame = 0;

		function updateCardsStack() {
			animationFrame = 0;

			const section = cardsStackRef.current;
			const stage = section?.querySelector<HTMLElement>(".stack-stage");
			const cards = section
				? Array.from(section.querySelectorAll<HTMLElement>(".stack-card"))
				: [];

			if (!section || !stage || cards.length === 0) return;

			const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
			const smallScreen = isSmallScreen();
			const step = viewportHeight * (smallScreen ? 0.78 : 0.72);
			const hold = viewportHeight * (smallScreen ? 0.82 : 0.76);
			const travel = viewportHeight * (smallScreen ? 0.68 : 0.62);
			const totalProgress = step * (cards.length - 1) + hold;
			const sectionStyles = window.getComputedStyle(section);
			const stageOffset = Number.parseFloat(sectionStyles.paddingTop || "0");
			const sectionTop = window.scrollY + section.getBoundingClientRect().top;
			const progress = Math.min(
				Math.max(window.scrollY - sectionTop - stageOffset, 0),
				totalProgress,
			);

			section.style.height = `${stageOffset + viewportHeight + totalProgress}px`;

			cards.forEach((card, index) => {
				const enterProgress =
					index === 0
						? 1
						: Math.min(Math.max((progress - step * (index - 1)) / step, 0), 1);
				const easedProgress = 1 - (1 - enterProgress) ** 3;
				const y = index === 0 ? 0 : (1 - easedProgress) * travel;

				card.style.setProperty("--stack-y", `${y}px`);
				card.style.setProperty(
					"--stack-opacity",
					index === 0 || enterProgress > 0.02 ? "1" : "0",
				);
			});
		}

		function requestStackUpdate() {
			if (animationFrame) return;
			animationFrame = window.requestAnimationFrame(updateCardsStack);
		}

		requestStackUpdate();
		window.addEventListener("scroll", requestStackUpdate, { passive: true });
		window.addEventListener("resize", requestStackUpdate);
		window.visualViewport?.addEventListener("resize", requestStackUpdate);

		return () => {
			if (animationFrame) window.cancelAnimationFrame(animationFrame);
			window.removeEventListener("scroll", requestStackUpdate);
			window.removeEventListener("resize", requestStackUpdate);
			window.visualViewport?.removeEventListener("resize", requestStackUpdate);
		};
	}, []);

	if (authReady && isSignedIn) {
		return (
			<main className="full-page-loader">
				<LoadingScreen variant="plain" />
			</main>
		);
	}

	return (
		<>
			<LandingNavbar
				authReady={authReady}
				isSignedIn={isSignedIn}
				navHidden={navHidden}
			/>

			<main className="landing-main">
				<HeroTrustSection authReady={authReady} isSignedIn={isSignedIn} />
				<FeatureShowcase
					activeFeature={activeFeature}
					setActiveFeature={setActiveFeature}
				/>
				<StickyFeatureSection
					pinHeadingRef={pinHeadingRef}
					pinSectionRef={pinSectionRef}
					pinTrackRef={pinTrackRef}
				/>
				<QuoteSection />
				<BenefitsSection
					activeBenefit={activeBenefit}
					setActiveBenefit={setActiveBenefit}
				/>
				<CardsStackSection cardsStackRef={cardsStackRef} />
				<QuoteSection second />
				<CtaBanner isSignedIn={isSignedIn} />
			</main>

			<Footer />
		</>
	);
}
