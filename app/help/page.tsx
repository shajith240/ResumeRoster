import Link from "next/link";
import type { ReactNode } from "react";
import BrandMark from "@/components/BrandMark";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support-contact";
import styles from "./help.module.css";

export const metadata = {
	title: "Help Center - Linted",
	description:
		"Get help with posting resumes, privacy modes, feedback, lint points, saved resumes, reports, and account support on Linted.",
};

const lastUpdated = "June 10, 2026";

type HelpAnswer = {
	answer: ReactNode;
	question: string;
};

type HelpSection = {
	id: string;
	intro: string;
	items: HelpAnswer[];
	title: string;
};

const helpSections: HelpSection[] = [
	{
		id: "getting-started",
		title: "Getting Started",
		intro: "The fastest path is to post one resume, ask for specific feedback, and review other resumes while you wait.",
		items: [
			{
				question: "What should I do first?",
				answer:
					"Post a resume from the submit page, choose the privacy mode that matches your comfort level, then describe the kind of review you want. Specific requests usually get better feedback.",
			},
			{
				question: "Where do I browse resumes?",
				answer: (
					<>
						Use the <Link href="/feed">Resume Feed</Link> for open resume
						reviews and the <Link href="/community">Community</Link> page for
						broader discussion.
					</>
				),
			},
			{
				question: "Can I save resumes for later?",
				answer:
					"Yes. Use the bookmark action on a resume card. Saved resumes live under the Saved filter in the Resume Feed.",
			},
		],
	},
	{
		id: "privacy",
		title: "Privacy and Resume Safety",
		intro: "Resumes can contain personal details, so privacy choices matter before a file goes public.",
		items: [
			{
				question: "Does anonymous mode remove everything from my PDF?",
				answer:
					"No. Anonymous and contact-hidden modes control how Linted displays your post, but you should still remove phone numbers, exact addresses, private emails, IDs, and other sensitive details from the file before upload.",
			},
			{
				question: "What if I uploaded the wrong file?",
				answer:
					"Delete the resume from its detail page if you own it. If something sensitive is already visible and you need help, contact support with the resume link.",
			},
			{
				question: "Can other people see my profile?",
				answer:
					"Public profile details, review activity, lint points, and leaderboard placement can be visible depending on the feature. Avoid adding profile details you do not want public.",
			},
		],
	},
	{
		id: "feedback",
		title: "Feedback, Replies, and Reactions",
		intro: "Linted works best when feedback is specific, useful, and tied to what a recruiter or reviewer will actually notice.",
		items: [
			{
				question: "What counts as useful feedback?",
				answer: (
					<>
						Point to the exact bullet, section, claim, or missing proof. Explain
						why it matters, then suggest a clearer rewrite or next step. The{" "}
						<Link href="/guidelines">Community Guidelines</Link> cover the
						standard in more detail.
					</>
				),
			},
			{
				question: "Why can I not react to some feedback?",
				answer:
					"Resume owners cannot vote on feedback for their own resume, and users cannot react to their own feedback. This keeps lint points cleaner.",
			},
			{
				question: "What happens when a thread is closed?",
				answer:
					"Existing feedback stays visible for learning, but new public feedback is paused until the owner reopens the thread.",
			},
		],
	},
	{
		id: "lint-points",
		title: "Lint Points and Leaderboards",
		intro: "Lint points are reputation signals based on useful community contribution, not money or guaranteed credentials.",
		items: [
			{
				question: "How are lint points calculated?",
				answer:
					"Lint points use the same contribution logic as the leaderboard: helpful feedback matters, and review volume gives context. The profile and leaderboard should show the same total.",
			},
			{
				question: "Why did my rank change?",
				answer:
					"Leaderboards can move when new reviews, helpful votes, deleted content, or moderation changes update the underlying contribution signals.",
			},
			{
				question: "Can lint points be bought or transferred?",
				answer:
					"No. Lint points are not cash, rewards, property, or transferable value. Manipulation can lead to removed points or account limits.",
			},
		],
	},
	{
		id: "account",
		title: "Account and App Issues",
		intro: "Most account issues are session, browser, or upload-state problems that can be narrowed quickly.",
		items: [
			{
				question: "I am being asked to log in again. What should I do?",
				answer:
					"Log in again from the prompt. If it repeats, refresh once, check that cookies are enabled, and contact support with the page URL and what you were trying to do.",
			},
			{
				question: "PDF previews or uploads are not working.",
				answer:
					"Confirm the file is a PDF, keep it within the upload limit shown in the app, and try a fresh export if the file was generated by an unusual editor.",
			},
			{
				question: "How do I install Linted?",
				answer:
					"Use Install Linted in the account menu when your browser supports app installation. Browser support varies by device.",
			},
		],
	},
	{
		id: "safety",
		title: "Safety, Reports, and Support",
		intro: "Report harmful content in-product when possible. Use support email for account, privacy, legal, or stuck-flow issues.",
		items: [
			{
				question: "How do I report abusive or private content?",
				answer:
					"Use the report option on the post, resume, review, or comment when available. Include a short explanation so moderation can review the right issue.",
			},
			{
				question: "When should I email support?",
				answer:
					"Email support for account access problems, sensitive privacy issues, copyright or impersonation concerns, stuck uploads, and bugs that block normal use.",
			},
			{
				question: "What should I include in a support email?",
				answer:
					"Include your account email if relevant, the page URL, a short description, the device/browser, and screenshots only when they do not expose private resume details.",
			},
		],
	},
];

