"use client";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { Flame } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const FIRE_ANIMATION_SRC = "/assets/890cb942-1177-11ee-847c-73f9b2630e61.lottie";

type LintPointsFlameProps = {
	animated?: boolean;
	className?: string;
	fallbackClassName?: string;
};

function usePrefersReducedMotion() {
	const [reducedMotion, setReducedMotion] = useState(false);

	useEffect(() => {
		const query = window.matchMedia("(prefers-reduced-motion: reduce)");
		const update = () => setReducedMotion(query.matches);

		update();
		query.addEventListener("change", update);
		return () => query.removeEventListener("change", update);
	}, []);

	return reducedMotion;
}

export default function LintPointsFlame({
	animated = true,
	className,
	fallbackClassName,
}: LintPointsFlameProps) {
	const reducedMotion = usePrefersReducedMotion();

	if (!animated || reducedMotion) {
		return (
			<Flame
				aria-hidden="true"
				className={cn("h-4 w-4 text-[var(--brand)]", fallbackClassName)}
			/>
		);
	}

	return (
		<span
			aria-hidden="true"
			className={cn(
				"inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden",
				className,
			)}
		>
			<DotLottieReact
				autoplay
				className="h-full w-full"
				loop
				src={FIRE_ANIMATION_SRC}
			/>
		</span>
	);
}
