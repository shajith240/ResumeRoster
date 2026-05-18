const featureContent = {
	ats: {
		theme: "ats",
		title: "ATS Analysis",
		copy:
			"Check whether your resume can be parsed, searched, and ranked against the job before you apply.",
		score: "78%",
		scoreLabel: "ATS readiness",
		insight: "Missing role keywords and weak sections detected",
		panelTitle: "Resume Roast",
		good: "Project impact is visible",
		warn: "Too many vague bullets",
		listTitle: "Recruiter notes",
		points: [
			"Show the keywords the JD is actually asking for.",
			"Flag bullets that sound like responsibilities, not proof.",
			"Prioritize fixes before you apply.",
		],
	},
	jd: {
		theme: "jd",
		title: "JD Matching",
		copy:
			"Paste the JD and compare it with your resume so you can stop guessing what the company wants.",
		score: "91%",
		scoreLabel: "role match",
		insight: "12 important JD signals are missing or weak",
		panelTitle: "JD fit map",
		good: "Relevant project found",
		warn: "Required skill has no proof",
		listTitle: "Matching notes",
		points: [
			"Separate must-have requirements from nice-to-haves.",
			"Show where your resume already matches the role.",
			"Point out gaps that could cost you the shortlist.",
		],
	},
	roast: {
		theme: "roast",
		title: "Recruiter Roast",
		copy:
			"Get blunt recruiter-style feedback on why your resume feels generic, unclear, or easy to reject.",
		score: "14",
		scoreLabel: "fixes found",
		insight: "Summary and experience bullets need sharper proof",
		panelTitle: "Roast report",
		good: "Clear internship timeline",
		warn: "Too many vague verbs",
		listTitle: "Roast notes",
		points: [
			"Call out claims that sound impressive but say nothing.",
			"Push every bullet toward impact, tools, or scale.",
			"Cut filler before a recruiter does it for you.",
		],
	},
	skills: {
		theme: "skills",
		title: "Skill Gap Detection",
		copy:
			"Find skills the JD expects but your resume does not prove clearly enough.",
		score: "6",
		scoreLabel: "gaps detected",
		insight: "Portfolio proof is missing for two skills",
		panelTitle: "Gap scan",
		good: "SQL appears in projects",
		warn: "No testing framework shown",
		listTitle: "Gap notes",
		points: [
			"Separate real missing proof from keyword stuffing.",
			"Connect skills to projects, internships, or outcomes.",
			"Rank gaps by how much the JD seems to care.",
		],
	},
	optimize: {
		theme: "optimize",
		title: "Resume Optimization",
		copy:
			"Turn the roast into a stronger resume version with clearer bullets, better keywords, and role-ready structure.",
		score: "A-",
		scoreLabel: "draft grade",
		insight: "Readability improved after restructuring",
		panelTitle: "Optimized draft",
		good: "Metrics moved upward",
		warn: "One bullet still too long",
		listTitle: "Optimization notes",
		points: [
			"Move the strongest proof where recruiters scan first.",
			"Rewrite bullets without making them sound fake.",
			"Prepare a version tailored to this exact JD.",
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
		alt: "Student resume guidance illustration",
	},
	jobseekers: {
		src: "assets/job_seekers.png",
		alt: "Job seeker resume matching illustration",
	},
	switchers: {
		src: "assets/job_seekers.png",
		alt: "Career switcher resume guidance illustration",
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
