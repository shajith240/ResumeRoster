import { Suspense } from "react";
import AuthGate from "@/components/AuthGate";
import LoadingScreen from "@/components/LoadingScreen";
import OnboardingFlow from "@/components/OnboardingFlow";

export default function OnboardingPage() {
	return (
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
	);
}
