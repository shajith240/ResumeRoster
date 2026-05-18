const featureContent = {
	ats: {
		theme: "ats",
		title: "Anonymous Resume Feed",
		copy:
			"Post your resume without your name, college, phone, or email and let the community roast what recruiters will notice.",
		score: "42",
		scoreLabel: "live roasts",
		insight: "New anonymous resume is trending in the feed",
		panelTitle: "Public Roast Feed",
		good: "Identity hidden",
		warn: "Impact bullets getting roasted",
		listTitle: "Community notes",
		points: [
			"Hide personal details before the resume goes public.",
			"Collect feedback from students, freshers, and people already hired.",
			"Keep the best comments attached to each resume version.",
		],
	},
	jd: {
		theme: "jd",
		title: "Peer Roasts",
		copy:
			"Get comments from people who just survived placements, internships, ATS uploads, and recruiter screens.",
		score: "18",
		scoreLabel: "helpful votes",
		insight: "Top roast points out a missing project outcome",
		panelTitle: "Best Roast",
		good: "Specific fix suggested",
		warn: "Generic summary called out",
		listTitle: "Why it helps",
		points: [
			"Roasts are public, so weak advice gets ignored fast.",
			"Helpful feedback rises through votes instead of authority.",
			"Real applicants explain what worked for them.",
		],
	},
	roast: {
		theme: "roast",
		title: "Vote the Best Feedback",
		copy:
			"Every roast can be voted helpful, so the sharpest comments rise above noise, jokes, and lazy one-liners.",
		score: "7",
		scoreLabel: "top roasts",
		insight: "Most-voted comment explains exactly what to rewrite",
		panelTitle: "Roast Ranking",
		good: "Actionable comment",
		warn: "Low-effort roast buried",
		listTitle: "Voting rules",
		points: [
			"Upvote feedback that names the problem and gives a fix.",
			"Feature roasts that improve the resume, not just insult it.",
			"Let the community decide which feedback deserves attention.",
		],
	},
	skills: {
		theme: "skills",
		title: "Roaster Reputation",
		copy:
			"People who consistently give useful feedback build visible reputation and become trusted resume reviewers.",
		score: "#12",
		scoreLabel: "roaster rank",
		insight: "Placement mentor earned 31 helpful votes this week",
		panelTitle: "Roaster Profile",
		good: "Hired-at proof visible",
		warn: "Unhelpful comments lose reach",
		listTitle: "Reputation signals",
		points: [
			"Reward people whose feedback gets marked helpful.",
			"Show badges for placement wins, roles, and strong roast history.",
			"Turn good reviewers into the reason people return.",
		],
	},
	optimize: {
		theme: "optimize",
		title: "Improvement Leaderboard",
		copy:
			"Before-and-after resumes show who improved the most this week, making progress public and addictive.",
		score: "+64%",
		scoreLabel: "improvement",
		insight: "Resume climbed after 9 community fixes",
		panelTitle: "Most Improved",
		good: "Before and after visible",
		warn: "Still needs stronger metrics",
		listTitle: "Leaderboard logic",
		points: [
			"Track resume versions after public feedback.",
			"Highlight the biggest week-over-week improvements.",
			"Make great transformations shareable.",
		],
	},
};

const navbar = document.querySelector(".navbar");
let lastScrollY = window.scrollY;

function updateNavbarVisibility() {
	if (!navbar) return;

	const currentScrollY = window.scrollY;
	const scrollingDown = currentScrollY > lastScrollY;
	const pastHeroStart = currentScrollY > 120;

	navbar.classList.toggle("nav-hidden", scrollingDown && pastHeroStart);
	lastScrollY = currentScrollY;
}

updateNavbarVisibility();
window.addEventListener("scroll", updateNavbarVisibility, { passive: true });

const textTargets = {
	title: document.querySelector("[data-feature-title]"),
	copy: document.querySelector("[data-feature-copy]"),
	score: document.querySelector("[data-feature-score]"),
	scoreLabel: document.querySelector("[data-feature-score-label]"),
	insight: document.querySelector("[data-feature-insight]"),
	panelTitle: document.querySelector("[data-feature-panel-title]"),
	good: document.querySelector("[data-feature-good]"),
	warn: document.querySelector("[data-feature-warn]"),
	listTitle: document.querySelector("[data-feature-list-title]"),
	points: [
		document.querySelector("[data-feature-point-one]"),
		document.querySelector("[data-feature-point-two]"),
		document.querySelector("[data-feature-point-three]"),
	],
};

