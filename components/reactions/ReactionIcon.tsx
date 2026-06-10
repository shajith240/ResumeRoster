"use client";

import { useEffect, useRef, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";

type ReactionIconProps = {
	active: boolean;
	direction: "down" | "up";
};

export default function ReactionIcon({ active, direction }: ReactionIconProps) {
	const mountedRef = useRef(false);
	const previousActiveRef = useRef(active);
	const [animating, setAnimating] = useState(false);

	useEffect(() => {
		if (!mountedRef.current) {
			mountedRef.current = true;
			previousActiveRef.current = active;
			return;
		}

		if (!previousActiveRef.current && active) {
			setAnimating(true);
			const timeoutId = window.setTimeout(() => setAnimating(false), 340);
			previousActiveRef.current = active;
			return () => window.clearTimeout(timeoutId);
		}

		previousActiveRef.current = active;
		if (!active) {
			setAnimating(false);
		}
	}, [active]);

	const Icon = direction === "up" ? ThumbsUp : ThumbsDown;

	return (
		<Icon
			aria-hidden="true"
			className={`reaction-icon ${
				active ? "reaction-icon-filled" : "reaction-icon-outline"
			}${animating ? " is-animating" : ""}`}
			strokeWidth={2.2}
			style={{
				fill: active ? "currentColor" : "none",
				stroke: "currentColor",
			}}
		/>
	);
}
