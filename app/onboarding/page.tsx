import { Suspense } from "react";
import AuthGate from "@/components/AuthGate";
import LoadingScreen from "@/components/LoadingScreen";
import OnboardingFlow from "@/components/OnboardingFlow";

const ONBOARDING_CHARACTER_IMAGES = [
	"/assets/step1-arjun-welcoming.png",
	"/assets/step2-hopeful-priya.png",
	"/assets/image2-arjun-confident.png",
	"/assets/step4.png",
	"/assets/image%204%20-priya-Empathetic.png",
	"/assets/rohan-image2.png",
];

export default function OnboardingPage() {
	return (
		<>
			{ONBOARDING_CHARACTER_IMAGES.map((src) => (
				<link key={src} rel="preload" as="image" href={src} />
			))}
			<AuthGate showChrome={false}>
				<Suspense
					fallback={
						<main className="full-page-loader">
							<LoadingScreen variant="plain" />
						</main>
					}
				>
					<OnboardingFlow />
				</Suspense>
			</AuthGate>
		</>
	);
}