const showcase = document.querySelector("[data-feature-section]");
const tabs = document.querySelectorAll("[data-feature]");
const benefitImages = {
	students: {
		src: "assets/students.png",
		alt: "Student public resume feedback illustration",
	},
	jobseekers: {
		src: "assets/job_seekers.png",
		alt: "Job seeker community resume feedback illustration",
	},
	switchers: {
		src: "assets/job_seekers.png",
		alt: "Career switcher community resume feedback illustration",
	},
};
const benefitItems = document.querySelectorAll("[data-benefit]");
const benefitImage = document.querySelector("[data-benefit-image]");

function setFeature(featureKey) {
	const feature = featureContent[featureKey];

	if (!feature || !showcase) return;

	showcase.dataset.theme = feature.theme;
	textTargets.title.textContent = feature.title;
	textTargets.copy.textContent = feature.copy;
	textTargets.score.textContent = feature.score;
	textTargets.scoreLabel.textContent = feature.scoreLabel;
	textTargets.insight.textContent = feature.insight;
	textTargets.panelTitle.textContent = feature.panelTitle;
	textTargets.good.textContent = feature.good;
	textTargets.warn.textContent = feature.warn;
	textTargets.listTitle.textContent = feature.listTitle;

	textTargets.points.forEach((point, index) => {
		point.textContent = feature.points[index];
	});

	tabs.forEach((tab) => {
		const isActive = tab.dataset.feature === featureKey;
		tab.classList.toggle("active", isActive);
		tab.setAttribute("aria-selected", String(isActive));
	});
}

tabs.forEach((tab) => {
	tab.addEventListener("click", () => setFeature(tab.dataset.feature));
});

function setBenefit(benefitKey) {
	const benefit = benefitImages[benefitKey];

	if (!benefit) return;

	benefitItems.forEach((item) => {
		const isActive = item.dataset.benefit === benefitKey;
		item.classList.toggle("active", isActive);
		item.querySelector(".benefit-toggle").setAttribute("aria-expanded", String(isActive));
	});

	if (benefitImage) {
		benefitImage.src = benefit.src;
		benefitImage.alt = benefit.alt;
	}
}

benefitItems.forEach((item) => {
	item.querySelector(".benefit-toggle").addEventListener("click", () => {
		setBenefit(item.dataset.benefit);
	});
});

const pinSection = document.querySelector("[data-pin-section]");
const pinTrack = document.querySelector("[data-pin-track]");
const pinHeading = pinSection ? pinSection.querySelector(".sticky-heading") : null;

function isSmallScreen() {
	return typeof window.matchMedia === "function"
		? window.matchMedia("(max-width: 760px)").matches
		: window.innerWidth <= 760;
}

function updatePinnedFeature() {
	if (!pinSection || !pinTrack) {
		return;
	}

	if (isSmallScreen()) {
		pinSection.style.removeProperty("height");
		pinTrack.style.removeProperty("--pin-y");
		if (pinHeading) {
			pinHeading.style.removeProperty("--heading-y");
			pinHeading.style.removeProperty("--heading-opacity");
		}
		return;
	}

	const viewportHeight = window.innerHeight;
	const releaseDistance = Math.max(pinTrack.scrollHeight - viewportHeight * 0.48, 0);

	const rect = pinSection.getBoundingClientRect();
	const scrollable = pinSection.offsetHeight - viewportHeight;
	const progress = Math.min(Math.max(-rect.top / scrollable, 0), 1);
	const headingPhase = 0.18;
	const headingProgress = Math.min(progress / headingPhase, 1);
	const contentProgress = Math.min(Math.max((progress - headingPhase) / (1 - headingPhase), 0), 1);
	const y = -contentProgress * releaseDistance;

	if (pinHeading) {
		pinHeading.style.setProperty("--heading-y", `${-headingProgress * 150}px`);
		pinHeading.style.setProperty("--heading-opacity", String(1 - headingProgress));
	}

	pinTrack.style.setProperty("--pin-y", `${y}px`);
}

updatePinnedFeature();
window.addEventListener("scroll", updatePinnedFeature, { passive: true });
window.addEventListener("resize", updatePinnedFeature);
