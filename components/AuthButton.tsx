"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
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
import { PROFILE_CHANGE_EVENT, normalizeAppStatus } from "@/lib/app-presence";
import { getAppHomeRoute } from "@/lib/app-routes";
import { getLoginPath } from "@/lib/auth-redirect";
import { PWA_INSTALL_OPEN_EVENT } from "@/lib/pwa-install";
import { signOut, supabase } from "@/lib/supabase/client";
import type { AppStatus } from "@/lib/supabase/types";
import { useAdminAccess } from "@/lib/use-admin-access";

type AppTheme = "dark" | "light";

type NavProfile = {
	full_name: string | null;
	username: string | null;
	avatar_url: string | null;
	app_status?: AppStatus | null;
};

type ProfileChangeDetail = Partial<NavProfile> & {
	id?: string | null;
};

const APP_THEME_STORAGE_KEY = "linted-theme";
const APP_THEME_CHANGE_EVENT = "linted-theme-change";
const NAV_PROFILE_SELECT_WITH_STATUS =
	"full_name, username, avatar_url, app_status";
const NAV_PROFILE_SELECT_BASE = "full_name, username, avatar_url";
const SUPABASE_MIGRATION_MESSAGE =
	"Status controls are temporarily unavailable. Please refresh and try again.";

async function getNavProfile(activeUser: User | null): Promise<NavProfile | null> {
	if (!activeUser) return null;

	const primaryResult = await supabase
		.from("profiles")
		.select(NAV_PROFILE_SELECT_WITH_STATUS)
		.eq("id", activeUser.id)
		.maybeSingle();

	if (
		primaryResult.error &&
		/app_status|schema cache|column/i.test(primaryResult.error.message)
	) {
		const fallbackResult = await supabase
			.from("profiles")
			.select(NAV_PROFILE_SELECT_BASE)
			.eq("id", activeUser.id)
			.maybeSingle();

		if (fallbackResult.error) return null;
		return (fallbackResult.data ?? null) as NavProfile | null;
	}

	if (primaryResult.error) return null;

	return (primaryResult.data ?? null) as NavProfile | null;
}

export default function AuthButton() {
	const router = useRouter();
	const { isAdmin } = useAdminAccess();
	const [user, setUser] = useState<User | null>(null);
	const [profile, setProfile] = useState<NavProfile | null>(null);
	const [status, setStatus] = useState<AppStatus>("online");
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
			setStatus(normalizeAppStatus(nextProfile?.app_status));
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
				app_status: Object.prototype.hasOwnProperty.call(detail, "app_status")
					? normalizeAppStatus(detail.app_status)
					: current?.app_status ?? null,
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
			help: appHomeRoute,
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

	async function handleStatusChange(nextStatus: string) {
		const normalizedStatus = normalizeAppStatus(nextStatus);
		const previousStatus = status;
		setStatus(normalizedStatus);

		if (!user) return;

		const { error } = await supabase
			.from("profiles")
			.update({ app_status: normalizedStatus })
			.eq("id", user.id);

		if (!error) {
			setProfile((current) =>
				current ? { ...current, app_status: normalizedStatus } : current,
			);
			window.dispatchEvent(
				new CustomEvent(PROFILE_CHANGE_EVENT, {
					detail: { id: user.id, app_status: normalizedStatus },
				}),
			);
			return;
		}

		setStatus(previousStatus);

		if (/app_status|schema cache|column/i.test(error.message)) {
			toast.error(SUPABASE_MIGRATION_MESSAGE);
			return;
		}

		toast.error("Could not update your status.", {
			description: error.message,
		});
	}

	return (
		<div className="profile-menu">
			<NotificationCenter userId={user.id} />
			<PwaInstallPrompt />
			<FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
			<UserDropdown
				isAdmin={isAdmin}
				selectedStatus={status}
				user={{
					name: displayName,
					username,
					avatar: avatarUrl,
					initials: initials || "LI",
					status,
				}}
				onAction={(action) => void handleAction(action)}
				onStatusChange={(nextStatus) => void handleStatusChange(nextStatus)}
				onThemeChange={handleThemeChange}
				selectedTheme={theme}
			/>
		</div>
	);
}