export default function HelpCenterPage() {
	return (
		<main className={styles.page}>
			<div className={styles.shell}>
				<Link className={styles.brandLink} href="/" aria-label="Linted home">
					<BrandMark />
				</Link>

				<header className={styles.hero}>
					<div className={styles.heroCopy}>
						<p className={styles.eyebrow}>Help Center</p>
						<h1>Get unstuck without losing your resume thread.</h1>
						<p>
							Answers for posting resumes, privacy modes, feedback, lint points,
							account issues, reports, and support.
						</p>
						<span>Last updated: {lastUpdated}</span>
					</div>
					<div className={styles.heroActions}>
						<a className={styles.primaryAction} href={SUPPORT_MAILTO}>
							Email support
						</a>
						<Link className={styles.secondaryAction} href="/guidelines">
							Read guidelines
						</Link>
					</div>
				</header>

				<nav className={styles.topicNav} aria-label="Help topics">
					{helpSections.map((section) => (
						<a href={`#${section.id}`} key={section.id}>
							{section.title}
						</a>
					))}
				</nav>

				<section className={styles.supportStrip} aria-label="Support promise">
					<div>
						<strong>Need human help?</strong>
						<p>
							Write to <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a> with the
							page link and a short description. Keep private resume details out
							of screenshots unless support specifically needs them.
						</p>
					</div>
				</section>

				<div className={styles.sections}>
					{helpSections.map((section) => (
						<section className={styles.helpSection} id={section.id} key={section.id}>
							<header>
								<h2>{section.title}</h2>
								<p>{section.intro}</p>
							</header>
							<div className={styles.answerList}>
								{section.items.map((item) => (
									<article className={styles.answer} key={item.question}>
										<h3>{item.question}</h3>
										<p>{item.answer}</p>
									</article>
								))}
							</div>
						</section>
					))}
				</div>

				<section className={styles.contactPanel}>
					<div>
						<p className={styles.eyebrow}>Still stuck?</p>
						<h2>Send the support context once.</h2>
						<p>
							A useful support message includes the route, what you expected,
							what happened, and whether you were on mobile, tablet, or desktop.
						</p>
					</div>
					<a className={styles.primaryAction} href={SUPPORT_MAILTO}>
						{SUPPORT_EMAIL}
					</a>
				</section>
			</div>
		</main>
	);
}
