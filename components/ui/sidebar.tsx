"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
	Flame,
	Home,
	ListFilter,
	Plus,
	Trophy,
} from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const sidebarVariants = {
	open: { width: "15rem" },
	closed: { width: "3.05rem" },
};

const contentVariants = {
	open: { display: "block", opacity: 1 },
	closed: { display: "block", opacity: 1 },
};

const labelVariants = {
	open: {
		x: 0,
		opacity: 1,
		transition: {
			x: { stiffness: 1000, velocity: -100 },
		},
	},
	closed: {
		x: -14,
		opacity: 0,
		transition: {
			x: { stiffness: 100 },
		},
	},
};

const transitionProps = {
	type: "tween",
	ease: "easeOut",
	duration: 0.2,
	staggerChildren: 0.1,
} as const;

const staggerVariants = {
	open: {
		transition: { staggerChildren: 0.03, delayChildren: 0.02 },
	},
};

type NavItem = {
	href: string;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	active: boolean;
	tone?: "primary";
};

export function SessionNavBar() {
	const [isCollapsed, setIsCollapsed] = useState(true);
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
		<motion.aside
			aria-label="Primary navigation"
			className="session-sidebar fixed left-0 top-[52px] z-40 h-[calc(100vh-52px)] shrink-0 border-r border-border bg-background text-muted-foreground shadow-[8px_0_26px_rgba(23,20,15,0.04)]"
			initial={isCollapsed ? "closed" : "open"}
			animate={isCollapsed ? "closed" : "open"}
			variants={sidebarVariants}
			transition={transitionProps}
			onMouseEnter={() => setIsCollapsed(false)}
			onMouseLeave={() => setIsCollapsed(true)}
		>
			<motion.div
				className="relative z-40 flex h-full shrink-0 flex-col bg-background transition-all"
				variants={contentVariants}
			>
				<motion.div variants={staggerVariants} className="flex h-full flex-col">
					<ScrollArea className="min-h-0 flex-1 p-2 pt-3">
						<nav className="flex w-full flex-col gap-1">
							{items.map((item) => {
								const Icon = item.icon;

								return (
									<Link
										href={item.href}
										key={item.label}
										className={cn(
											"flex h-9 w-full flex-row items-center rounded-md px-2 py-1.5 text-sm transition hover:bg-muted hover:text-primary",
											item.active && "bg-muted text-primary",
											item.tone === "primary" &&
												"bg-orange-50 text-orange-700 hover:bg-orange-100 hover:text-orange-800",
										)}
									>
										<Icon className="h-4 w-4 shrink-0" />
										<motion.span
											variants={labelVariants}
											className="ml-2 flex min-w-0 flex-1 items-center gap-2"
										>
											{!isCollapsed && (
												<span className="truncate font-medium">
													{item.label}
												</span>
											)}
										</motion.span>
									</Link>
								);
							})}
						</nav>
					</ScrollArea>
				</motion.div>
			</motion.div>
		</motion.aside>
	);
}
