"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const STORAGE_PREFIX = "linted.scroll-position.v1";
const RESTORE_ATTEMPTS = 90;
const RESTORE_TOLERANCE_PX = 4;

function getStorageKey(routeKey: string) {
	return `${STORAGE_PREFIX}:${routeKey}`;
}

function getWindowScrollY() {
	return Math.max(
		0,
		window.scrollY ||
			document.documentElement.scrollTop ||
			document.body.scrollTop ||
			0,
	);
}

function getMaxScrollY() {
	return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

function readSavedScrollY(routeKey: string) {
	try {
		const value = window.sessionStorage.getItem(getStorageKey(routeKey));
		if (!value) return null;

		const scrollY = Number(value);
		return Number.isFinite(scrollY) && scrollY > 0 ? scrollY : null;
	} catch {
		return null;
	}
}

function saveScrollPosition(routeKey: string) {
	try {
		window.sessionStorage.setItem(
			getStorageKey(routeKey),
			String(Math.round(getWindowScrollY())),
		);
	} catch {
		// Private browsing or strict storage settings can block sessionStorage.
	}
}

function scrollToY(scrollY: number) {
	const root = document.documentElement;
	const previousScrollBehavior = root.style.scrollBehavior;

	root.style.scrollBehavior = "auto";
	window.scrollTo({ left: 0, top: scrollY });
	root.style.scrollBehavior = previousScrollBehavior;
}

export default function AppScrollRestoration() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const search = searchParams.toString();
	const routeKey = search ? `${pathname}?${search}` : pathname;
	const frameRef = useRef<number | null>(null);
	const isRestoringRef = useRef(false);
	const routeKeyRef = useRef(routeKey);

	useEffect(() => {
		if (!("scrollRestoration" in window.history)) return;

		const previousScrollRestoration = window.history.scrollRestoration;
		window.history.scrollRestoration = "manual";

		return () => {
			window.history.scrollRestoration = previousScrollRestoration;
		};
	}, []);

	useEffect(() => {
		if (routeKeyRef.current !== routeKey) {
			saveScrollPosition(routeKeyRef.current);
			routeKeyRef.current = routeKey;
		}
	}, [routeKey]);

	useEffect(() => {
		function flushSave() {
			if (frameRef.current !== null) {
				window.cancelAnimationFrame(frameRef.current);
				frameRef.current = null;
			}

			if (!isRestoringRef.current) {
				saveScrollPosition(routeKeyRef.current);
			}
		}

		function scheduleSave() {
			if (isRestoringRef.current || frameRef.current !== null) return;

			frameRef.current = window.requestAnimationFrame(() => {
				frameRef.current = null;
				saveScrollPosition(routeKeyRef.current);
			});
		}

		function handleVisibilityChange() {
			if (document.visibilityState === "hidden") {
				flushSave();
			}
		}

		window.addEventListener("scroll", scheduleSave, { passive: true });
		window.addEventListener("pagehide", flushSave);
		window.addEventListener("beforeunload", flushSave);
		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			window.removeEventListener("scroll", scheduleSave);
			window.removeEventListener("pagehide", flushSave);
			window.removeEventListener("beforeunload", flushSave);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			flushSave();
		};
	}, []);

	useEffect(() => {
		if (window.location.hash) return;

		const savedScrollY = readSavedScrollY(routeKey);
		if (savedScrollY === null) return;

		const targetSavedScrollY = savedScrollY;
		let attempts = 0;
		let cancelled = false;
		let restoreFrame: number | null = null;
		isRestoringRef.current = true;

		function finishRestoring() {
			isRestoringRef.current = false;
		}

		function scheduleRestore() {
			restoreFrame = window.requestAnimationFrame(restore);
		}

		function restore() {
			restoreFrame = null;
			if (cancelled) return;

			const maxScrollY = getMaxScrollY();
			const targetScrollY = Math.min(targetSavedScrollY, maxScrollY);
			scrollToY(targetScrollY);

			attempts += 1;

			const reachedSavedPosition =
				maxScrollY >= targetSavedScrollY &&
				Math.abs(getWindowScrollY() - targetScrollY) <=
					RESTORE_TOLERANCE_PX;

			if (reachedSavedPosition || attempts >= RESTORE_ATTEMPTS) {
				finishRestoring();
				return;
			}

			scheduleRestore();
		}

		scheduleRestore();

		return () => {
			cancelled = true;
			const currentRestoreFrame = restoreFrame;
			if (currentRestoreFrame !== null) {
				window.cancelAnimationFrame(currentRestoreFrame);
			}
			finishRestoring();
		};
	}, [routeKey]);

	return null;
}
