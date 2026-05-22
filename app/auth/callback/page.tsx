"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LoadingScreen from "@/components/LoadingScreen";
import { AUTH_NEXT_STORAGE_KEY, getSafeNextPath } from "@/lib/auth-redirect";
import { supabase } from "@/lib/supabase/client";

function AuthCallbackContent() {
	const router = useRouter();
	const searchParams = useSearchParams();

	useEffect(() => {
		async function finishSignIn() {
			const storedNextPath = window.localStorage.getItem(
				AUTH_NEXT_STORAGE_KEY,
			);
			window.localStorage.removeItem(AUTH_NEXT_STORAGE_KEY);

			const safeNextPath = getSafeNextPath(
				searchParams.get("next") || storedNextPath,
			);

			const code = searchParams.get("code");
			const errorDescription =
				searchParams.get("error_description") || searchParams.get("error");

			if (errorDescription) {
				router.replace(
					`/login?auth_error=${encodeURIComponent(errorDescription)}`,
				);
				return;
			}

			if (code) {
				const { error } = await supabase.auth.exchangeCodeForSession(code);

				if (error) {
					router.replace(`/login?auth_error=${encodeURIComponent(error.message)}`);
					return;
				}
			}

			const { data } = await supabase.auth.getSession();

			if (!data.session) {
				router.replace("/login?auth_error=no_session");
				return;
			}

			router.replace(safeNextPath);
		}

		void finishSignIn();
	}, [router, searchParams]);

	return (
		<main className="full-page-loader">
			<LoadingScreen variant="plain" />
		</main>
	);
}

export default function AuthCallbackPage() {
	return (
		<Suspense
			fallback={
				<main className="full-page-loader">
					<LoadingScreen variant="plain" />
				</main>
			}
		>
			<AuthCallbackContent />
		</Suspense>
	);
}
