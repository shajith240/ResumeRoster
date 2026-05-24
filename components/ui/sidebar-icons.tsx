"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type {
	ForwardRefExoticComponent,
	HTMLAttributes,
	MouseEvent,
	ReactNode,
	RefAttributes,
} from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";

export interface SidebarAnimatedIconHandle {
	startAnimation: () => void;
	stopAnimation: () => void;
}

interface SidebarAnimatedIconProps extends HTMLAttributes<HTMLDivElement> {
	size?: number;
}

export type SidebarAnimatedIconComponent = ForwardRefExoticComponent<
	SidebarAnimatedIconProps & RefAttributes<SidebarAnimatedIconHandle>
>;

type IconControls = ReturnType<typeof useAnimation>;

function createSidebarIcon(
	displayName: string,
	renderIcon: (controls: IconControls) => ReactNode,
) {
	const Icon = forwardRef<SidebarAnimatedIconHandle, SidebarAnimatedIconProps>(
		({ onMouseEnter, onMouseLeave, className, size = 24, ...props }, ref) => {
			const controls = useAnimation();
			const isControlledRef = useRef(false);

			useImperativeHandle(ref, () => {
				isControlledRef.current = true;

				return {
					startAnimation: () => controls.start("animate"),
					stopAnimation: () => controls.start("normal"),
				};
			});

			const handleMouseEnter = useCallback(
				(event: MouseEvent<HTMLDivElement>) => {
					if (isControlledRef.current) {
						onMouseEnter?.(event);
					} else {
						controls.start("animate");
					}
				},
				[controls, onMouseEnter],
			);

			const handleMouseLeave = useCallback(
				(event: MouseEvent<HTMLDivElement>) => {
					if (isControlledRef.current) {
						onMouseLeave?.(event);
					} else {
						controls.start("normal");
					}
				},
				[controls, onMouseLeave],
			);

			return (
				<div
					className={cn(className)}
					onMouseEnter={handleMouseEnter}
					onMouseLeave={handleMouseLeave}
					{...props}
				>
					<svg
						fill="none"
						height={size}
						stroke="currentColor"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth="2"
						viewBox="0 0 24 24"
						width={size}
						xmlns="http://www.w3.org/2000/svg"
					>
						{renderIcon(controls)}
					</svg>
				</div>
			);
		},
	);

	Icon.displayName = displayName;
	return Icon;
}

const HOME_BODY_VARIANTS: Variants = {
	normal: { scale: 1, y: 0 },
	animate: {
		scale: [1, 1.04, 1],
		y: [0, -0.5, 0],
		transition: { duration: 0.45, ease: "easeInOut" },
	},
};

const HOME_ROOF_VARIANTS: Variants = {
	normal: { y: 0 },
	animate: {
		y: [0, -1.5, 0],
		transition: { duration: 0.45, ease: "easeInOut" },
	},
};

const LIST_VARIANTS: Variants = {
	normal: { pathLength: 1, x: 0 },
	animate: {
		pathLength: [1, 0.65, 1],
		x: [0, 1.5, 0],
		transition: { duration: 0.45, ease: "easeInOut" },
	},
};

const FLAME_VARIANTS: Variants = {
	normal: { scale: 1, rotate: 0 },
	animate: {
		scale: [1, 1.08, 0.98, 1],
		rotate: [0, -3, 3, 0],
		transition: { duration: 0.55, ease: "easeInOut" },
	},
};

const PLUS_HORIZONTAL_VARIANTS: Variants = {
	normal: { pathLength: 1, x: 0 },
	animate: {
		pathLength: [1, 0.5, 1],
		x: [0, 1, 0],
		transition: { duration: 0.38, ease: "easeInOut" },
	},
};

const PLUS_VERTICAL_VARIANTS: Variants = {
	normal: { pathLength: 1, y: 0 },
	animate: {
		pathLength: [1, 0.5, 1],
		y: [0, -1, 0],
		transition: { duration: 0.38, delay: 0.04, ease: "easeInOut" },
	},
};

