export type BenefitKey = "students" | "jobseekers" | "switchers";

export const asset = (path: string) => `/assets/${path}`;

export const trustSignals = [
	"Post anonymously",
	"Control your privacy",
	"Guided reviewer prompts",
	"Top fixes ranked by votes",
	"Community guidelines",
	"No AI resume score",
	"Reviewer leaderboard",
];

export const benefitImages: Record<BenefitKey, { alt: string; src: string }> = {
	students: {
		alt: "Student public resume feedback illustration",
		src: asset("students.png"),
	},
	jobseekers: {
		alt: "Job seeker community resume feedback illustration",
		src: asset("job_seekers.png"),
	},
	switchers: {
		alt: "Career switcher community resume feedback illustration",
		src: asset("job_seekers.png"),
	},
};

export const benefits: Array<{ copy: string; key: BenefitKey; label: string }> = [
	{
		copy: "Post before placement season and learn what your resume actually communicates.",
		key: "students",
		label: "For students",
	},
	{
		copy: "Catch vague bullets, weak metrics, and mismatched claims before recruiter screens.",
		key: "jobseekers",
		label: "For job seekers",
	},
	{
		copy: "Make your story easier to understand when your background does not follow a straight line.",
		key: "switchers",
		label: "For career switchers",
	},
];

export const reviewStandards = [
	{
		copy: "The best comments name the exact bullet, section, or claim that needs work.",
		title: "Point to the line",
	},
	{
		copy: "Reviewers explain why a recruiter might skip, doubt, or misunderstand it.",
		title: "Explain the risk",
	},
	{
		copy: "Useful feedback gives a next move, not just a reaction.",
		title: "Suggest the fix",
	},
];

export const productLoopSteps = [
	{
		copy:
			"Choose what to reveal, add role context, and publish when the request is ready.",
		label: "Controlled post",
		title: "Post with context",
	},
	{
		copy:
			"Prompts guide reviewers to name the exact bullet, the weak claim, or the confusing line.",
		label: "Guided review",
		title: "Get specific fixes",
	},
	{
		copy:
			"Votes and rules keep useful comments above vague opinions and lazy takes.",
		label: "Community signal",
		title: "Rank useful fixes",
	},
	{
		copy:
			"Strong reviewers earn visible trust for feedback that helps people improve.",
		label: "Reputation",
		title: "Build reviewer trust",
	},
];

export const comparisonRows = [
	{
		feature: "Best for",
		linted: "Human review before you apply",
		resumeWorded: "Instant AI resume score",
		rezi: "AI resume building and tailoring",
	},
	{
		feature: "Feedback source",
		linted: "Community reviewers with useful votes",
		resumeWorded: "AI criteria and resume examples",
		rezi: "AI writing, scoring, and job-description matching",
	},
	{
		feature: "What you leave with",
		linted: "A ranked fix list tied to your post",
		resumeWorded: "A score report with line-by-line suggestions",
		rezi: "An optimized resume draft",
	},
	{
		feature: "Trust signal",
		linted: "Reviewer history, guidelines, and leaderboard signals",
		resumeWorded: "Private score and recruiter-based checks",
		rezi: "ATS-focused scoring and templates",
	},
	{
		feature: "When it helps most",
		linted: "When another person needs to spot weak proof",
		resumeWorded: "When you need a fast diagnostic scan",
		rezi: "When you need to draft or tailor faster",
	},
	{
		feature: "Product stance",
		linted: "No fake resume score. Feedback earns trust.",
		resumeWorded: "Score-driven resume improvement",
		rezi: "AI-first resume generation",
	},
];

export const faqItems = [
	{
		answer:
			"Linted is a community review layer for resumes. You post a resume with context, reviewers leave specific fixes, and useful feedback rises through votes and trust signals.",
		question: "What is Linted?",
		value: "what-is-linted",
	},
	{
		answer:
			"No. Linted is not trying to replace scanners or builders. AI tools can help you score, draft, or tailor faster. Linted is for the human pass: spotting weak proof, unclear bullets, and confusing storylines before recruiters see them.",
		question: "Is Linted another AI resume checker?",
		value: "ai-checker",
	},
	{
		answer:
			"You control what you post. Linted is designed around safer sharing, context, and community rules. You should still remove anything you do not want public before posting a resume.",
		question: "Is it safe to post my resume?",
		value: "safe-posting",
	},
	{
		answer:
			"Good feedback has to point to the exact line or section, explain the risk, and suggest a next move. Votes, guidelines, and reviewer reputation help push useful fixes above vague opinions.",
		question: "How does Linted keep feedback useful?",
		value: "useful-feedback",
	},
	{
		answer:
			"Use Linted when your resume looks finished but you still want another person to catch what is unclear, generic, or hard to trust. It is especially useful before internships, placement season, job switches, and cold applications.",
		question: "When should I use Linted?",
		value: "when-to-use",
	},
	{
		answer:
			"Post your resume, add role context, read the ranked fixes, and apply the feedback that makes your resume clearer. Helpful reviewers build trust by leaving feedback people can actually use.",
		question: "What happens after I post?",
		value: "after-posting",
	},
];
