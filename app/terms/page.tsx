import Link from "next/link";

export const metadata = {
	title: "Terms of Service - Linted",
	description:
		"The rules for using Linted, including accounts, resume uploads, reviews, lint points, and moderation.",
};

const lastUpdated = "May 30, 2026";
const websiteUrl = "https://linted-space.vercel.app";
const contactEmail = "shajith240@gmail.com";

function Section({
	children,
	title,
}: {
	children: React.ReactNode;
	title: string;
}) {
	return (
		<section>
			<h2>{title}</h2>
			{children}
		</section>
	);
}

export default function TermsOfServicePage() {
	return (
		<main className="legal-page">
			<article className="legal-document">
				<Link className="legal-back-link" href="/">
					Linted
				</Link>
				<header className="legal-hero">
					<p>Legal</p>
					<h1>Terms of Service</h1>
					<span>
						Last updated: {lastUpdated} | Applies to Linted at{" "}
						<a href={websiteUrl}>{websiteUrl}</a>
					</span>
				</header>

				<section className="legal-notice">
					<p>
						These Terms explain the rules for using Linted. Linted is a resume
						review community, not a hiring agency, employer, recruiter, legal
						adviser, or guaranteed job-placement service.
					</p>
				</section>

				<Section title="1. Agreement to These Terms">
					<p>
						These Terms of Service (&quot;Terms&quot;) are an agreement between
						you and Bathina Shajith, operating as Linted (&quot;Linted,&quot;
						&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). By accessing
						or using Linted, you agree to these Terms and our{" "}
						<Link href="/privacy">Privacy Policy</Link>.
					</p>
					<p>
						If you do not agree to these Terms, do not use the Service. If you
						use Linted on behalf of an organization, you confirm that you have
						authority to bind that organization.
					</p>
				</Section>

				<Section title="2. Who May Use Linted">
					<p>
						You must be at least 13 years old to use Linted. If you are under
						the age of majority where you live, you may use Linted only with
						permission from a parent or guardian.
					</p>
					<p>
						You may not use Linted if you are legally prohibited from using the
						Service or if we previously suspended or terminated your account for
						serious or repeated violations.
					</p>
				</Section>

				<Section title="3. Accounts and Security">
					<ul>
						<li>Provide accurate account information and keep it updated.</li>
						<li>Keep your password and sign-in methods secure.</li>
						<li>Do not share, sell, or transfer your account without permission.</li>
						<li>
							Notify us at <a href={`mailto:${contactEmail}`}>{contactEmail}</a>{" "}
							if you believe your account was compromised.
						</li>
					</ul>
					<p>
						You are responsible for activity under your account unless the
						activity happened because of our failure to use reasonable security
						measures.
					</p>
				</Section>

				<Section title="4. What Linted Provides">
					<p>
						Linted lets users upload resumes, choose privacy modes, request or
						provide feedback, post reviews and replies, build public reviewer
						profiles, earn helpful votes called lint points, and appear on
						leaderboards or directories based on community activity.
					</p>
					<p>
						Linted does not guarantee that a resume will pass an applicant
						tracking system, receive interviews, receive job offers, improve
						hiring outcomes, or satisfy any employer, recruiter, school, or
						government requirement.
					</p>
				</Section>

				<Section title="5. Your Content">
					<p>
						&quot;Your Content&quot; means resumes, profile details, usernames,
						avatars, reviews, replies, comments, images, reports, feedback, and
						other materials you submit, upload, or post through Linted.
					</p>
					<p>
						You keep ownership of Your Content. By submitting Your Content, you
						grant Linted a worldwide, non-exclusive, royalty-free license to
						host, store, copy, process, display, publish, transmit, modify for
						formatting or safety, and otherwise use Your Content as needed to
						operate, improve, secure, moderate, and promote the Service.
					</p>
					<p>
						This license ends when Your Content is deleted from active systems,
						except where continued use is reasonably necessary for backups,
						security, legal compliance, moderation records, thread integrity, or
						content already shared or displayed to others.
					</p>
				</Section>

				<Section title="6. Resume Uploads and Privacy Choices">
					<p>
						Resumes may contain personal information. You are responsible for
						reviewing files before upload and removing information you do not
						want others to see.
					</p>
					<ul>
						<li>
							If you choose a public resume setting, your resume or resume
							metadata may be visible to others.
						</li>
						<li>
							If you choose an anonymous or contact-hidden mode, we will use
							that setting to limit what the product displays, but you should
							still remove sensitive details from the file itself.
						</li>
						<li>
							Do not upload resumes that contain another person&apos;s personal
							information unless you have permission.
						</li>
					</ul>
				</Section>

				<Section title="7. Reviews, Lint Points, and Leaderboards">
					<p>
						Linted uses community feedback signals, including helpful votes, lint
						points, public review activity, reviewer profiles, and leaderboards.
						Lint points represent helpful votes from other users; they are not
						money, property, rewards, or transferable value.
					</p>
					<p>
						You may not manipulate lint points or rankings through fake accounts,
						coordinated voting, self-voting, paid voting, bots, spam, harassment,
						or other artificial behavior. We may remove votes, hide rankings,
						reduce visibility, suspend accounts, or take other action when we
						believe integrity rules were violated.
					</p>
				</Section>

				<Section title="8. Acceptable Use">
					<p>You agree not to:</p>
					<ul>
						<li>harass, threaten, shame, dox, or abuse other users;</li>
						<li>post hateful, sexual, exploitative, violent, or illegal content;</li>
						<li>upload malware, phishing content, spam, or deceptive material;</li>
						<li>impersonate another person, company, school, or recruiter;</li>
						<li>post fake reviews, fake credentials, or misleading reviewer claims;</li>
						<li>copy, scrape, or harvest user data without permission;</li>
						<li>try to bypass security, rate limits, access controls, or moderation;</li>
						<li>
							use Linted to make hiring, credit, insurance, housing, or other
							high-impact decisions about another person;
						</li>
						<li>violate applicable law or another person&apos;s rights.</li>
					</ul>
				</Section>

				<Section title="9. Moderation and Enforcement">
					<p>
						We may review, remove, hide, restrict, or preserve content if we
						believe it violates these Terms, our policies, the law, or the safety
						of the community. We may also suspend or terminate accounts, limit
						features, remove lint points, reject trust applications, or report
						serious issues to appropriate authorities.
					</p>
					<p>
						We may make mistakes. If you believe a moderation action was wrong,
						contact us at <a href={`mailto:${contactEmail}`}>{contactEmail}</a>{" "}
						with relevant details.
					</p>
				</Section>

				<Section title="10. Reviewer Profiles and Trust Labels">
					<p>
						Users may create reviewer profiles and describe their experience.
						You must not make false claims about employment, recruiting status,
						education, credentials, or professional qualifications.
					</p>
					<p>
						A trust label or reviewer status means only that Linted has reviewed
						certain submitted information. It is not a professional license, job
						recommendation, endorsement, guarantee, or background check.
					</p>
				</Section>

				<Section title="11. Copyright and Intellectual Property">
					<p>
						Do not upload or post content that infringes copyrights, trademarks,
						or other intellectual property rights. If you believe content on
						Linted infringes your rights, use our{" "}
						<Link href="/copyright">Copyright and Takedown Policy</Link> or
						contact us at{" "}
						<a href={`mailto:${contactEmail}`}>{contactEmail}</a> with enough
						information for us to identify the content and review the claim.
					</p>
					<p>
						Linted&apos;s name, branding, interface, design, code, and product
						features belong to Linted or its licensors. These Terms do not grant
						you ownership of Linted&apos;s intellectual property.
					</p>
				</Section>

				<Section title="12. Third-Party Services">
					<p>
						Linted may rely on third-party services for hosting, storage,
						authentication, email, analytics, error monitoring, and other
						operations. Your use of connected services, such as Google or GitHub
						login, may also be governed by those providers&apos; terms and
						privacy policies.
					</p>
				</Section>

				<Section title="13. Communications">
					<p>
						We may send transactional or relationship messages about your
						account, security, resume activity, reviews, policy updates, or
						changes to the Service. If we send marketing emails, we will provide
						a way to opt out where required by law.
					</p>
				</Section>

				<Section title="14. Feedback">
					<p>
						If you send ideas, suggestions, bug reports, or product feedback, you
						allow us to use them without restriction or compensation. This does
						not transfer ownership of your private resume content.
					</p>
				</Section>

				<Section title="15. Service Changes and Availability">
					<p>
						Linted is an evolving product. We may add, change, suspend, or remove
						features at any time. We may also limit access for maintenance,
						security, legal, operational, or abuse-prevention reasons.
					</p>
					<p>
						We try to keep the Service reliable, but we do not guarantee that it
						will be uninterrupted, error-free, secure, or available at all times.
					</p>
				</Section>

				<Section title="16. Disclaimers">
					<p>
						The Service is provided &quot;as is&quot; and &quot;as
						available&quot; to the fullest extent permitted by law. Linted does
						not provide professional recruiting, legal, immigration, financial,
						or employment advice.
					</p>
					<p>
						Reviews and feedback are user opinions. You are responsible for
						deciding whether and how to use feedback you receive.
					</p>
				</Section>

				<Section title="17. Limitation of Liability">
					<p>
						To the fullest extent permitted by law, Linted and its operator will
						not be liable for indirect, incidental, special, consequential,
						exemplary, or punitive damages, or for lost profits, lost data, lost
						opportunities, hiring outcomes, or reputational harm arising from
						your use of the Service.
					</p>
					<p>
						To the fullest extent permitted by law, our total liability for any
						claim related to the Service will not exceed the greater of the
						amount you paid to Linted in the three months before the claim or INR
						1,000.
					</p>
				</Section>

				<Section title="18. Indemnity">
					<p>
						To the extent permitted by law, you agree to defend and hold harmless
						Linted and its operator from claims, damages, liabilities, and
						expenses arising from Your Content, your use of the Service, your
						violation of these Terms, or your violation of another person&apos;s
						rights.
					</p>
				</Section>

				<Section title="19. Termination">
					<p>
						You may stop using Linted at any time. We may suspend or terminate
						your access if we believe you violated these Terms, created risk or
						legal exposure, abused the Service, or used the Service in a way that
						could harm users or Linted.
					</p>
					<p>
						Sections that by nature should survive termination, including content
						licenses, moderation records, disclaimers, limits of liability, and
						dispute provisions, will survive.
					</p>
				</Section>

				<Section title="20. Governing Law">
					<p>
						Unless applicable law requires otherwise, these Terms are governed by
						the laws of India, without regard to conflict of law principles. If
						you operate Linted from another jurisdiction in the future, this
						section should be updated before publishing.
					</p>
				</Section>

				<Section title="21. Changes to These Terms">
					<p>
						We may update these Terms from time to time. If changes are material,
						we will provide notice through the Service, by email, or by other
						reasonable means. Continued use of Linted after updated Terms become
						effective means you accept the updated Terms.
					</p>
				</Section>

				<Section title="22. Contact">
					<p>
						Questions about these Terms can be sent to{" "}
						<a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
					</p>
					<ul>
						<li>Website: <a href={websiteUrl}>{websiteUrl}</a></li>
						<li>Operator: Bathina Shajith, operating as Linted</li>
						<li>
							Mailing address: Not publicly listed. Please contact us by email
							for legal or policy notices.
						</li>
					</ul>
				</Section>

				<section className="legal-disclaimer">
					<p>
						These Terms are a practical operating draft for Linted. They are not
						legal advice. Before relying on them for a public launch, confirm
						that they match the actual product and have them reviewed by a
						qualified lawyer when possible.
					</p>
				</section>
			</article>
		</main>
	);
}
