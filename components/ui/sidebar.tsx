"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useRef, type MouseEvent } from "react";
import {
	FlameIcon,
	HomeIcon,
	ListFilterIcon,
	PlusIcon,
	TrophyIcon,
	type SidebarAnimatedIconComponent,
	type SidebarAnimatedIconHandle,
} from "@/components/ui/sidebar-icons";

import { cn } from "@/lib/utils";

type NavItem = {
	href: string;
	label: string;
	icon: SidebarAnimatedIconComponent;
	active: boolean;
	tone?: "primary";
};

function SidebarNavItem({ item }: { item: NavItem }) {
	const iconRef = useRef<SidebarAnimatedIconHandle>(null);
	const Icon = item.icon;
	const isPrimaryInactive = item.tone === "primary" && !item.active;

	function startIconAnimation() {
		iconRef.current?.startAnimation();
	}

	function stopIconAnimation() {
		iconRef.current?.stopAnimation();
	}

	function releasePointerFocus(event: MouseEvent<HTMLAnchorElement>) {
		if (event.detail > 0) {
			event.currentTarget.blur();
		}
	}

	return (
		<Link
			href={item.href}
			key={item.label}
			aria-label={item.label}
			onBlur={stopIconAnimation}
			onClick={releasePointerFocus}
			onFocus={startIconAnimation}
			onMouseEnter={startIconAnimation}
			onMouseLeave={stopIconAnimation}
			className={cn(
				"session-sidebar-link",
				item.active && "is-active",
				isPrimaryInactive && "is-primary",
			)}
		>
			<span className="session-sidebar-icon-slot">
				<Icon
					ref={iconRef}
					className="session-sidebar-icon"
					size={21}
					aria-hidden="true"
				/>
			</span>
			<span className="session-sidebar-label">{item.label}</span>
		</Link>
	);
}

export function SessionNavBar() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const sort = searchParams.get("sort");

	const items = useMemo<NavItem[]>(
		() => [
			{
				href: "/feed",
				label: "Home",
				icon: HomeIcon,
				active: pathname === "/feed" && !sort,
			},
			{
				href: "/feed?sort=new",
				label: "New",
				icon: ListFilterIcon,
				active: pathname === "/feed" && sort === "new",
			},
			{
				href: "/feed?sort=top",
				label: "Top rated",
				icon: FlameIcon,
				active: pathname === "/feed" && sort === "top",
			},
			{
				href: "/submit",
				label: "Post resume",
				icon: PlusIcon,
				active: pathname === "/submit",
				tone: "primary",
			},
			{
				href: "/leaderboard",
				label: "Leaderboard",
				icon: TrophyIcon,
				active: pathname === "/leaderboard",
			},
		],
		[pathname, sort],
	);

	return (
		<aside
			aria-label="Primary navigation"
			className="session-sidebar fixed left-0 top-[var(--app-header-height)] z-40 h-[calc(100vh_-_var(--app-header-height))] shrink-0 overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-tertiary)]"
		>
			<nav className="session-sidebar-nav">
				{items.map((item) => (
					<SidebarNavItem item={item} key={item.label} />
				))}
			</nav>
		</aside>
	);
}
