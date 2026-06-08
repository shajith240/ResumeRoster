"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthButton from "./AuthButton";
import BrandMark from "./BrandMark";
import { getPrimaryNavigationItems } from "@/components/navigation/primary-nav";
import { useMobileScrollChrome } from "@/components/navigation/useMobileScrollChrome";
import { getAppHomeRoute } from "@/lib/app-routes";

type RouteHeaderProps = {
	hideAppHeaderOnMobile?: boolean;
};

export default function RouteHeader({
	hideAppHeaderOnMobile = false,
}: RouteHeaderProps) {
	const pathname = usePathname();
	const dockLinks = getPrimaryNavigationItems({ pathname });
	const { isHidden: isChromeHidden, isScrolled: isChromeScrolled } =
		useMobileScrollChrome({ mediaQuery: "(max-width: 900px)" });
	const appHomeRoute = getAppHomeRoute();

	return (
		<>
			<header
				className={[
					"app-header",
					hideAppHeaderOnMobile ? "app-header-mobile-hidden" : "",
					isChromeScrolled ? "is-mobile-scrolled" : "",
					isChromeHidden ? "is-mobile-hidden" : "",
				]
					.filter(Boolean)
					.join(" ")}
			>
				<Link href={appHomeRoute} className="app-logo" aria-label="Linted home">
					<BrandMark />
				</Link>

				<AuthButton />
			</header>

			<nav
				className={[
					"bottom-nav",
					isChromeScrolled ? "is-mobile-scrolled" : "",
					isChromeHidden ? "is-mobile-hidden" : "",
				]
					.filter(Boolean)
					.join(" ")}
				aria-label="Mobile navigation"
				style={{
					gridTemplateColumns: `repeat(${dockLinks.length}, minmax(0, 1fr))`,
				}}
			>
				{dockLinks.map((link) => {
					const Icon = link.dockIcon;

					return (
						<Link
							aria-current={link.active ? "page" : undefined}
							aria-label={link.label}
							className={[
								"dock-link",
								link.tone === "primary" ? "dock-link-primary" : "",
								link.active ? "active" : "",
							]
								.filter(Boolean)
								.join(" ")}
							href={link.href}
							key={link.id}
						>
							<span className="dock-icon-wrap">
								<Icon aria-hidden="true" size={20} strokeWidth={2.1} />
							</span>
							<span className="dock-label">{link.mobileLabel}</span>
						</Link>
					);
				})}
			</nav>
		</>
	);
}
