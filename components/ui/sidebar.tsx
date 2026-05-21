"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import type { ComponentType } from "react";
import {
	Flame,
	Home,
	ListFilter,
	Plus,
	Trophy,
} from "lucide-react";

import { cn } from "@/lib/utils";

type NavItem = {
	href: string;
	label: string;
	icon: ComponentType<{ className?: string }>;
	active: boolean;
	tone?: "primary";
};

export function SessionNavBar() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const sort = searchParams.get("sort");

	const items = useMemo<NavItem[]>(
		() => [
			{
				href: "/feed",
				label: "Home",
				icon: Home,
				active: pathname === "/feed" && !sort,
			},
			{
				href: "/feed?sort=new",
				label: "New",
				icon: ListFilter,
				active: pathname === "/feed" && sort === "new",
			},
			{
				href: "/feed?sort=top",
				label: "Top rated",
				icon: Flame,
				active: pathname === "/feed" && sort === "top",
			},
			{
				href: "/submit",
				label: "Post resume",
				icon: Plus,
				active: pathname === "/submit",
				tone: "primary",
			},
			{
				href: "/leaderboard",
				label: "Leaderboard",
				icon: Trophy,
				active: pathname === "/leaderboard",
			},
		],
		[pathname, sort],
	);

	return (
		<aside
			aria-label="Primary navigation"
			className="session-sidebar group/sidebar fixed left-0 top-[var(--app-header-height)] z-40 h-[calc(100vh_-_var(--app-header-height))] w-[var(--session-sidebar-width)] shrink-0 overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-tertiary)] shadow-[12px_0_36px_rgba(0,0,0,0.08)] transition-[width,box-shadow] duration-200 ease-out hover:w-[var(--session-sidebar-expanded-width)] hover:shadow-[18px_0_48px_rgba(0,0,0,0.18)]"
		>
			<nav className="flex h-full w-full flex-col gap-2 p-2 pt-3">
				{items.map((item) => {
					const Icon = item.icon;
					const isPrimaryInactive = item.tone === "primary" && !item.active;

					return (
						<Link
							href={item.href}
							key={item.label}
							aria-label={item.label}
							className={cn(
								"flex min-h-[58px] w-full items-center justify-center overflow-hidden rounded-xl border border-transparent px-0 py-2 text-[13px] font-semibold leading-none transition-[background-color,border-color,color,padding] duration-150 hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] group-hover/sidebar:justify-start group-hover/sidebar:px-3",
								item.active &&
									"border-[rgba(255,138,77,0.28)] bg-[var(--brand-muted)] text-[var(--brand)]",
								isPrimaryInactive &&
									"text-[var(--brand)] hover:border-[rgba(255,138,77,0.22)] hover:bg-[var(--brand-muted)] hover:text-[var(--brand)]",
							)}
						>
							<span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg">
								<Icon className="h-[18px] w-[18px]" aria-hidden="true" />
							</span>
							<span className="ml-0 max-w-0 -translate-x-1 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity,transform,margin] duration-150 group-hover/sidebar:ml-1 group-hover/sidebar:max-w-[11rem] group-hover/sidebar:translate-x-0 group-hover/sidebar:opacity-100">
								{item.label}
							</span>
						</Link>
					);
				})}
			</nav>
		</aside>
	);
}
