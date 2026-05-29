"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import NotificationCenter from "@/components/NotificationCenter";
import { announceRouteTransition } from "@/components/RouteTransitionLoader";
import { UserDropdown } from "@/components/ui/user-dropdown";
import { PROFILE_CHANGE_EVENT, normalizeAppStatus } from "@/lib/app-presence";
import { getLoginPath } from "@/lib/auth-redirect";
import { NOTIFICATIONS_OPEN_EVENT } from "@/lib/notifications";
import { signOut, supabase } from "@/lib/supabase/client";
import type { AppStatus } from "@/lib/supabase/types";

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
	"Run the pending Supabase migrations to enable saved status.";

function getMetadataName(user: User | null) {
	return user?.user_metadata?.full_name
		? String(user.user_metadata.full_name)
		: "";
}

function getMetadataAvatar(user: User | null) {
	return (
		(user?.user_metadata?.avatar_url as string | undefined) ||
		(user?.user_metadata?.picture as string | undefined) ||
		""
	);
}

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
	const [user, setUser] = useState<User | null>(null);
	const [profile, setProfile] = useState<NavProfile | null>(null);
	const [status, setStatus] = useState<AppStatus>("online");
	const [theme, setTheme] = useState<AppTheme>("dark");
	const [loading, setLoading] = useState(true);

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
					href={getLoginPath("/feed")}
				>
					Log in
				</Link>
				<Link className="btn-primary btn-brand" href="/submit">
					Post resume
				</Link>
			</div>
		);
	}

	const displayName = String(
		profile?.full_name ||
			getMetadataName(user) ||
			profile?.username ||
			user.email?.split("@")[0] ||
			"Resume reviewer",
	);
	const avatarUrl = profile?.avatar_url || getMetadataAvatar(user) || undefined;
	const username = profile?.username
		? `@${profile.username.replace(/^@+/, "")}`
		: user.email
			? `@${user.email.split("@")[0]}`
			: "@linted";
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

		if (action === "notifications") {
			window.dispatchEvent(new CustomEvent(NOTIFICATIONS_OPEN_EVENT));
			return;
		}

		const routes: Record<string, string> = {
			profile: "/profile/me",
			submit: "/submit",
			saved: "/feed?saved=1",
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
			<UserDropdown
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
