"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import NotificationCenter from "@/components/NotificationCenter";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import { announceRouteTransition } from "@/components/RouteTransitionLoader";
import { FeedbackDialog } from "@/components/account/FeedbackDialog";
import { UserDropdown } from "@/components/account/UserDropdown";
import {
	getAnonymousProfileDisplayName,
	getAnonymousProfileUsername,
	isGeneratedAnonymousUsername,
} from "@/lib/anonymous-profile";
import { PROFILE_CHANGE_EVENT } from "@/lib/app-presence";
import { getAppHomeRoute } from "@/lib/app-routes";
import { getLoginPath } from "@/lib/auth-redirect";
import { PWA_INSTALL_OPEN_EVENT } from "@/lib/pwa-install";
import { signOut, supabase } from "@/lib/supabase/client";
import { useAdminAccess } from "@/lib/use-admin-access";

type AppTheme = "dark" | "light";

type NavProfile = {
	full_name: string | null;
	username: string | null;
	avatar_url: string | null;
};

type ProfileChangeDetail = Partial<NavProfile> & {
	id?: string | null;
};

const APP_THEME_STORAGE_KEY = "linted-theme";
const APP_THEME_CHANGE_EVENT = "linted-theme-change";
const NAV_PROFILE_SELECT = "full_name, username, avatar_url";

async function getNavProfile(activeUser: User | null): Promise<NavProfile | null> {
	if (!activeUser) return null;

	const result = await supabase
		.from("profiles")
		.select(NAV_PROFILE_SELECT)
		.eq("id", activeUser.id)
		.maybeSingle();

	if (result.error) return null;

	return (result.data ?? null) as NavProfile | null;
}

export default function AuthButton() {
	const router = useRouter();
	const { isAdmin } = useAdminAccess();
	const [user, setUser] = useState<User | null>(null);
	const [profile, setProfile] = useState<NavProfile | null>(null);
	const [theme, setTheme] = useState<AppTheme>("dark");
	const [feedbackOpen, setFeedbackOpen] = useState(false);
	const [loading, setLoading] = useState(true);
	const appHomeRoute = getAppHomeRoute();

	useEffect(() => {
		let active = true;

		async function syncUser(nextUser: User | null) {
			const nextProfile = await getNavProfile(nextUser);
			if (!active) return;
			setUser(nextUser);
			setProfile(nextProfile);
			setLoading(false);
		}

		supabase.auth.getUser().then(({ data }) => {
			void syncUser(data.user);
		});

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			void syncUser(session?.user ?? null);
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

	useEffect(() => {
		function handleProfileChange(event: Event) {
			const detail = (event as CustomEvent<ProfileChangeDetail>).detail;
			if (!detail) return;
			if (detail.id && user?.id && detail.id !== user.id) return;

			setProfile((current) => ({
				full_name: Object.prototype.hasOwnProperty.call(detail, "full_name")
					? detail.full_name ?? null
					: current?.full_name ?? null,
				username: Object.prototype.hasOwnProperty.call(detail, "username")
					? detail.username ?? null
					: current?.username ?? null,
				avatar_url: Object.prototype.hasOwnProperty.call(detail, "avatar_url")
					? detail.avatar_url ?? null
					: current?.avatar_url ?? null,
			}));
		}

		window.addEventListener(PROFILE_CHANGE_EVENT, handleProfileChange);

		return () => {
			window.removeEventListener(PROFILE_CHANGE_EVENT, handleProfileChange);
		};
	}, [user?.id]);

	if (loading) {
		return <div className="avatar-skeleton" aria-label="Checking session" />;
	}

	if (!user) {
		return (
			<div className="auth-actions">
				<Link
					className="btn-primary btn-ghost nav-login"
					href={getLoginPath(appHomeRoute)}
				>
					Log in
				</Link>
				<Link className="btn-primary btn-brand" href="/submit">
					Post resume
				</Link>
			</div>
		);
	}

	const anonymousUsername = getAnonymousProfileUsername(user.id);
	const anonymousDisplayName = getAnonymousProfileDisplayName(user.id);
	const profileUsername = profile?.username?.trim() ?? "";
	const hasGeneratedUsername = isGeneratedAnonymousUsername(
		profileUsername,
		user.id,
	);
	const displayName = String(
		profile?.full_name ||
			(hasGeneratedUsername ? anonymousDisplayName : profileUsername) ||
			anonymousDisplayName,
	);
	const avatarUrl = profile?.avatar_url || undefined;
	const username =
		profileUsername && !hasGeneratedUsername
			? `@${profileUsername.replace(/^@+/, "")}`
			: `@${anonymousUsername}`;
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

		if (action === "install") {
			window.dispatchEvent(new CustomEvent(PWA_INSTALL_OPEN_EVENT));
			return;
		}

		if (action === "feedback") {
			setFeedbackOpen(true);
			return;
		}

		const routes: Record<string, string> = {
			admin: "/admin",
			profile: "/profile/me",
			submit: "/submit",
			saved: "/feed?saved=1",
			help: "/help",
		};

		const nextRoute = routes[action] || appHomeRoute;
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
			<NotificationCenter userId={user.id} />
			<PwaInstallPrompt />
			<FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
			<UserDropdown
				isAdmin={isAdmin}
				isOnline={true}
				user={{
					name: displayName,
					username,
					avatar: avatarUrl,
					initials: initials || "LI",
				}}
				onAction={(action) => void handleAction(action)}
				onThemeChange={handleThemeChange}
				selectedTheme={theme}
			/>
		</div>
	);
}
