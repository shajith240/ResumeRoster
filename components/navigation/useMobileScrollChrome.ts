"use client";

import { useEffect, useRef, useState } from "react";

type MobileScrollChromeOptions = {
	hideAfterPx?: number;
	mediaQuery?: string;
	scrollDeltaPx?: number;
};

const DEFAULT_HIDE_AFTER_PX = 96;
const DEFAULT_MEDIA_QUERY = "(max-width: 760px)";
const DEFAULT_SCROLL_DELTA_PX = 10;

export function useMobileScrollChrome({
	hideAfterPx = DEFAULT_HIDE_AFTER_PX,
	mediaQuery = DEFAULT_MEDIA_QUERY,
	scrollDeltaPx = DEFAULT_SCROLL_DELTA_PX,
}: MobileScrollChromeOptions = {}) {
	const [isHidden, setIsHidden] = useState(false);
	const [isScrolled, setIsScrolled] = useState(false);
	const hiddenRef = useRef(false);
	const lastScrollYRef = useRef(0);
	const tickingRef = useRef(false);

	useEffect(() => {
		const mobileQuery = window.matchMedia(mediaQuery);

		function updateChromeState() {
			const scrollY = Math.max(window.scrollY, 0);
			const scrollDelta = scrollY - lastScrollYRef.current;
			const shouldReact = mobileQuery.matches;
			const nextScrolled = shouldReact && scrollY > 2;
			let nextHidden = shouldReact ? hiddenRef.current : false;

			if (!shouldReact || scrollY < hideAfterPx) {
				nextHidden = false;
			} else if (scrollDelta > scrollDeltaPx) {
				nextHidden = true;
			} else if (scrollDelta < -scrollDeltaPx) {
				nextHidden = false;
			}

			if (hiddenRef.current !== nextHidden) {
				hiddenRef.current = nextHidden;
				setIsHidden(nextHidden);
			}

			setIsScrolled((current) =>
				current === nextScrolled ? current : nextScrolled,
			);
			lastScrollYRef.current = scrollY;
			tickingRef.current = false;
		}

		function scheduleChromeUpdate() {
			if (tickingRef.current) return;
			tickingRef.current = true;
			window.requestAnimationFrame(updateChromeState);
		}

		function handleViewportChange() {
			lastScrollYRef.current = Math.max(window.scrollY, 0);
			updateChromeState();
		}

		handleViewportChange();
		window.addEventListener("scroll", scheduleChromeUpdate, { passive: true });
		mobileQuery.addEventListener("change", handleViewportChange);

		return () => {
			window.removeEventListener("scroll", scheduleChromeUpdate);
			mobileQuery.removeEventListener("change", handleViewportChange);
		};
	}, [hideAfterPx, mediaQuery, scrollDeltaPx]);

	return { isHidden, isScrolled };
}
