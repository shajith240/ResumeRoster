"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { announceRouteTransition } from "@/components/RouteTransitionLoader";
import { UserDropdown } from "@/components/ui/user-dropdown";
import { signInWithGoogle, signOut, supabase } from "@/lib/supabase/client";

type AppTheme = "dark" | "light";

const APP_THEME_STORAGE_KEY = "resumeroster-theme";
const APP_THEME_CHANGE_EVENT = "resumeroster-theme-change";

export default function AuthButton() {
	const router = useRouter();
	const [user, setUser] = useState<User | null>(null);
	const [status, setStatus] = useState("online");
	const [theme, setTheme] = useState<AppTheme>("dark");
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let active = true;

		supabase.auth.getUser().then(({ data }) => {
			if (!active) return;
			setUser(data.user);
			setLoading(false);
		});

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			setUser(session?.user ?? null);
			setLoading(false);
		});

		return () => {
			active = false;
			subscription.unsubscribe();
		};
	}, []);

	useEffect(() => {
		const storedTheme = window.localStorage.getItem(APP_THEME_STORAGE_KEY);
		setTheme(storedTheme === "light" ? "light" : "dark");
	}, []);

	if (loading) {
		return <div className="avatar-skeleton" aria-label="Checking session" />;
	}

	if (!user) {
		return (
			<div className="auth-actions">
				<button
					className="btn-primary btn-ghost nav-login"
					onClick={() => void signInWithGoogle()}
				>
					Log in
				</button>
				<Link className="btn-primary btn-brand" href="/submit">
					Post resume
				</Link>
			</div>
		);
	}

	const displayName = String(
		user.user_metadata?.full_name ||
			user.email?.split("@")[0] ||
			"Resume roaster",
	);
	const avatarUrl = user.user_metadata?.avatar_url as string | undefined;
	const initials = displayName
		.split(/\s+/)
		.map((part: string) => part[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();

	async function handleAction(action: string) {
		if (action === "logout") {
			await signOut();
			router.replace("/");
			return;
		}

		const routes: Record<string, string> = {
			profile: "/profile/me",
			submit: "/submit",
			saved: "/feed",
			help: "/feed",
			feedback: "/feed",
		};

		const nextRoute = routes[action] || "/feed";
		announceRouteTransition(nextRoute);
		router.push(nextRoute);
	}

	function handleThemeChange(nextTheme: AppTheme) {
		setTheme(nextTheme);
		window.localStorage.setItem(APP_THEME_STORAGE_KEY, nextTheme);
		window.dispatchEvent(
			new CustomEvent(APP_THEME_CHANGE_EVENT, { detail: nextTheme }),
		);
	}

	return (
		<div className="profile-menu">
			<UserDropdown
				selectedStatus={status}
				user={{
					name: displayName,
					username: user.email
						? `@${user.email.split("@")[0]}`
						: "@resumeroster",
					avatar: avatarUrl,
					initials: initials || "RR",
					status: status as "online" | "focus" | "offline" | "busy",
				}}
				onAction={(action) => void handleAction(action)}
				onStatusChange={setStatus}
				onThemeChange={handleThemeChange}
				selectedTheme={theme}
			/>
		</div>
	);
}
