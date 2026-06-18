"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import LoadingScreen from "@/components/LoadingScreen";

const MIN_VISIBLE_MS = 700;
const ROUTE_READY_SETTLE_MS = 120;
const STALLED_TRANSITION_MS = 2200;
const ROUTE_TRANSITION_EVENT = "linted-route-transition";
const APP_THEME_STORAGE_KEY = "linted-theme";
const APP_ROUTE_PREFIXES = [
	"/community",
	"/feed",
	"/submit",
	"/leaderboard",
	"/profile",
	"/resume",
];

type LoaderTheme = "dark" | "light";

function isAppRoute(pathname: string) {
	return APP_ROUTE_PREFIXES.some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
	);
}

function isModifiedClick(event: MouseEvent) {
	return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function getAnchorFromEvent(event: MouseEvent) {
	if (!(event.target instanceof Element)) return null;
	return event.target.closest<HTMLAnchorElement>("a[href]");
}

function getInternalNavigationUrl(anchor: HTMLAnchorElement) {
	if (anchor.hasAttribute("download")) return null;
	if (anchor.target && anchor.target !== "_self") return null;

	const rawHref = anchor.getAttribute("href");
	if (!rawHref || rawHref.startsWith("#")) return null;

	const url = new URL(anchor.href, window.location.href);
	if (url.origin !== window.location.origin) return null;

	const currentPath = window.location.pathname;

	if (url.pathname === currentPath) return null;
	if (!isAppRoute(url.pathname) && !isAppRoute(currentPath)) return null;

	return url;
}

function getLoaderTheme(nextPathname: string): LoaderTheme {
	const storedTheme = window.localStorage.getItem(APP_THEME_STORAGE_KEY);
	const htmlTheme = document.documentElement.dataset.appTheme;

	if (storedTheme === "light" || storedTheme === "dark") {
		return storedTheme;
	}

	if (htmlTheme === "light" || htmlTheme === "dark") {
		return htmlTheme;
	}

	if (document.body.classList.contains("main-app")) {
		return document.body.classList.contains("main-app-dark") ? "dark" : "light";
	}

	return isAppRoute(nextPathname) ? "dark" : "light";
}

export function announceRouteTransition(href: string) {
	if (typeof window === "undefined") return;

	window.dispatchEvent(
		new CustomEvent(ROUTE_TRANSITION_EVENT, {
			detail: { href },
		}),
	);
}

export default function RouteTransitionLoader() {
	const pathname = usePathname();
	const [visible, setVisible] = useState(false);
	const [loaderTheme, setLoaderTheme] = useState<LoaderTheme>("dark");
	const startTimeRef = useRef(0);
	const originPathRef = useRef("");
	const hideTimerRef = useRef<number | null>(null);

	useEffect(() => {
		originPathRef.current = window.location.pathname;
	}, []);

	useEffect(() => {
		return () => {
			if (hideTimerRef.current) {
				window.clearTimeout(hideTimerRef.current);
			}
		};
	}, []);

	function clearHideTimer() {
		if (!hideTimerRef.current) return;
		window.clearTimeout(hideTimerRef.current);
		hideTimerRef.current = null;
	}

	function hideAfterRouteReady() {
		const elapsed = performance.now() - startTimeRef.current;
		const remaining = Math.max(ROUTE_READY_SETTLE_MS, MIN_VISIBLE_MS - elapsed);

		clearHideTimer();
		hideTimerRef.current = window.setTimeout(() => {
			setVisible(false);
			hideTimerRef.current = null;
			originPathRef.current = window.location.pathname;
		}, remaining);
	}

	function startTransition(nextPathname: string) {
		if (nextPathname === window.location.pathname) return;
		if (!isAppRoute(nextPathname) && !isAppRoute(window.location.pathname)) return;

		clearHideTimer();
		startTimeRef.current = performance.now();
		originPathRef.current = window.location.pathname;
		setLoaderTheme(getLoaderTheme(nextPathname));
		setVisible(true);
		hideTimerRef.current = window.setTimeout(() => {
			setVisible(false);
			hideTimerRef.current = null;
			originPathRef.current = window.location.pathname;
		}, STALLED_TRANSITION_MS);
	}

	useEffect(() => {
		function handleClick(event: MouseEvent) {
			if (event.defaultPrevented || event.button !== 0 || isModifiedClick(event)) {
				return;
			}

			const anchor = getAnchorFromEvent(event);
			if (!anchor) return;

			const url = getInternalNavigationUrl(anchor);
			if (!url) return;

			startTransition(url.pathname);
		}

		function handleAnnouncedTransition(event: Event) {
			const href = (event as CustomEvent<{ href?: string }>).detail?.href;
			if (!href) return;

			const url = new URL(href, window.location.href);
			if (url.origin !== window.location.origin) return;

			startTransition(url.pathname);
		}

		document.addEventListener("click", handleClick, true);
		window.addEventListener(ROUTE_TRANSITION_EVENT, handleAnnouncedTransition);

		return () => {
			document.removeEventListener("click", handleClick, true);
			window.removeEventListener(ROUTE_TRANSITION_EVENT, handleAnnouncedTransition);
		};
	}, []);

	useEffect(() => {
		if (!visible || pathname === originPathRef.current) return;
		hideAfterRouteReady();
	}, [pathname, visible]);

	if (!visible) return null;

	return (
		<div
			aria-label="Opening the next page"
			className="route-transition-loader"
			data-loader-theme={loaderTheme}
			role="presentation"
		>
			<LoadingScreen
				className="route-transition-content"
				label="Opening the next Linted page"
				theme={loaderTheme}
				variant="plain"
			/>
		</div>
	);
}
