"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import AppPresence from "@/components/AppPresence";
import LoadingScreen from "@/components/LoadingScreen";
import { supabase } from "@/lib/supabase/client";
import { getCurrentPathForLogin, getLoginPath } from "@/lib/auth-redirect";
import { getFreshAuthSession } from "@/lib/auth-session";
import {
	claimActiveUserSession,
	endSupersededSession,
	verifyActiveUserSession,
} from "@/lib/session-lock";
import { SessionNavBar } from "@/components/navigation/SessionNavBar";
import type { ProfileOnboarding } from "@/lib/supabase/types";

type AuthGateProps = {
	children: React.ReactNode;
	showChrome?: boolean;
};

type AppTheme = "dark" | "light";

const APP_THEME_STORAGE_KEY = "linted-theme";
const APP_THEME_CHANGE_EVENT = "linted-theme-change";

function getStoredAppTheme(): AppTheme {
	if (typeof window === "undefined") return "dark";
	return window.localStorage.getItem(APP_THEME_STORAGE_KEY) === "light"
		? "light"
		: "dark";
}

function applyAppTheme(theme: AppTheme) {
	const isDark = theme === "dark";
	document.body.classList.toggle("main-app-dark", isDark);
	document.documentElement.classList.toggle("dark", isDark);
	document.documentElement.dataset.appTheme = theme;
}

function isOnboardingFeatureError(error: { message?: string } | null) {
	return /profile_onboarding|schema cache|relation|does not exist/i.test(
		error?.message ?? "",
	);
}

async function shouldRedirectToOnboarding(userId: string) {
	const { data, error } = await supabase
		.from("profile_onboarding")
		.select("status")
		.eq("user_id", userId)
		.maybeSingle();

	if (error) {
		if (isOnboardingFeatureError(error)) return false;
		return false;
	}

	if (!data) return false;

	return (data as Pick<ProfileOnboarding, "status">).status === "pending";
}

export default function AuthGate({ children, showChrome = true }: AuthGateProps) {
	const pathname = usePathname();
	const router = useRouter();
	const [user, setUser] = useState<User | null>(null);
	const [checking, setChecking] = useState(true);

	useEffect(() => {
		document.body.classList.add("main-app");
		applyAppTheme(getStoredAppTheme());

		function handleThemeChange(event: Event) {
			const theme = (event as CustomEvent<AppTheme>).detail;
			applyAppTheme(theme === "light" ? "light" : "dark");
		}

		window.addEventListener(APP_THEME_CHANGE_EVENT, handleThemeChange);

		return () => {
			window.removeEventListener(APP_THEME_CHANGE_EVENT, handleThemeChange);
			document.body.classList.remove("main-app");
			document.body.classList.remove("main-app-dark");
			document.documentElement.classList.remove("dark");
			delete document.documentElement.dataset.appTheme;
		};
	}, []);

	useEffect(() => {
		let active = true;

		async function finishAuthCheck(
			sessionUser: User | null | undefined,
			sessionMode: "claim" | "verify",
		) {
			if (!active) return;

			if (!sessionUser) {
				setUser(null);
				setChecking(false);
				router.replace(getLoginPath(getCurrentPathForLogin()));
				return;
			}

			const sessionStatus =
				sessionMode === "claim"
					? await claimActiveUserSession(sessionUser.id)
					: await verifyActiveUserSession(sessionUser.id);

			if (!active) return;

			if (sessionStatus.featureReady && !sessionStatus.active) {
				await endSupersededSession();
				return;
			}

			const onboardingRequired = await shouldRedirectToOnboarding(
				sessionUser.id,
			);

			if (!active) return;

			if (onboardingRequired && pathname !== "/onboarding") {
				router.replace(
					`/onboarding?next=${encodeURIComponent(getCurrentPathForLogin())}`,
				);
				return;
			}

			setUser(sessionUser);
			setChecking(false);
		}

		getFreshAuthSession().then(({ session }) => {
			void finishAuthCheck(session?.user, "claim");
		});

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((event, session) => {
			if (event === "SIGNED_OUT") {
				setUser(null);
				setChecking(false);
				router.replace(getLoginPath(getCurrentPathForLogin()));
				return;
			}

			const sessionMode =
				event === "SIGNED_IN" || event === "INITIAL_SESSION"
					? "claim"
					: "verify";
			void finishAuthCheck(session?.user, sessionMode);
		});

		return () => {
			active = false;
			subscription.unsubscribe();
		};
	}, [pathname, router]);

	useEffect(() => {
		if (!user) return;

		const userId = user.id;
		let active = true;

		async function verifyCurrentSession() {
			if (!active || document.visibilityState === "hidden") return;

			const { session } = await getFreshAuthSession();
			if (!active) return;

			if (!session?.user) {
				setUser(null);
				setChecking(false);
				router.replace(getLoginPath(getCurrentPathForLogin()));
				return;
			}

			const sessionStatus = await verifyActiveUserSession(userId);
			if (!active) return;

			if (sessionStatus.featureReady && !sessionStatus.active) {
				await endSupersededSession();
			}
		}

		const intervalId = window.setInterval(verifyCurrentSession, 12_000);

		function handleVisibilityChange() {
			if (document.visibilityState === "visible") {
				void verifyCurrentSession();
			}
		}

		window.addEventListener("focus", verifyCurrentSession);
		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			active = false;
			window.clearInterval(intervalId);
			window.removeEventListener("focus", verifyCurrentSession);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [user]);

	if (checking || !user) {
		return (
			<main className="full-page-loader">
				<LoadingScreen variant="plain" />
			</main>
		);
	}

	return (
		<>
			<AppPresence userId={user.id} />
			{showChrome ? (
				<>
					<SessionNavBar userId={user.id} />
					<div className="app-with-sidebar">{children}</div>
				</>
			) : (
				children
			)}
		</>
	);
}
