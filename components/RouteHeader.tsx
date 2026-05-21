"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthButton from "./AuthButton";

const navLinks = [
	{ href: "/feed", label: "Home", icon: "H" },
	{ href: "/feed?sort=new", label: "New", icon: "N" },
	{ href: "/feed?sort=top", label: "Top rated", icon: "T" },
	{ href: "/submit", label: "Post resume", icon: "+" },
	{ href: "/leaderboard", label: "Leaderboard", icon: "L" },
];

export default function RouteHeader() {
	const pathname = usePathname();

	return (
		<>
			<header className="app-header">
				<Link href="/feed" className="app-logo" aria-label="ResumeRoster home">
					ResumeRoster
				</Link>

				<AuthButton />
			</header>

			<nav className="bottom-nav" aria-label="Mobile navigation">
				{navLinks.map((link) => {
					const isFeedMatch = pathname === "/feed" && link.href === "/feed";
					const isRouteMatch = link.href === pathname;

					return (
						<Link
							className={isFeedMatch || isRouteMatch ? "active" : ""}
							href={link.href}
							key={link.label}
						>
							<span>{link.icon}</span>
							{link.label === "Top rated"
								? "Top"
								: link.label === "Post resume"
									? "Post"
									: link.label}
						</Link>
					);
				})}
			</nav>
		</>
	);
}
