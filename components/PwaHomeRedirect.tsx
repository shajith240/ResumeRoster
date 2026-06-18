"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PwaHomeRedirect({ to }: { to: string }) {
	const router = useRouter();

	useEffect(() => {
		if (
			window.matchMedia("(display-mode: standalone)").matches &&
			document.referrer === ""
		) {
			router.replace(to);
		}
	}, [router, to]);

	return null;
}
