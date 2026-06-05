export type FeatureKey = "ats" | "jd" | "roast" | "skills" | "optimize";
export type BenefitKey = "students" | "jobseekers" | "switchers";
export type FooterLink = {
	href: string;
	label: string;
};

export const asset = (path: string) => `/assets/${path}`;
export const ratingStars = [0, 1, 2, 3, 4];

export const footerGroups: Array<{ title: string; links: FooterLink[] }> = [
	{
		title: "Product",
		links: [
			{ label: "Our Mission", href: "/" },
			{ label: "Lint Feed", href: "/feed" },
			{ label: "Leaderboard", href: "/leaderboard" },
		],
	},
	{
		title: "Community",
		links: [
			{ label: "Top Reviewers", href: "/leaderboard" },
			{ label: "Invite Reviewers", href: "/submit" },
			{ label: "Community Guidelines", href: "/guidelines" },
		],
	},
	{
		title: "Legal",
		links: [
			{ label: "Privacy Policy", href: "/privacy" },
			{ label: "Terms of Service", href: "/terms" },
			{ label: "Copyright Policy", href: "/copyright" },
			{ label: "Cookie Notice", href: "/privacy" },
			{ label: "Contact Us", href: "mailto:shajith240@gmail.com" },
		],
	},
];

export const featureContent: Record<
	FeatureKey,
	{
		copy: string;
		good: string;
		insight: string;
		listTitle: string;
		panelTitle: string;
		points: string[];
		score: string;
		scoreLabel: string;
		theme: string;
		title: string;
		warn: string;
	}
> = {
	ats: {
		copy:
			"Post a resume without exposing personal details and let reviewers catch the bugs recruiters will reject.",
		good: "Identity hidden",
		insight: "New resume failed the clarity check",
		listTitle: "Static checks",
		panelTitle: "Career Lint Report",
		points: [
			"Hide personal details before the resume goes public.",
			"Flag vague bullets, weak proof, and recruiter red flags.",
			"Keep the best fixes attached to each resume version.",
		],
		score: "42",
		scoreLabel: "lint passes",
		theme: "ats",
		title: "Anonymous Resume Lint",
		warn: "Impact bug found",
	},
	jd: {
		copy:
			"Recruiters behave like strict compilers. Linted lets peers, recruiters, and engineers catch errors before the first screen.",
		good: "Specific fix suggested",
		insight: "Top check points out a missing project outcome",
		listTitle: "Why it helps",
		panelTitle: "Best Fix",
		points: [
			"Feedback is public, so weak advice gets ignored fast.",
			"Helpful feedback rises through votes instead of authority.",
			"Real applicants explain what worked for them.",
		],
		score: "18",
		scoreLabel: "helpful votes",
		theme: "jd",
		title: "Human Reviewers, Compiler Mindset",
		warn: "Generic summary called out",
	},
	roast: {
		copy:
			"Every comment can be voted helpful, so the sharpest fixes rise above noise, jokes, and lazy one-liners.",
		good: "Actionable comment",
		insight: "Most-voted comment explains exactly what to rewrite",
		listTitle: "Voting rules",
		panelTitle: "Fix Ranking",
		points: [
			"Upvote feedback that names the problem and gives a fix.",
			"Feature comments that improve the resume, not just insult it.",
			"Let the community decide which feedback deserves attention.",
		],
		score: "7",
		scoreLabel: "top fixes",
		theme: "roast",
		title: "Vote the Sharpest Fixes",
		warn: "Low-effort take buried",
	},
	skills: {
		copy:
			"People who consistently give useful lint passes build visible reputation and become trusted resume reviewers.",
		good: "Hired-at proof visible",
		insight: "Placement mentor earned 31 helpful votes this week",
		listTitle: "Reputation signals",
		panelTitle: "Reviewer Profile",
		points: [
			"Reward people whose feedback gets marked helpful.",
			"Show reviewer roles and strong feedback history.",
			"Turn good reviewers into the reason people return.",
		],
		score: "#12",
		scoreLabel: "reviewer rank",
		theme: "skills",
		title: "Reviewer Reputation",
		warn: "Unhelpful comments lose reach",
	},
	optimize: {
		copy:
			"Before-and-after resumes show who cleaned up the most career bugs this week, making progress visible and easy to follow.",
		good: "Before and after visible",
		insight: "Resume climbed after 9 community fixes",
		listTitle: "Leaderboard logic",
		panelTitle: "Most Improved",
		points: [
			"Track resume versions after public feedback.",
			"Highlight the biggest week-over-week improvements.",
			"Make great transformations shareable.",
		],
		score: "+64%",
		scoreLabel: "improvement",
		theme: "optimize",
		title: "Career Lint Score",
		warn: "Still needs stronger metrics",
	},
};

export const featureTabs: Array<{
	key: FeatureKey;
	label: string;
	mobileLabel: string;
}> = [
	{ key: "ats", label: "Resume Lint", mobileLabel: "Post" },
	{ key: "jd", label: "Reviewer Checks", mobileLabel: "Check" },
	{ key: "roast", label: "Useful Fixes", mobileLabel: "Vote" },
	{ key: "skills", label: "Reviewer Trust", mobileLabel: "Trust" },
	{ key: "optimize", label: "Improvement", mobileLabel: "Improve" },
];

export const trustSignals = [
	"Anonymous by default",
	"Identity redaction",
	"Human resume feedback",
	"Useful fixes rise",
	"Community guidelines",
	"No fake resume score",
	"Built for public critique",
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
		copy: "Run your resume through the crowd before placement season treats it like a compile step.",
		key: "students",
		label: "For students",
	},
	{
		copy: "Catch unclear proof, weak metrics, and JD mismatch before recruiter screens.",
		key: "jobseekers",
		label: "For job seekers",
	},
	{
		copy: "Make your career story parse cleanly before a stranger has to infer it.",
		key: "switchers",
		label: "For career switchers",
	},
];

export const stackCards = [
	{
		className: "notes-card",
		copy: "Remove personal details when needed and post your resume to the public lint feed.",
		image: "Resume_upload.png",
		title: "Upload the Source",
	},
	{
		className: "chat-card",
		copy: "Your resume appears beside other submissions waiting for precise feedback.",
		image: "JD match.png",
		title: "Run the Lint Pass",
	},
	{
		className: "recorder-card",
		copy: "Reviewers call out weak, generic, or confusing parts before they reach the first screen.",
		image: "Recruter_roast.png",
		title: "Catch Recruiter Errors",
	},
	{
		className: "tutorials-card",
		copy: "The strongest comments rise through votes so you know which fixes matter.",
		image: "fix_plan.png",
		title: "Apply Useful Fixes",
	},
	{
		className: "tools-card",
		copy: "Improved resumes and trusted reviewers get featured every week.",
		image: "ats.png",
		title: "Build Reviewer Trust",
	},
];
