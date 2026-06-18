import Link from "next/link";
import type { ReactNode } from "react";
import BrandMark from "@/components/BrandMark";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support-contact";

export const metadata = {
	title: "Accessibility - Linted",
	description:
		"Linted accessibility support, feedback, and commitment to improving usable resume review experiences.",
};

const lastUpdated = "June 10, 2026";

function Section({
	children,
	title,
}: {
	children: ReactNode;
	title: string;
}) {
	return (
		<section>
			<h2>{title}</h2>
			{children}
		</section>
	);
}

export default function AccessibilityPage() {
	return (
		<main className="legal-page">
			<article className="legal-document">
				<Link className="legal-back-link" href="/">
					<BrandMark />
				</Link>
				<header className="legal-hero">
					<p>Accessibility</p>
					<h1>Accessibility</h1>
					<span>Last updated: {lastUpdated}</span>
				</header>

				<section className="legal-notice">
					<p>
						Linted should be usable by people reviewing resumes, posting
						feedback, and managing community discussions across a wide range of
						devices and assistive technologies.
					</p>
				</section>

				<Section title="1. Our Commitment">
					<p>
						We work to make core Linted flows readable, keyboard-accessible, and
						usable with modern screen readers. Accessibility is an ongoing
						product responsibility, especially as resume previews, comments,
						community posts, and editor tools evolve.
					</p>
				</Section>

				<Section title="2. What We Prioritize">
					<ul>
						<li>Clear text contrast and readable spacing for feed and detail pages.</li>
						<li>Keyboard access for forms, dialogs, menus, and post actions.</li>
						<li>Semantic labels for navigation, buttons, status messages, and media.</li>
						<li>Reduced-motion support where animation could distract or interfere.</li>
						<li>Responsive layouts that work from small mobile screens to desktop.</li>
					</ul>
				</Section>

				<Section title="3. Known Limitations">
					<p>
						Some uploaded resume PDFs may not be fully accessible if the source
						file lacks selectable text, proper reading order, or meaningful
						document structure. Community-uploaded media may also depend on the
						quality of user-provided titles and descriptions.
					</p>
				</Section>

				<Section title="4. Feedback and Support">
					<p>
						If something on Linted is difficult to use with assistive
						technology, keyboard navigation, zoom, or mobile accessibility
						settings, email <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>.
						Include the page URL, what you were trying to do, your device or
						browser, and the assistive technology involved when relevant.
					</p>
				</Section>

				<Section title="5. Related Documents">
					<p>
						This page works with our <Link href="/terms">User Agreement</Link>,{" "}
						<Link href="/privacy">Privacy Policy</Link>,{" "}
						<Link href="/guidelines">Linted Rules</Link>, and{" "}
						<Link href="/help">Help Center</Link>.
					</p>
				</Section>
			</article>
		</main>
	);
}
