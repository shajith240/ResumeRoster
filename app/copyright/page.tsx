import Link from "next/link";
import type { ReactNode } from "react";
import BrandMark from "@/components/BrandMark";

export const metadata = {
	title: "Copyright and Takedown Policy - Linted",
	description:
		"How Linted handles copyright complaints, takedown requests, counter-notices, and repeat infringement.",
};

const lastUpdated = "May 30, 2026";
const contactEmail = "shajith240@gmail.com";
const siteUrl = "https://linted.space";

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

export default function CopyrightPolicyPage() {
	return (
		<main className="legal-page">
			<article className="legal-document">
				<Link className="legal-back-link" href="/">
					<BrandMark />
				</Link>
				<header className="legal-hero">
					<p>Copyright</p>
					<h1>Copyright and Takedown Policy</h1>
					<span>Last updated: {lastUpdated}</span>
				</header>

				<section className="legal-notice">
					<p>
						Linted respects intellectual property rights and expects users to do
						the same. This policy explains how to report content that you believe
						infringes copyright, how affected users may respond, and how we
						handle repeat infringement.
					</p>
				</section>

				<Section title="1. Who We Are">
					<p>
						Linted is operated by Bathina Shajith. The Service is available at{" "}
						<a href={siteUrl}>{siteUrl}</a>. Copyright and takedown requests can
						be sent to <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
					</p>
					<p>
						This contact is for copyright and intellectual property complaints.
						For privacy, safety, harassment, or account issues, please also review
						our <Link href="/privacy">Privacy Policy</Link> and{" "}
						<Link href="/guidelines">Community Guidelines</Link>.
					</p>
				</Section>

				<Section title="2. User Responsibility">
					<p>
						Only upload or post content that you own, have permission to use, or
						are legally allowed to use. This includes resumes, screenshots,
						avatars, profile text, reviews, attachments, images, and any other
						material you submit to Linted.
					</p>
					<p>
						Do not upload templates, paid resume examples, screenshots, logos,
						course materials, recruiter documents, or third-party content unless
						you have the right to share them.
					</p>
				</Section>

				<Section title="3. Before Sending a Takedown Notice">
					<p>
						Copyright law can allow some uses without permission, such as fair use,
						quotation, criticism, commentary, or other lawful exceptions depending
						on the country and facts. Please consider whether the use may be
						authorized before sending a complaint.
					</p>
					<p>
						If your concern is that a resume exposes personal information,
						contact us as a privacy or safety issue. Do not include unnecessary
						private information in a copyright notice.
					</p>
				</Section>

				<Section title="4. Copyright Takedown Notices">
					<p>
						To report alleged copyright infringement, email{" "}
						<a href={`mailto:${contactEmail}`}>{contactEmail}</a> with a written
						notice that includes:
					</p>
					<ul>
						<li>
							your physical or electronic signature, or the signature of someone
							authorized to act for the copyright owner;
						</li>
						<li>
							identification of the copyrighted work you claim was infringed;
						</li>
						<li>
							the exact Linted URL, profile, review, resume, image, or other
							material you want removed or disabled;
						</li>
						<li>
							enough contact information for us to reach you, such as your name,
							email address, phone number, and mailing address if available;
						</li>
						<li>
							a statement that you have a good faith belief that the disputed use
							is not authorized by the copyright owner, its agent, or the law;
						</li>
						<li>
							a statement that the information in your notice is accurate and, if
							your notice is intended under the U.S. DMCA, that you are authorized
							to act for the owner under penalty of perjury.
						</li>
					</ul>
					<p>
						Please send complete and specific notices. We may reject or ask for
						more information about notices that are incomplete, unclear, abusive,
						or not actually about copyright.
					</p>
				</Section>

				<Section title="5. What Happens After a Notice">
					<p>
						When we receive a copyright complaint that appears complete and
						credible, we may remove or disable access to the reported content,
						notify the affected user, preserve relevant records, and take other
						reasonable steps to protect users and Linted.
					</p>
					<p>
						We may forward the notice, including the complainant&apos;s contact
						information, to the affected user, service providers, legal advisors,
						or others when reasonably necessary to process the complaint or comply
						with law.
					</p>
				</Section>

				<Section title="6. Counter-Notices">
					<p>
						If your content was removed because of a copyright complaint and you
						believe the removal was a mistake or misidentification, contact{" "}
						<a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
					</p>
					<p>
						If your counter-notice is intended under the U.S. DMCA, it should
						include:
					</p>
					<ul>
						<li>your physical or electronic signature;</li>
						<li>
							identification of the removed material and where it appeared before
							removal;
						</li>
						<li>
							a statement under penalty of perjury that you have a good faith
							belief the material was removed or disabled because of mistake or
							misidentification;
						</li>
						<li>your name, address, telephone number, and email address;</li>
						<li>
							a statement consenting to the jurisdiction required by 17 U.S.C.
							512(g) and accepting service of process from the complaining party
							or its agent.
						</li>
					</ul>
					<p>
						Where the DMCA applies, we may restore the material after forwarding a
						valid counter-notice unless the original complainant tells us it has
						filed a court action seeking to restrain the allegedly infringing
						activity.
					</p>
				</Section>

				<Section title="7. Repeat Infringer Policy">
					<p>
						Linted may suspend or terminate users who repeatedly infringe
						copyright or other intellectual property rights in appropriate
						circumstances.
					</p>
					<p>
						We may consider valid takedown notices, court orders, successful or
						unsuccessful counter-notices, user history, severity, intent, and
						other relevant context. Serious or deliberate infringement may result
						in immediate removal or account action.
					</p>
				</Section>

				<Section title="8. False or Abusive Claims">
					<p>
						Do not submit false, misleading, retaliatory, or abusive copyright
						claims. Copyright takedown systems should not be used to silence
						criticism, hide embarrassing but lawful feedback, remove competition,
						or expose a user&apos;s private information.
					</p>
					<p>
						We may reject abusive requests, restrict accounts, or take other
						action when we believe the copyright process is being misused.
					</p>
				</Section>

				<Section title="9. Trademarks and Other IP">
					<p>
						If your complaint involves trademarks, logos, impersonation, or other
						non-copyright rights, email <a href={`mailto:${contactEmail}`}>{contactEmail}</a>{" "}
						with enough detail for us to identify the issue. We may handle those
						complaints under this policy, the Terms, the Community Guidelines, or
						another appropriate process.
					</p>
				</Section>

				<Section title="10. No Legal Advice">
					<p>
						Linted cannot give legal advice and cannot decide every copyright
						dispute like a court. We may make practical moderation decisions based
						on the information available to us, applicable law, platform safety,
						and our policies.
					</p>
				</Section>

				<Section title="11. Updates">
					<p>
						We may update this policy as Linted grows, as the law changes, or as
						our reporting tools improve. The latest version will be posted on this
						page.
					</p>
				</Section>

				<section className="legal-disclaimer">
					<p>
						This policy works with our <Link href="/terms">Terms of Service</Link>
						, <Link href="/privacy">Privacy Policy</Link>, and{" "}
						<Link href="/guidelines">Community Guidelines</Link>. It does not
						waive any rights, remedies, limitations, or defenses available to
						Linted or any user under applicable law.
					</p>
				</section>
			</article>
		</main>
	);
}
