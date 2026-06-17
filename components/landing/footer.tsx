"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion, type Variants } from "motion/react";
import BrandMark from "@/components/BrandMark";
import { SUPPORT_MAILTO } from "@/lib/support-contact";

type FooterLink = {
	href: string;
	label: string;
};

type FooterColumn = {
	links: FooterLink[];
	title: string;
};

const footerColumns: FooterColumn[] = [
	{
		title: "Product",
		links: [
			{ label: "Community", href: "/community" },
			{ label: "Resume Feed", href: "/feed" },
			{ label: "Leaderboard", href: "/leaderboard" },
			{ label: "Post Resume", href: "/submit" },
		],
	},
	{
		title: "Review",
		links: [
			{ label: "Guidelines", href: "/guidelines" },
			{ label: "Top Reviewers", href: "/leaderboard" },
			{ label: "Invite Reviewers", href: "/submit" },
			{ label: "Help Center", href: "/help" },
		],
	},
	{
		title: "Legal",
		links: [
			{ label: "Privacy Policy", href: "/privacy" },
			{ label: "Terms of Service", href: "/terms" },
			{ label: "Copyright Policy", href: "/copyright" },
			{ label: "Contact Us", href: SUPPORT_MAILTO },
		],
	},
];

const staggerContainer: Variants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			delayChildren: 0.05,
			staggerChildren: 0.1,
		},
	},
};

const riseItem: Variants = {
	hidden: { opacity: 0, y: 16 },
	visible: {
		opacity: 1,
		transition: { bounce: 0, duration: 0.45, type: "spring" },
		y: 0,
	},
};

function isExternalHref(href: string) {
	return href.startsWith("http://") || href.startsWith("https://");
}

function FooterDestination({
	children,
	className,
	href,
}: {
	children: ReactNode;
	className?: string;
	href: string;
}) {
	if (href.startsWith("mailto:") || isExternalHref(href)) {
		return (
			<a className={className} href={href}>
				{children}
			</a>
		);
	}

	return (
		<Link className={className} href={href}>
			{children}
		</Link>
	);
}

export function Footer() {
	return (
		<motion.footer
			className="footer"
			initial="hidden"
			variants={staggerContainer}
			viewport={{ amount: 0.15, once: true }}
			whileInView="visible"
		>
			<div className="footer-shell">
				<div className="footer-newsletter-row">
					<motion.div className="footer-newsletter-copy" variants={riseItem}>
						<h2>
							Better resume feedback,
							<br />
							without the noise.
						</h2>
					</motion.div>
				</div>

				<div className="footer-middle">
					<motion.div className="footer-brand-lockup" variants={riseItem}>
						<Link className="footer-brand" href="/" aria-label="Linted home">
							<BrandMark />
						</Link>
						<p>
							A community for posting your resume safely, getting real feedback,
							and building a reviewer reputation.
						</p>
					</motion.div>

					<nav className="footer-link-grid" aria-label="Footer">
						{footerColumns.map((column) => (
							<motion.div
								className="footer-group"
								key={column.title}
								variants={riseItem}
							>
								<h2>{column.title}</h2>
								<ul>
									{column.links.map((link) => (
										<li key={link.label}>
											<FooterDestination href={link.href}>
												{link.label}
											</FooterDestination>
										</li>
									))}
								</ul>
							</motion.div>
						))}
					</nav>
				</div>

				<motion.div className="footer-meta" variants={riseItem}>
					<p>&copy; 2026 Linted. All rights reserved.</p>
				</motion.div>
			</div>
		</motion.footer>
	);
}
