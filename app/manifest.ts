import type { MetadataRoute } from "next";
import { getAppHomeRoute } from "@/lib/app-routes";

export default function manifest(): MetadataRoute.Manifest {
	return {
		background_color: "#111113",
		description:
			"Human-powered resume linting before the recruiter/compiler rejects it.",
		display: "standalone",
		icons: [
			{
				src: "/assets/linted/app-icon-192.png",
				sizes: "192x192",
				type: "image/png",
				purpose: "any",
			},
			{
				src: "/assets/linted/app-icon-512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "any",
			},
		],
		name: "Linted",
		short_name: "Linted",
		start_url: getAppHomeRoute(),
		theme_color: "#111113",
	};
}
