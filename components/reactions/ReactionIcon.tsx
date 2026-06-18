"use client";

import { useEffect, useRef, useState } from "react";
import { ThumbsDown, ThumbsUp } from "@phosphor-icons/react";

type ReactionIconProps = {
	active: boolean;
	direction: "down" | "up";
};

/**
 * Two-icon crossfade pattern (YouTube / Reddit method):
 *  - Both outline (regular) and fill icons are always in the DOM, stacked.
 *  - CSS drives which is visible based on data-active.
 *  - On activation, `is-animating` triggers a spring-scale keyframe on the
 *    fill icon so it "pops" in instead of instantly swapping.
 *  - De-activation just crossfades back — no bounce needed on unlike.
 */
export default function ReactionIcon({ active, direction }: ReactionIconProps) {
	const mountedRef = useRef(false);
	const [animating, setAnimating] = useState(false);

	useEffect(() => {
		if (!mountedRef.current) {
			mountedRef.current = true;
			return;
		}
		if (active) {
			setAnimating(true);
			const id = window.setTimeout(() => setAnimating(false), 400);
			return () => window.clearTimeout(id);
		}
	}, [active]);

	const Icon = direction === "up" ? ThumbsUp : ThumbsDown;

	return (
		<span
			aria-hidden="true"
			className={`reaction-icon-wrap${animating ? " is-animating" : ""}`}
			data-active={String(active)}
		>
			<Icon className="reaction-icon reaction-icon-outline" weight="regular" />
			<Icon className="reaction-icon reaction-icon-fill"    weight="fill"    />
		</span>
	);
}
