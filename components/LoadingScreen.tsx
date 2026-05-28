import { cn } from "@/lib/utils";

type LoadingScreenProps = {
	caption?: string;
	className?: string;
	label?: string;
	theme?: "auto" | "dark" | "light";
	variant?: "panel" | "plain" | "compact";
};

const LOADING_ANIMATION_SRC = "/assets/lodingscreen%20animation.webm";

export default function LoadingScreen({
	caption,
	className,
	label = "Loading Linted",
	theme = "auto",
	variant = "panel",
}: LoadingScreenProps) {
	return (
		<div
			aria-label={label}
			aria-live="polite"
			className={cn("loading-screen", `loading-screen-${variant}`, className)}
			data-loader-theme={theme}
			role="status"
		>
			<video
				aria-hidden="true"
				autoPlay
				className="loading-screen-video"
				loop
				muted
				playsInline
				preload="auto"
				src={LOADING_ANIMATION_SRC}
			/>
			{caption ? <p>{caption}</p> : null}
		</div>
	);
}
