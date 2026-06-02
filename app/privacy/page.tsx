import Link from "next/link";
import BrandMark from "@/components/BrandMark";

export const metadata = {
	title: "Privacy Policy - Linted",
	description:
		"How Linted collects, uses, protects, and shares information for resume review features.",
};

const lastUpdated = "May 30, 2026";
const websiteUrl = "https://linted-space.vercel.app";
const contactEmail = "shajith240@gmail.com";

export default function PrivacyPolicyPage() {
	return (
		<main className="legal-page">
			<article className="legal-document">
				<Link className="legal-back-link" href="/">
					<BrandMark />
				</Link>
				<header className="legal-hero">
					<p>Legal</p>
					<h1>Privacy Policy</h1>
					<span>
						Last updated: {lastUpdated} | Applies to Linted at{" "}
						<a href={websiteUrl}>{websiteUrl}</a>
					</span>
				</header>

				<section className="legal-notice">
					<p>
						Linted is a resume review and feedback platform. Because resumes can
						contain personal information, this policy explains what we collect,
						what may become public, how we use information, and how users can
						request access, correction, or deletion.
					</p>
				</section>

				<section>
					<h2>1. Who We Are</h2>
					<p>
						This Privacy Policy describes how Bathina Shajith, operating as
						Linted (&quot;Linted,&quot; &quot;we,&quot; &quot;us,&quot; or
						&quot;our&quot;), collects, uses, discloses, and protects
						information when you use our website, applications, and related
						services.
					</p>
					<p>
						If you have questions or requests about privacy, contact us at{" "}
						<a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
					</p>
				</section>

				<section>
					<h2>2. Information We Collect</h2>
					<p>We collect information in the following categories:</p>
					<ul>
						<li>
							<strong>Account information:</strong> name, email address,
							username, password/authentication metadata, sign-in provider
							details, and account settings.
						</li>
						<li>
							<strong>Profile information:</strong> avatar, tagline, college or
							organization, location, target role, current position, skills,
							reviewer profile details, trust application information, and other
							profile fields you choose to provide.
						</li>
						<li>
							<strong>Resume information:</strong> resume files, resume titles,
							extracted or previewed resume content, resume status, privacy mode,
							upload metadata, and related file information.
						</li>
						<li>
							<strong>Review and community content:</strong> resume reviews,
							replies, comments, reports, moderation notes, helpful votes, lint
							points, leaderboard ranking data, saved resumes, and other
							user-generated content.
						</li>
						<li>
							<strong>Media and attachments:</strong> profile images, comment
							images, or other media you upload through supported features.
						</li>
						<li>
							<strong>Communications:</strong> messages you send to us, support
							requests, feedback, trust application notes, abuse reports, and
							responses to surveys or product communications.
						</li>
						<li>
							<strong>Device, usage, and log information:</strong> IP address,
							browser type, device type, operating system, referring pages, pages
							viewed, actions taken, timestamps, session status, security events,
							diagnostics, and error logs.
						</li>
						<li>
							<strong>Cookies and similar technologies:</strong> information
							stored or read through cookies, local storage, analytics tools,
							authentication tools, or similar technologies.
						</li>
						<li>
							<strong>Third-party login information:</strong> if you sign in
							using Google, GitHub, or another provider, we may receive profile
							and authentication information permitted by that provider and your
							settings.
						</li>
					</ul>
					<p>
						Please do not upload resumes or content containing highly sensitive
						information unless it is necessary for the review you want. Consider
						removing government ID numbers, financial account numbers, health
						information, exact home addresses, and other unnecessary sensitive
						details before uploading.
					</p>
				</section>

				<section>
					<h2>3. Information That May Be Public</h2>
					<p>
						Some parts of Linted are designed to be visible to other users or
						visitors, depending on your settings and the feature used. Public or
						semi-public information may include:
					</p>
					<ul>
						<li>
							your public profile, username, avatar, role, skills, reviewer
							profile, and trust status;
						</li>
						<li>
							public resumes or resume metadata when you choose a public
							visibility setting;
						</li>
						<li>
							reviews, replies, and comments you post on public or shared resume
							threads;
						</li>
						<li>
							helpful votes, lint points, leaderboard ranking, and review
							activity connected to your account;
						</li>
						<li>
							reports or moderation outcomes where disclosure is necessary to
							operate safety features.
						</li>
					</ul>
					<p>
						Do not post content that you do not want others to see. If you choose
						an anonymous or contact-hidden resume mode, we will use that setting
						to limit what is shown in the product, but you are still responsible
						for removing personal details from the file itself if you do not want
						them visible.
					</p>
				</section>

				<section>
					<h2>4. How We Use Information</h2>
					<p>We use information to:</p>
					<ul>
						<li>create, authenticate, secure, and maintain accounts;</li>
						<li>
							provide resume upload, preview, review, reply, profile,
							leaderboard, notification, and community features;
						</li>
						<li>
							display public profiles, public reviews, helpful votes, lint
							points, and leaderboard rankings;
						</li>
						<li>
							personalize the Service and improve product quality, reliability,
							safety, and usability;
						</li>
						<li>
							send transactional messages, service updates, security notices, and
							support responses;
						</li>
						<li>
							review trust applications, moderate content, investigate abuse,
							prevent spam, and enforce our Terms and Community Guidelines;
						</li>
						<li>
							debug errors, monitor performance, detect suspicious activity, and
							protect users and the Service;
						</li>
						<li>
							comply with legal obligations, respond to lawful requests, and
							protect our rights and the rights of others.
						</li>
					</ul>
					<p>
						We do not use uploaded resumes to train public artificial
						intelligence models unless we provide a separate notice and obtain
						consent where required by law.
					</p>
				</section>

				<section>
					<h2>5. How We Share Information</h2>
					<p>We may disclose information in the following situations:</p>
					<ul>
						<li>
							<strong>With other users or visitors:</strong> when information is
							part of a public profile, public resume, public review,
							leaderboard, or other visible product feature.
						</li>
						<li>
							<strong>With service providers:</strong> vendors that provide
							hosting, database, file storage, authentication, email delivery,
							analytics, error monitoring, security, moderation, support, and
							similar services.
						</li>
						<li>
							<strong>With connected services:</strong> when you choose to connect
							or sign in through a third-party provider, subject to that
							provider&apos;s privacy terms.
						</li>
						<li>
							<strong>For safety and moderation:</strong> when needed to
							investigate abuse, spam, security incidents, harmful content,
							impersonation, or policy violations.
						</li>
						<li>
							<strong>For legal reasons:</strong> if we believe disclosure is
							required by law, court order, subpoena, valid government request,
							or to protect rights, safety, and security.
						</li>
						<li>
							<strong>During business changes:</strong> in connection with a
							merger, acquisition, financing, reorganization, bankruptcy, or
							sale of assets, subject to appropriate confidentiality safeguards
							where practical.
						</li>
					</ul>
					<p>
						We do not sell personal information for money. We also do not
						knowingly sell or share personal information of users under 16. If
						we later use advertising or analytics practices that qualify as
						&quot;selling&quot; or &quot;sharing&quot; under applicable privacy
						laws, we will update this policy and provide required choices.
					</p>
				</section>

				<section>
					<h2>6. Service Providers and Subprocessors</h2>
					<p>
						We rely on third-party providers to operate Linted. These may include
						Supabase or similar database and storage providers, hosting
						providers, email providers, error monitoring tools such as Sentry,
						authentication providers such as Google or GitHub, analytics
						providers, and security or moderation tools.
					</p>
					<p>
						We require service providers to process information only for
						authorized purposes and to protect information using appropriate
						safeguards. A current subprocessors list will be made available upon
						request by contacting{" "}
						<a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
					</p>
				</section>

				<section>
					<h2>7. Cookies and Tracking Technologies</h2>
					<p>
						We use cookies, local storage, and similar technologies to keep you
						signed in, remember preferences, secure sessions, measure usage,
						diagnose problems, and improve the Service.
					</p>
					<p>
						You can control cookies through your browser settings. Blocking
						cookies may affect authentication, security, or other core
						functionality. If we use non-essential analytics or marketing cookies
						where consent is required, we will provide appropriate notice and
						choices.
					</p>
				</section>

				<section>
					<h2>8. Data Retention</h2>
					<p>
						We retain personal information for as long as necessary to provide
						the Service, comply with legal obligations, resolve disputes, enforce
						agreements, prevent abuse, and maintain security.
					</p>
					<ul>
						<li>
							<strong>Account and profile data:</strong> retained while your
							account is active, unless you delete it or request deletion.
						</li>
						<li>
							<strong>Resume files:</strong> retained until you delete the
							resume, delete your account, or request deletion, unless retention
							is required for legal, security, backup, or moderation reasons.
						</li>
						<li>
							<strong>Reviews, replies, votes, and leaderboard data:</strong>{" "}
							retained while needed to operate community features, preserve
							thread integrity, prevent abuse, and honor deletion or moderation
							requests where applicable.
						</li>
						<li>
							<strong>Security logs and diagnostic data:</strong> retained for a
							limited period reasonably necessary for security, debugging, fraud
							prevention, and compliance.
						</li>
						<li>
							<strong>Backups:</strong> deleted or overwritten through normal
							backup cycles, unless preservation is required for legal or
							security reasons.
						</li>
					</ul>
					<p>
						When information is no longer needed, we will delete, anonymize, or
						otherwise handle it according to applicable law and our internal
						retention practices.
					</p>
				</section>

				<section>
					<h2>9. Your Privacy Choices and Rights</h2>
					<p>Depending on where you live, you may have rights to:</p>
					<ul>
						<li>access the personal information we hold about you;</li>
						<li>correct inaccurate or incomplete information;</li>
						<li>
							delete your account, resumes, profile information, or certain
							content;
						</li>
						<li>object to or restrict certain processing;</li>
						<li>request a portable copy of certain data;</li>
						<li>withdraw consent where processing is based on consent;</li>
						<li>opt out of marketing emails;</li>
						<li>appeal certain privacy request decisions where applicable.</li>
					</ul>
					<p>
						To make a privacy request, contact us at{" "}
						<a href={`mailto:${contactEmail}`}>{contactEmail}</a>. We may need
						to verify your identity before completing a request. We will respond
						within the timeframe required by applicable law.
					</p>
				</section>

				<section>
					<h2>10. Additional Notice for European Users</h2>
					<p>
						If you are in the European Economic Area, United Kingdom, or
						Switzerland, we process personal data under the following legal
						bases, depending on the context:
					</p>
					<ul>
						<li>
							<strong>Contract:</strong> to provide the Service you requested,
							including accounts, resume uploads, reviews, profiles, and
							notifications.
						</li>
						<li>
							<strong>Legitimate interests:</strong> to secure, improve, monitor,
							moderate, and protect the Service, provided those interests are not
							overridden by your rights.
						</li>
						<li>
							<strong>Consent:</strong> where we ask for consent, such as certain
							cookies, optional communications, or optional features.
						</li>
						<li>
							<strong>Legal obligations:</strong> to comply with applicable laws,
							lawful requests, and recordkeeping obligations.
						</li>
					</ul>
					<p>
						You may have the right to lodge a complaint with your local data
						protection authority. If we transfer personal data internationally, we
						use safeguards required by applicable law, such as contractual
						protections or other recognized transfer mechanisms.
					</p>
				</section>

				<section>
					<h2>11. Additional Notice for California Residents</h2>
					<p>
						If California privacy laws apply to us and to your information, this
						section provides additional information. We may collect the categories
						described in Section 2, including identifiers, internet or network
						activity, user-generated content, professional or education-related
						information you provide, and inferences related to product use.
					</p>
					<p>
						We use and disclose these categories for the purposes described in
						Sections 4 and 5. We do not sell personal information for money. If
						our practices are considered a &quot;sale&quot; or
						&quot;sharing&quot; under California law in the future, we will
						provide required notices and opt-out rights.
					</p>
					<p>
						California residents may have rights to know, access, correct, delete,
						limit certain uses of sensitive personal information, opt out of sale
						or sharing, and not be discriminated against for exercising privacy
						rights. Contact us at{" "}
						<a href={`mailto:${contactEmail}`}>{contactEmail}</a> to exercise
						these rights.
					</p>
				</section>

				<section>
					<h2>12. Children&apos;s Privacy</h2>
					<p>
						Linted is not directed to children under 13, and we do not knowingly
						collect personal information from children under 13. If you are under
						13, do not use the Service. If you are under the age of majority
						where you live, use the Service only with permission from a parent or
						guardian.
					</p>
					<p>
						If we learn that we collected personal information from a child under
						13 without appropriate consent, we will take reasonable steps to
						delete it. Parents or guardians can contact us at{" "}
						<a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
					</p>
				</section>

				<section>
					<h2>13. Data Security</h2>
					<p>
						We use technical and organizational safeguards designed to protect
						personal information, including access controls, authentication
						protections, storage controls, logging, monitoring, and provider
						security measures. We limit access to personal information to people
						and providers who need it for authorized purposes.
					</p>
					<p>
						No internet service can guarantee perfect security. You are
						responsible for keeping your account credentials secure and for
						reviewing resumes before uploading them to avoid sharing unnecessary
						sensitive information.
					</p>
				</section>

				<section>
					<h2>14. Security Incidents</h2>
					<p>
						If we become aware of a security incident involving personal
						information, we will investigate, take reasonable steps to reduce
						harm, and notify affected users or authorities when required by
						applicable law.
					</p>
				</section>

				<section>
					<h2>15. Third-Party Links and Content</h2>
					<p>
						The Service may contain links to third-party websites, portfolios,
						profiles, job posts, or resources. We are not responsible for the
						privacy practices, content, or security of third-party services.
						Review their privacy policies before providing information to them.
					</p>
				</section>

				<section>
					<h2>16. Changes to This Policy</h2>
					<p>
						We may update this Privacy Policy from time to time. If changes are
						material, we will provide notice through the Service, by email, or by
						other reasonable means. The updated policy is effective when posted
						unless a later date is stated.
					</p>
				</section>

				<section>
					<h2>17. Contact Us</h2>
					<p>If you have questions, requests, or concerns, contact us:</p>
					<ul>
						<li>
							Email: <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
						</li>
						<li>
							Website: <a href={websiteUrl}>{websiteUrl}</a>
						</li>
						<li>Operator: Bathina Shajith, operating as Linted</li>
						<li>
							Mailing address: Not publicly listed. Please contact us by email
							for legal or privacy notices.
						</li>
					</ul>
				</section>

				<section className="legal-disclaimer">
					<p>
						This policy is intended to describe Linted&apos;s current privacy
						practices. It is not legal advice. If you believe any part of this
						policy does not match the product, contact us so we can correct it.
					</p>
				</section>
			</article>
		</main>
	);
}
