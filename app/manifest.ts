import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		background_color: "#111113",
		description:
			"Human-powered resume linting before the recruiter/compiler rejects it.",
		display: "standalone",
		icons: [
			{
				src: "/assets/linty-favicon.png",
				sizes: "750x750",
				type: "image/png",
			},
		],
		name: "Linted",
		short_name: "Linted",
		start_url: "/feed",
		theme_color: "#111113",
	};
}
