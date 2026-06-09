"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
	getPrimaryNavigationItems,
	type PrimaryNavigationItem,
} from "@/components/navigation/primary-nav";
import { type SidebarAnimatedIconHandle } from "@/components/navigation/sidebar-icons";
import { useAdminAccess } from "@/lib/use-admin-access";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "linted.session-sidebar.collapsed";

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
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [hasLoadedSidebarPreference, setHasLoadedSidebarPreference] =
		useState(false);

	const items = useMemo(
		() =>
			getPrimaryNavigationItems({
				includeAdmin: true,
				isAdmin,
				pathname,
			}),
		[isAdmin, pathname],
	);

	useEffect(() => {
		setIsCollapsed(
			window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "1",
		);
		setHasLoadedSidebarPreference(true);
	}, []);

	useEffect(() => {
		if (!hasLoadedSidebarPreference) return;

		document.body.classList.toggle("session-sidebar-collapsed", isCollapsed);
		window.localStorage.setItem(
			SIDEBAR_COLLAPSED_STORAGE_KEY,
			isCollapsed ? "1" : "0",
		);

		return () => {
			document.body.classList.remove("session-sidebar-collapsed");
		};
	}, [hasLoadedSidebarPreference, isCollapsed]);

	return (
		<aside
			className={cn(
				"session-sidebar fixed left-0 top-[var(--app-header-height)] z-40 h-[calc(100vh_-_var(--app-header-height))] shrink-0 overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-tertiary)]",
				isCollapsed && "is-collapsed",
			)}
		>
			<button
				aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
				aria-pressed={isCollapsed}
				className="session-sidebar-toggle"
				onClick={() => setIsCollapsed((current) => !current)}
				type="button"
			>
				<Menu aria-hidden="true" />
			</button>
			<nav aria-label="Primary navigation" className="session-sidebar-nav">
				{items.map((item) => (
					<SidebarNavItem item={item} key={item.id} />
				))}
			</nav>
		</aside>
	);
}
