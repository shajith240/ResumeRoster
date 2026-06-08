"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useRef, type MouseEvent } from "react";
import {
	getPrimaryNavigationItems,
	type PrimaryNavigationItem,
} from "@/components/navigation/primary-nav";
import { type SidebarAnimatedIconHandle } from "@/components/navigation/sidebar-icons";
import { useAdminAccess } from "@/lib/use-admin-access";
import { cn } from "@/lib/utils";

function SidebarNavItem({ item }: { item: PrimaryNavigationItem }) {
	const iconRef = useRef<SidebarAnimatedIconHandle>(null);
	const Icon = item.sidebarIcon;

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
			className={cn("session-sidebar-link", item.active && "is-active")}
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
	const { isAdmin } = useAdminAccess();

	const items = useMemo(
		() =>
			getPrimaryNavigationItems({
				includeAdmin: true,
				isAdmin,
				pathname,
			}),
		[isAdmin, pathname],
	);

	return (
		<aside
			className="session-sidebar fixed left-0 top-[var(--app-header-height)] z-40 h-[calc(100vh_-_var(--app-header-height))] shrink-0 overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-tertiary)]"
		>
			<nav aria-label="Primary navigation" className="session-sidebar-nav">
				{items.map((item) => (
					<SidebarNavItem item={item} key={item.id} />
				))}
			</nav>
		</aside>
	);
}
