import { Suspense } from "react";
import LoadingScreen from "@/components/LoadingScreen";
import SignUp from "@/components/auth/SignUp";

export default function LoginPage() {
	return (
		<Suspense
			fallback={
				<main className="full-page-loader">
					<LoadingScreen variant="plain" />
				</main>
			}
		>
			<SignUp />
		</Suspense>
	);
}
