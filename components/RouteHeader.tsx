"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
	Bookmark,
	Home,
	ShieldCheck,
	Plus,
	Trophy,
	UserRound,
	type LucideIcon,
} from "lucide-react";
import AuthButton from "./AuthButton";
import { useAdminAccess } from "@/lib/use-admin-access";

type DockLink = {
	href: string;
	label: string;
	icon: LucideIcon;
	match: (context: {
		pathname: string;
		saved: string | null;
	}) => boolean;
	tone?: "primary";
};

const dockLinks: DockLink[] = [
	{
		href: "/feed",
		label: "Feed",
		icon: Home,
		match: ({ pathname, saved }) => pathname === "/feed" && !saved,
	},
	{
		href: "/feed?saved=1",
		label: "Saved",
		icon: Bookmark,
		match: ({ pathname, saved }) =>
			pathname === "/feed" && (saved === "1" || saved === "true"),
	},
	{
		href: "/submit",
		label: "Post",
		icon: Plus,
		match: ({ pathname }) => pathname === "/submit",
		tone: "primary",
	},
	{
		href: "/leaderboard",
		label: "Leaders",
		icon: Trophy,
		match: ({ pathname }) => pathname === "/leaderboard",
	},
	{
		href: "/profile/me",
		label: "Profile",
		icon: UserRound,
		match: ({ pathname }) => pathname.startsWith("/profile"),
	},
];

export default function RouteHeader() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const saved = searchParams.get("saved");
	const { isAdmin } = useAdminAccess();
	const visibleDockLinks = isAdmin
		? [
				...dockLinks,
				{
					href: "/admin",
					label: "Admin",
					icon: ShieldCheck,
					match: ({ pathname }: { pathname: string; saved: string | null }) =>
						pathname.startsWith("/admin"),
				},
			]
		: dockLinks;

	return (
		<>
			<header className="app-header">
				<Link href="/feed" className="app-logo" aria-label="Linted home">
					Linted
				</Link>

				<AuthButton />
			</header>

			<nav
				className="bottom-nav"
				aria-label="Mobile navigation"
				style={{
					gridTemplateColumns: `repeat(${visibleDockLinks.length}, minmax(0, 1fr))`,
				}}
			>
				{visibleDockLinks.map((link) => {
					const Icon = link.icon;
					const isRouteMatch = link.match({ pathname, saved });

					return (
						<Link
							aria-current={isRouteMatch ? "page" : undefined}
							className={[
								"dock-link",
								link.tone === "primary" ? "dock-link-primary" : "",
								isRouteMatch ? "active" : "",
							]
								.filter(Boolean)
								.join(" ")}
							href={link.href}
							key={link.label}
						>
							<span className="dock-icon-wrap">
								<Icon aria-hidden="true" size={20} strokeWidth={2.1} />
							</span>
							<span className="dock-label">{link.label}</span>
						</Link>
					);
				})}
			</nav>
		</>
	);
}
