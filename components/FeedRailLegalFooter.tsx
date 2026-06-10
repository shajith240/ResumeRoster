import Link from "next/link";
import styles from "./FeedRailLegalFooter.module.css";

const RAIL_LEGAL_LINKS = [
	{ href: "/guidelines", label: "Linted Rules" },
	{ href: "/privacy", label: "Privacy Policy" },
	{ href: "/terms", label: "User Agreement" },
	{ href: "/accessibility", label: "Accessibility" },
	{ href: "/copyright", label: "Copyright" },
] as const;

export default function FeedRailLegalFooter() {
	return (
		<footer aria-label="Linted legal links" className={styles.footer}>
			<nav aria-label="Legal" className={styles.links}>
				{RAIL_LEGAL_LINKS.map((link) => (
					<Link href={link.href} key={link.href}>
						{link.label}
					</Link>
				))}
			</nav>
			<p className={styles.copyright}>
				Linted © 2026. All rights reserved.
			</p>
		</footer>
	);
}
