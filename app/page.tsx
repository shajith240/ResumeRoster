"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import LoadingScreen from "@/components/LoadingScreen";
import { type BenefitKey } from "@/components/landing/content";
import {
	BenefitsSection,
	ComparisonSection,
	FaqSection,
	FeatureShowcase,
	Footer,
	HeroTrustSection,
	LandingNavbar,
	ProductLoopSection,
	ReviewStandardsSection,
} from "@/components/landing/sections";
import { getAppHomeRoute } from "@/lib/app-routes";
import { supabase } from "@/lib/supabase/client";

export default function Home() {
	const router = useRouter();
	const [activeBenefit, setActiveBenefit] = useState<BenefitKey>("students");
	const [navHidden, setNavHidden] = useState(false);
	const [user, setUser] = useState<User | null>(null);
	const [authReady, setAuthReady] = useState(false);
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
				<FeatureShowcase />
				<ReviewStandardsSection />
				<ProductLoopSection />
				<ComparisonSection />
				<FaqSection />
				<BenefitsSection
					activeBenefit={activeBenefit}
					setActiveBenefit={setActiveBenefit}
				/>
			</main>

			<Footer />
		</>
	);
}