const TROPHY_CUP_VARIANTS: Variants = {
	normal: { y: 0, scale: 1 },
	animate: {
		y: [0, -1.5, 0],
		scale: [1, 1.04, 1],
		transition: { duration: 0.5, ease: "easeInOut" },
	},
};

const TROPHY_HANDLE_VARIANTS: Variants = {
	normal: { pathLength: 1, opacity: 1 },
	animate: {
		pathLength: [1, 0.78, 1],
		opacity: [1, 0.7, 1],
		transition: { duration: 0.5, ease: "easeInOut" },
	},
};

const TROPHY_BASE_VARIANTS: Variants = {
	normal: { y: 0 },
	animate: {
		y: [0, 1, 0],
		transition: { duration: 0.5, ease: "easeInOut" },
	},
};

const SHIELD_VARIANTS: Variants = {
	normal: { scale: 1, y: 0 },
	animate: {
		scale: [1, 1.04, 1],
		y: [0, -1, 0],
		transition: { duration: 0.48, ease: "easeInOut" },
	},
};

const SHIELD_CHECK_VARIANTS: Variants = {
	normal: { pathLength: 1 },
	animate: {
		pathLength: [1, 0.58, 1],
		transition: { duration: 0.48, ease: "easeInOut" },
	},
};

export const HomeIcon = createSidebarIcon("HomeIcon", (controls) => (
	<>
		<motion.path
			animate={controls}
			d="M5 10v10h14V10"
			variants={HOME_BODY_VARIANTS}
		/>
		<motion.path
			animate={controls}
			d="m3 10 9-7 9 7"
			variants={HOME_ROOF_VARIANTS}
		/>
		<motion.path
			animate={controls}
			d="M10 20v-6h4v6"
			variants={HOME_BODY_VARIANTS}
		/>
	</>
));

export const ListFilterIcon = createSidebarIcon(
	"ListFilterIcon",
	(controls) => (
		<>
			<motion.path animate={controls} d="M3 6h18" variants={LIST_VARIANTS} />
			<motion.path
				animate={controls}
				d="M7 12h10"
				transition={{ delay: 0.05 }}
				variants={LIST_VARIANTS}
			/>
			<motion.path
				animate={controls}
				d="M10 18h4"
				transition={{ delay: 0.1 }}
				variants={LIST_VARIANTS}
			/>
		</>
	),
);

export const FlameIcon = createSidebarIcon("FlameIcon", (controls) => (
	<motion.path
		animate={controls}
		d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"
		style={{ originX: 0.5, originY: 0.75 }}
		variants={FLAME_VARIANTS}
	/>
));

export const PlusIcon = createSidebarIcon("PlusIcon", (controls) => (
	<>
		<motion.path
			animate={controls}
			d="M5 12h14"
			variants={PLUS_HORIZONTAL_VARIANTS}
		/>
		<motion.path
			animate={controls}
			d="M12 5v14"
			variants={PLUS_VERTICAL_VARIANTS}
		/>
	</>
));

export const TrophyIcon = createSidebarIcon("TrophyIcon", (controls) => (
	<>
		<motion.path
			animate={controls}
			d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"
			variants={TROPHY_HANDLE_VARIANTS}
		/>
		<motion.path
			animate={controls}
			d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"
			variants={TROPHY_HANDLE_VARIANTS}
		/>
		<motion.path
			animate={controls}
			d="M18 2H6v7a6 6 0 0 0 12 0V2Z"
			variants={TROPHY_CUP_VARIANTS}
		/>
		<motion.path
			animate={controls}
			d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"
			variants={TROPHY_BASE_VARIANTS}
		/>
		<motion.path
			animate={controls}
			d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"
			variants={TROPHY_BASE_VARIANTS}
		/>
		<motion.path
			animate={controls}
			d="M4 22h16"
			variants={TROPHY_BASE_VARIANTS}
		/>
	</>
));

export const ShieldIcon = createSidebarIcon("ShieldIcon", (controls) => (
	<>
		<motion.path
			animate={controls}
			d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"
			variants={SHIELD_VARIANTS}
		/>
		<motion.path
			animate={controls}
			d="m9 12 2 2 4-5"
			variants={SHIELD_CHECK_VARIANTS}
		/>
	</>
));
