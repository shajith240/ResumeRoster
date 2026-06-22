"use client";

import { useEffect, useRef } from "react";
import type { ComponentType } from "react";

export type AnimHandle = { startAnimation: () => void; stopAnimation: () => void };

// Maps Tailwind size/height class → pixel integer.
// Handles: size-4 (16), h-4 (16), size-[18px], h-[1.125rem], etc.
function sizeFromClass(className: string | undefined): number | undefined {
	if (!className) return undefined;
	for (const cls of className.split(/\s+/)) {
		// size-N  (size-4 → 16, size-5 → 20)
		const sN = cls.match(/^size-([\d.]+)$/);
		if (sN) return Math.round(parseFloat(sN[1]) * 4);

		// size-[Npx] or size-[N.Nrem]
		const sArb = cls.match(/^size-\[(\d+(?:\.\d+)?)(px|rem)\]$/);
		if (sArb) {
			const n = parseFloat(sArb[1]);
			return sArb[2] === "rem" ? Math.round(n * 16) : Math.round(n);
		}

		// h-N  (h-4 → 16, h-5 → 20) — pick height as proxy for square icons
		const hN = cls.match(/^h-([\d.]+)$/);
		if (hN) return Math.round(parseFloat(hN[1]) * 4);

		// h-[Npx] or h-[N.Nrem]
		const hArb = cls.match(/^h-\[(\d+(?:\.\d+)?)(px|rem)\]$/);
		if (hArb) {
			const n = parseFloat(hArb[1]);
			return hArb[2] === "rem" ? Math.round(n * 16) : Math.round(n);
		}
	}
	return undefined;
}

function findTrigger(from: Element | null, maxDepth = 5): Element | null {
	let el = from;
	for (let d = 0; d < maxDepth && el; d++) {
		const tag = el.tagName.toLowerCase();
		const role = el.getAttribute("role");
		if (
			tag === "button" ||
			tag === "a" ||
			role === "button" ||
			role === "menuitem" ||
			role === "option" ||
			role === "tab"
		) {
			return el;
		}
		el = el.parentElement;
	}
	return null;
}

// Wraps a pqoqubbw icon so it animates when the nearest interactive ancestor
// (button / a / role=button) is hovered — not just when the icon itself is hovered.
// This is the Resend pattern: hover the whole button, the icon reacts.
//
// Also auto-derives the `size` prop from Tailwind size/height classes so that
// icons sized via className (e.g. className="size-5" or "h-4 w-4") render at
// the correct pixel size — pqoqubbw SVGs don't scale from CSS alone.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withParentHover<T extends ComponentType<any>>(Icon: T): T {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function Wrapped(props: any) {
		const iconRef = useRef<AnimHandle>(null);
		const markerRef = useRef<HTMLDivElement>(null);

		useEffect(() => {
			const trigger = findTrigger(markerRef.current?.parentElement ?? null);
			if (!trigger) return;

			const onEnter = () => iconRef.current?.startAnimation();
			const onLeave = () => iconRef.current?.stopAnimation();
			trigger.addEventListener("mouseenter", onEnter);
			trigger.addEventListener("mouseleave", onLeave);
			return () => {
				trigger.removeEventListener("mouseenter", onEnter);
				trigger.removeEventListener("mouseleave", onLeave);
			};
		}, []);

		// Prefer explicit `size` prop; fall back to parsing Tailwind class.
		const resolvedSize =
			"size" in props ? props.size : sizeFromClass(props.className);

		return (
			<>
				<div aria-hidden="true" ref={markerRef} style={{ display: "none" }} />
				<Icon {...props} size={resolvedSize} ref={iconRef} />
			</>
		);
	}
	const name = (Icon as { displayName?: string }).displayName ?? Icon.name ?? "Icon";
	Wrapped.displayName = `ParentHover(${name})`;
	return Wrapped as unknown as T;
}
