"use client";

import fireLineDuotone from "@iconify-icons/solar/fire-line-duotone";
import {
	DotLottieReact,
	setWasmUrl,
	type DotLottie,
} from "@lottiefiles/dotlottie-react";
import { Icon } from "@iconify/react/offline";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const FIRE_ANIMATION_SRC = "/assets/890cb942-1177-11ee-847c-73f9b2630e61.lottie";
const DOTLOTTIE_WASM_SRC = "/assets/dotlottie-player.wasm";

setWasmUrl(DOTLOTTIE_WASM_SRC);

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

function StaticFlameIcon({ className }: { className?: string }) {
	return (
		<Icon
			aria-hidden="true"
			className={cn("h-4 w-4 text-[var(--brand)]", className)}
			icon={fireLineDuotone}
		/>
	);
}

export default function LintPointsFlame({
	animated = true,
	className,
	fallbackClassName,
}: LintPointsFlameProps) {
	const reducedMotion = usePrefersReducedMotion();
	const [dotLottie, setDotLottie] = useState<DotLottie | null>(null);
	const [animationReady, setAnimationReady] = useState(false);
	const [animationFailed, setAnimationFailed] = useState(false);
	const handleDotLottieRef = useCallback((instance: DotLottie | null) => {
		setDotLottie(instance);
	}, []);

	useEffect(() => {
		if (!dotLottie) return;

		const markReady = () => setAnimationReady(true);
		const markFailed = () => setAnimationFailed(true);

		dotLottie.addEventListener("ready", markReady);
		dotLottie.addEventListener("load", markReady);
		dotLottie.addEventListener("render", markReady);
		dotLottie.addEventListener("loadError", markFailed);
		dotLottie.addEventListener("renderError", markFailed);

		return () => {
			dotLottie.removeEventListener("ready", markReady);
			dotLottie.removeEventListener("load", markReady);
			dotLottie.removeEventListener("render", markReady);
			dotLottie.removeEventListener("loadError", markFailed);
			dotLottie.removeEventListener("renderError", markFailed);
		};
	}, [dotLottie]);

	if (!animated || reducedMotion) {
		return <StaticFlameIcon className={fallbackClassName} />;
	}

	return (
		<span
			aria-hidden="true"
			className={cn(
				"relative inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden text-[var(--brand)]",
				className,
			)}
		>
			<StaticFlameIcon
				className={cn(
					"absolute inset-0 m-auto h-full w-full transition-opacity duration-200",
					animationReady && !animationFailed ? "opacity-0" : "opacity-100",
					fallbackClassName,
				)}
			/>
			{animationFailed ? null : (
				<DotLottieReact
					autoplay
					className={cn(
						"relative z-10 h-full w-full transition-opacity duration-200",
						animationReady ? "opacity-100" : "opacity-0",
					)}
					dotLottieRefCallback={handleDotLottieRef}
					loop
					src={FIRE_ANIMATION_SRC}
				/>
			)}
		</span>
	);
}
