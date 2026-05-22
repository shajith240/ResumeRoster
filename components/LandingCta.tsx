"use client";

import Link from "next/link";
import { getLoginPath } from "@/lib/auth-redirect";

type LandingCtaProps = {
	children: React.ReactNode;
	className: string;
	href: string;
	isSignedIn: boolean;
};

export default function LandingCta({
	children,
	className,
	href,
	isSignedIn,
}: LandingCtaProps) {
	if (isSignedIn) {
		return (
			<Link className={className} href={href}>
				{children}
			</Link>
		);
	}

	return (
		<Link className={className} href={getLoginPath(href)}>
			{children}
		</Link>
	);
}
