export const PROFILE_FIELD_LIMITS = {
	fullName: 64,
	username: 32,
	tagline: 90,
	currentPosition: 64,
	college: 90,
	collegeLocation: 90,
	about: 280,
	skill: 32,
	skills: 12,
};

export const SKILL_OPTIONS = [
	"ATS",
	"Clarity",
	"Communication",
	"Cover Letters",
	"Data Analysis",
	"DSA",
	"Frontend",
	"Git",
	"Interview Prep",
	"Java",
	"JavaScript",
	"Leadership",
	"LinkedIn",
	"Metrics",
	"Node.js",
	"Proofreading",
	"Python",
	"React",
	"Recruiter Screen",
	"Resume Review",
	"SQL",
	"Storytelling",
	"System Design",
	"Tailoring",
	"TypeScript",
	"UX Writing",
	"Web Development",
];

type SkillProfile = {
	current_position?: string | null;
	target_role?: string | null;
};

export function limitText(value: string, limit: number) {
	return value.slice(0, limit);
}

export function normalizeUsername(value: string) {
	return value
		.replace(/^@+/, "")
		.replace(/[^a-zA-Z0-9_-]/g, "")
		.toLowerCase();
}

export function buildUsernameCandidates(username: string) {
	const base = normalizeUsername(username).replace(/[_-]+$/g, "") || "roaster";
	const year = new Date().getFullYear().toString().slice(-2);
	const suffixes = ["24", "240", "dev", "hq", year, "01", "roast"];
	const candidates: string[] = [];

	for (const suffix of suffixes) {
		const stem = base.slice(0, PROFILE_FIELD_LIMITS.username - suffix.length);
		const candidate = `${stem}${suffix}`;
		if (candidate !== username && candidate.length >= 3) {
			candidates.push(candidate);
		}
	}

	for (let suffix = 2; candidates.length < 10 && suffix < 100; suffix += 1) {
		const textSuffix = String(suffix);
		const stem = base.slice(0, PROFILE_FIELD_LIMITS.username - textSuffix.length);
		const candidate = `${stem}${textSuffix}`;
		if (candidate !== username) {
			candidates.push(candidate);
		}
	}

	return Array.from(new Set(candidates)).slice(0, 10);
}

export function usernameTakenMessage(suggestions: string[]) {
	if (!suggestions.length) {
		return "That username is already taken. Try another name.";
	}

	return `That username is already taken. Try ${suggestions
		.map((suggestion) => `@${suggestion}`)
		.join(", ")}.`;
}

export function parseSkills(value: string) {
	const seen = new Set<string>();
	return value
		.split(/[,\n]/)
		.map((skill) => skill.trim())
		.filter(
			(skill) =>
				skill.length >= 2 && skill.length <= PROFILE_FIELD_LIMITS.skill,
		)
		.filter((skill) => {
			const key = skill.toLowerCase();
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		})
		.slice(0, PROFILE_FIELD_LIMITS.skills);
}

export function fallbackSkills(profile: SkillProfile) {
	const roleWords = (profile.current_position ?? profile.target_role ?? "")
		.split(/[\s,/+-]+/)
		.map((word) => word.trim())
		.filter((word) => word.length > 2);

	return Array.from(
		new Set([
			...roleWords,
			"Resume Review",
			"ATS",
			"Clarity",
			"Proof",
			"Recruiter Screen",
		]),
	).slice(0, 8);
}
