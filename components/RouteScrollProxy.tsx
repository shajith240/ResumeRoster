"use client";

import { useEffect } from "react";

type RouteScrollProxyProps = {
	targetSelector: string;
};

const LINE_SCROLL_PX = 16;

function normalizeWheelDelta(event: WheelEvent, target: HTMLElement) {
	if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
		return {
			left: event.deltaX * LINE_SCROLL_PX,
			top: event.deltaY * LINE_SCROLL_PX,
		};
	}

	if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
		return {
			left: event.deltaX * target.clientWidth,
			top: event.deltaY * target.clientHeight,
		};
	}

	return {
		left: event.deltaX,
		top: event.deltaY,
	};
}

function shouldIgnoreProxy(eventTarget: EventTarget | null) {
	if (!(eventTarget instanceof Element)) return false;

	return Boolean(
		eventTarget.closest(
			[
				"[data-route-scroll-ignore]",
				"[role='dialog']",
				"[role='menu']",
				"[data-radix-popper-content-wrapper]",
				"input",
				"select",
				"textarea",
				"[contenteditable='true']",
			].join(","),
		),
	);
}

export default function RouteScrollProxy({
	targetSelector,
}: RouteScrollProxyProps) {
	useEffect(() => {
		function handleWheel(event: WheelEvent) {
			if (event.defaultPrevented || event.ctrlKey || shouldIgnoreProxy(event.target)) {
				return;
			}

			const target = document.querySelector<HTMLElement>(targetSelector);
			if (
				!target ||
				(event.target instanceof Node && target.contains(event.target))
			) {
				return;
			}

			const canScroll = target.scrollHeight > target.clientHeight;
			if (!canScroll) return;

			const delta = normalizeWheelDelta(event, target);
			event.preventDefault();
			target.scrollBy(delta);
		}

		document.addEventListener("wheel", handleWheel, { passive: false });

		return () => {
			document.removeEventListener("wheel", handleWheel);
		};
	}, [targetSelector]);

	return null;
}
