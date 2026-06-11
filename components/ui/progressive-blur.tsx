import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const GRADIENT_ANGLES = {
	bottom: 180,
	left: 270,
	right: 90,
	top: 0,
} as const;

type ProgressiveBlurProps = {
	blurIntensity?: number;
	blurLayers?: number;
	direction?: keyof typeof GRADIENT_ANGLES;
} & HTMLAttributes<HTMLDivElement>;

export function ProgressiveBlur({
	blurIntensity = 0.25,
	blurLayers = 8,
	className,
	direction = "bottom",
	...props
}: ProgressiveBlurProps) {
	const layers = Math.max(blurLayers, 2);
	const segmentSize = 1 / (layers + 1);
	const angle = GRADIENT_ANGLES[direction];

	return (
		<div className={cn("progressive-blur", className)} {...props}>
			{Array.from({ length: layers }).map((_, index) => {
				const stops = [
					index * segmentSize,
					(index + 1) * segmentSize,
					(index + 2) * segmentSize,
					(index + 3) * segmentSize,
				].map(
					(position, positionIndex) =>
						`rgba(255, 255, 255, ${
							positionIndex === 1 || positionIndex === 2 ? 1 : 0
						}) ${position * 100}%`,
				);
				const mask = `linear-gradient(${angle}deg, ${stops.join(", ")})`;
				const style: CSSProperties = {
					WebkitMaskImage: mask,
					backdropFilter: `blur(${index * blurIntensity}px)`,
					maskImage: mask,
				};

				return <div className="progressive-blur-layer" key={index} style={style} />;
			})}
		</div>
	);
}
