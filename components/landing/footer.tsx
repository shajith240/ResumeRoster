import Link from "next/link";
import { asset, footerGroups, type FooterLink } from "./content";

function renderFooterLink(link: FooterLink) {
	return link.href.startsWith("mailto:") ? (
		<a href={link.href} key={link.label}>
			{link.label}
		</a>
	) : (
		<Link href={link.href} key={link.label}>
			{link.label}
		</Link>
	);
}

export function Footer() {
	return (
		<footer className="footer">
			<div className="footer-doodles" aria-hidden="true">
				<img
					className="footer-doodle footer-doodle-left"
					src={asset("trashcan_doodle.png")}
					alt=""
				/>
				<img
					className="footer-doodle footer-doodle-center"
					src={asset("riphope_doodle.png")}
					alt=""
				/>
				<img
					className="footer-doodle footer-doodle-right"
					src={asset("tryharder_doodle.png")}
					alt=""
				/>
			</div>

			<div className="footer-shell">
				<nav className="footer-columns" aria-label="Footer">
					{footerGroups.map((group) => (
						<div className="footer-group" key={group.title}>
							<h2>{group.title}</h2>
							<div className="footer-links">
								{group.links.map(renderFooterLink)}
							</div>
						</div>
					))}
				</nav>

				<nav className="footer-mobile-nav" aria-label="Footer">
					{footerGroups.map((group) => (
						<details className="footer-mobile-group" key={group.title}>
							<summary>{group.title}</summary>
							<div className="footer-mobile-links">
								{group.links.map(renderFooterLink)}
							</div>
						</details>
					))}
				</nav>

				<div className="footer-bottom">
					<div className="socials" aria-label="Social links">
						<span className="sr-only">Social links</span>
						<div className="social-links">
							<a href="#" aria-label="Instagram">
								<svg viewBox="0 0 24 24" aria-hidden="true">
									<path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4c0 3.2-2.6 5.8-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8C2 4.6 4.6 2 7.8 2Zm-.2 2A3.6 3.6 0 0 0 4 7.6v8.8A3.6 3.6 0 0 0 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6A3.6 3.6 0 0 0 16.4 4H7.6Zm9.65 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
								</svg>
							</a>
							<a href="#" aria-label="YouTube">
								<svg viewBox="0 0 24 24" aria-hidden="true">
									<path d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.6 12 4.6 12 4.6s-5.7 0-7.5.5a3 3 0 0 0-2.1 2.1C2 9 2 12 2 12s0 3 .4 4.8a3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1c.4-1.8.4-4.8.4-4.8s0-3-.4-4.8ZM10 15.3V8.7l5.75 3.3L10 15.3Z" />
								</svg>
							</a>
							<a href="#" aria-label="X">
								<svg viewBox="0 0 24 24" aria-hidden="true">
									<path d="M13.8 10.5 21 2h-1.7l-6.2 7.3L8.1 2H2.3l7.6 11.1L2.3 22H4l6.7-7.8 5.3 7.8h5.8l-8-11.5Zm-2.4 2.8-.8-1.1L4.5 3.3h2.8l4.9 7 .8 1.1 6.4 9.2h-2.8l-5.2-7.3Z" />
								</svg>
							</a>
							<a href="#" aria-label="LinkedIn">
								<svg viewBox="0 0 24 24" aria-hidden="true">
									<path d="M4.98 3.5a2.5 2.5 0 1 1 0 5.001 2.5 2.5 0 0 1 0-5ZM3 9.75h4v11H3v-11Zm6.25 0h3.82v1.5h.05c.53-1 1.84-1.72 3.78-1.72 4.04 0 4.79 2.66 4.79 6.12v5.1h-4v-4.52c0-1.08-.02-2.47-1.5-2.47-1.51 0-1.74 1.18-1.74 2.39v4.6h-4v-11Z" />
								</svg>
							</a>
						</div>
					</div>

					<p>&copy; 2026 Linted. All rights reserved.</p>
				</div>
			</div>
		</footer>
	);
}
