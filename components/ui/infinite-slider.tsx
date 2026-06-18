"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

type InfiniteSliderProps = {
	children: ReactNode;
	className?: string;
	direction?: "horizontal" | "vertical";
	gap?: number;
	reverse?: boolean;
	speed?: number;
	speedOnHover?: number;
};

type SliderStyle = CSSProperties & {
	"--infinite-slider-duration"?: string;
	"--infinite-slider-gap"?: string;
	"--infinite-slider-hover-duration"?: string;
};

export function InfiniteSlider({
	children,
	className,
	direction = "horizontal",
	gap = 16,
	reverse = false,
	speed = 40,
	speedOnHover,
}: InfiniteSliderProps) {
	const style: SliderStyle = {
		"--infinite-slider-duration": `${speed}s`,
		"--infinite-slider-gap": `${gap}px`,
		"--infinite-slider-hover-duration": speedOnHover ? `${speedOnHover}s` : undefined,
	};

	return (
		<div
			className={cn(
				"infinite-slider",
				direction === "vertical" && "infinite-slider-vertical",
				reverse && "infinite-slider-reverse",
				speedOnHover && "infinite-slider-has-hover",
				className,
			)}
			style={style}
		>
			<div className="infinite-slider-track">
				<div className="infinite-slider-group">{children}</div>
				<div aria-hidden="true" className="infinite-slider-group">
					{children}
				</div>
			</div>
		</div>
	);
}
