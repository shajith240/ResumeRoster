"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { announceRouteTransition } from "@/components/RouteTransitionLoader";
import { UserDropdown } from "@/components/ui/user-dropdown";
import { signInWithGoogle, signOut, supabase } from "@/lib/supabase/client";

type AppTheme = "dark" | "light";

type NavProfile = {
	full_name: string | null;
	username: string | null;
	avatar_url: string | null;
};

type ProfileChangeDetail = Partial<NavProfile> & {
	id?: string | null;
};

const APP_THEME_STORAGE_KEY = "resumeroster-theme";
const APP_THEME_CHANGE_EVENT = "resumeroster-theme-change";
const PROFILE_CHANGE_EVENT = "resumeroster-profile-change";

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

	const { data, error } = await supabase
		.from("profiles")
		.select("full_name, username, avatar_url")
		.eq("id", activeUser.id)
		.maybeSingle();

	if (error) return null;

	return (data ?? null) as NavProfile | null;
}

export default function AuthButton() {
	const router = useRouter();
	const [user, setUser] = useState<User | null>(null);
	const [profile, setProfile] = useState<NavProfile | null>(null);
	const [status, setStatus] = useState("online");
	const [theme, setTheme] = useState<AppTheme>("dark");
	const [loading, setLoading] = useState(true);

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
		profile?.full_name ||
			getMetadataName(user) ||
			profile?.username ||
			user.email?.split("@")[0] ||
			"Resume roaster",
	);
	const avatarUrl = profile?.avatar_url || getMetadataAvatar(user) || undefined;
	const username = profile?.username
		? `@${profile.username.replace(/^@+/, "")}`
		: user.email
			? `@${user.email.split("@")[0]}`
			: "@resumeroster";
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
					username,
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
