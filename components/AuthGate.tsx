"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import AppPresence from "@/components/AppPresence";
import LoadingScreen from "@/components/LoadingScreen";
import { supabase } from "@/lib/supabase/client";
import { getCurrentPathForLogin, getLoginPath } from "@/lib/auth-redirect";
import { SessionNavBar } from "@/components/ui/sidebar";

type AuthGateProps = {
	children: React.ReactNode;
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

export default function AuthGate({ children }: AuthGateProps) {
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

		supabase.auth.getSession().then(({ data }) => {
			if (!active) return;

			if (!data.session?.user) {
				router.replace(getLoginPath(getCurrentPathForLogin()));
				return;
			}

			setUser(data.session.user);
			setChecking(false);
		});

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			if (!session?.user) {
				router.replace(getLoginPath(getCurrentPathForLogin()));
				return;
			}

			setUser(session.user);
			setChecking(false);
		});

		return () => {
			active = false;
			subscription.unsubscribe();
		};
	}, [router]);

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
			<SessionNavBar />
			<div className="app-with-sidebar">{children}</div>
		</>
	);
}
