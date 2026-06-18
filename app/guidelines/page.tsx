import Link from "next/link";
import type { ReactNode } from "react";
import BrandMark from "@/components/BrandMark";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support-contact";

export const metadata = {
	title: "Community Guidelines - Linted",
	description:
		"How to give useful resume feedback and keep the Linted community safe, practical, and respectful.",
};

const lastUpdated = "May 30, 2026";

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

export default function CommunityGuidelinesPage() {
	return (
		<main className="legal-page">
			<article className="legal-document">
				<Link className="legal-back-link" href="/">
					<BrandMark />
				</Link>
				<header className="legal-hero">
					<p>Community</p>
					<h1>Community Guidelines</h1>
					<span>Last updated: {lastUpdated}</span>
				</header>

				<section className="legal-notice">
					<p>
						Linted exists so people can get sharper resume feedback without
						getting mocked, exposed, or misled. Be direct, useful, and humane.
						Critique the resume, not the person.
					</p>
				</section>

				<Section title="1. Give Useful Resume Feedback">
					<p>Good feedback is specific, practical, and tied to the resume.</p>
					<ul>
						<li>Point to the exact section, bullet, phrasing, or missing proof.</li>
						<li>Explain why something may confuse a recruiter or reviewer.</li>
						<li>Offer a clearer rewrite or concrete next step when possible.</li>
						<li>Separate facts from opinions and assumptions.</li>
						<li>Respect the user&apos;s target role, experience level, and context.</li>
					</ul>
				</Section>

				<Section title="2. Be Direct Without Being Cruel">
					<p>
						Linted feedback can be honest and sharp. It cannot be abusive. Do not
						insult someone&apos;s intelligence, background, school, identity,
						career gap, English fluency, income, or personal situation.
					</p>
					<p>
						Examples of acceptable directness: &quot;This bullet is too vague&quot;
						or &quot;The impact is missing.&quot; Examples of unacceptable behavior:
						name-calling, humiliation, threats, pile-ons, or comments meant only
						to embarrass the person.
					</p>
				</Section>

				<Section title="3. Do Not Share Private Information">
					<p>
						Do not reveal, repost, quote, screenshot, or link to someone&apos;s
						private personal information without permission. This includes phone
						numbers, home addresses, personal emails, IDs, private social
						profiles, workplace details, or any information that could expose a
						user to harassment or real-world harm.
					</p>
					<p>
						If you notice private information in a resume, tell the user to remove
						it. Do not repeat the private information in your review.
					</p>
				</Section>

				<Section title="4. No Harassment, Hate, or Threats">
					<p>We do not allow:</p>
					<ul>
						<li>harassment, bullying, stalking, or targeted abuse;</li>
						<li>hate speech or slurs based on protected or personal traits;</li>
						<li>threats, encouragement of violence, or celebration of harm;</li>
						<li>sexual harassment or unwanted sexual comments;</li>
						<li>coordinated attacks, dogpiling, or attempts to drive users away.</li>
					</ul>
				</Section>

				<Section title="5. Be Honest About Who You Are">
					<p>
						Do not pretend to be a recruiter, hiring manager, employee,
						professor, career coach, verified reviewer, or company representative
						if you are not. Do not fake credentials, work history, schools,
						placements, or hiring authority.
					</p>
					<p>
						Public profiles and trust labels are meant to help users understand
						context. They are not a license to mislead people or overstate your
						authority.
					</p>
				</Section>

				<Section title="6. Protect Review Integrity">
					<p>
						Lint points and leaderboards should reflect genuinely helpful
						feedback. Do not manipulate them.
					</p>
					<ul>
						<li>No fake accounts, self-voting, or coordinated vote rings.</li>
						<li>No buying, selling, trading, or pressuring users for votes.</li>
						<li>No spam reviews written only to farm lint points.</li>
						<li>No copying other people&apos;s reviews and presenting them as yours.</li>
					</ul>
				</Section>

				<Section title="7. No Spam or Low-Quality Promotion">
					<p>
						Do not use Linted mainly to advertise services, sell courses, farm
						leads, promote agencies, drop referral links, or push unrelated
						products. Helpful context is fine. Repetitive promotion is not.
					</p>
				</Section>

				<Section title="8. Do Not Upload Harmful or Illegal Content">
					<p>Do not upload or post:</p>
					<ul>
						<li>malware, phishing links, scams, or deceptive files;</li>
						<li>
							<Link href="/copyright">copyrighted content</Link> you do not have
							permission to share;
						</li>
						<li>illegal content or instructions for illegal activity;</li>
						<li>graphic, sexual, exploitative, or violent material unrelated to resume review.</li>
					</ul>
				</Section>

				<Section title="9. Respect Anonymity and Privacy Modes">
					<p>
						If a user posts anonymously or hides contact details, respect that
						choice. Do not try to identify them, pressure them to reveal
						themselves, or connect their resume to external profiles without a
						clear, helpful, and privacy-safe reason.
					</p>
				</Section>

				<Section title="10. Report Problems">
					<p>
						Report content or behavior that may violate these Guidelines, our{" "}
						<Link href="/terms">Terms</Link>, or our{" "}
						<Link href="/privacy">Privacy Policy</Link>. If the in-product
						reporting flow is unavailable, email{" "}
						<a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a> with the link,
						screenshot if appropriate, and a short explanation.
					</p>
				</Section>

				<Section title="11. How We Enforce These Guidelines">
					<p>
						We may remove content, hide reviews, remove lint points, reject trust
						applications, limit features, suspend accounts, or ban users when we
						believe these Guidelines were violated.
					</p>
					<p>
						We consider context, severity, user history, safety risk, and whether
						the behavior appears accidental or intentional. Serious abuse can lead
						to immediate action.
					</p>
				</Section>

				<Section title="12. Appeals and Mistakes">
					<p>
						Moderation is imperfect. If you believe we made a mistake, contact{" "}
						<a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a> with the
						account, content link, and why you think the decision should be
						reviewed.
					</p>
				</Section>

				<section className="legal-disclaimer">
					<p>
						These Guidelines work with the Terms of Service. If there is a
						conflict, the Terms control. We may update these Guidelines as the
						community and product evolve.
					</p>
				</section>
			</article>
		</main>
	);
}
