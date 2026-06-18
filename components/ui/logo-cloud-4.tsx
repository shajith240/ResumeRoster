import type { ComponentProps } from "react";
import { InfiniteSlider } from "@/components/ui/infinite-slider";
import { ProgressiveBlur } from "@/components/ui/progressive-blur";
import { cn } from "@/lib/utils";

type Logo = {
	alt: string;
	height?: number;
	src?: string;
	width?: number;
};

type LogoCloudProps = ComponentProps<"div"> & {
	logos: Logo[];
};

export function LogoCloud({ className, logos, ...props }: LogoCloudProps) {
	const repeatedLogos = Array.from({ length: 3 }).flatMap((_, repeatIndex) =>
		logos.map((logo) => ({ ...logo, key: `${repeatIndex}-${logo.alt}` })),
	);

	return (
		<div className={cn("logo-cloud-4", className)} {...props}>
			<div className="logo-cloud-border logo-cloud-border-top" aria-hidden="true" />

			<InfiniteSlider gap={42} reverse speed={96} speedOnHover={48}>
				{repeatedLogos.map((logo) =>
					logo.src ? (
						<img
							alt={logo.alt}
							className="logo-cloud-logo"
							height={logo.height ?? 20}
							key={`logo-${logo.key}`}
							loading="lazy"
							src={logo.src}
							width={logo.width ?? 120}
						/>
					) : (
						<span className="logo-cloud-text" key={`logo-${logo.key}`}>
							{logo.alt}
						</span>
					),
				)}
			</InfiniteSlider>

			<ProgressiveBlur
				aria-hidden="true"
				blurIntensity={1}
				className="logo-cloud-blur logo-cloud-blur-left"
				direction="left"
			/>
			<ProgressiveBlur
				aria-hidden="true"
				blurIntensity={1}
				className="logo-cloud-blur logo-cloud-blur-right"
				direction="right"
			/>

			<div className="logo-cloud-border logo-cloud-border-bottom" aria-hidden="true" />
		</div>
	);
}
