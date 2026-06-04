const ANONYMOUS_ADJECTIVES = [
	"bright",
	"calm",
	"clear",
	"steady",
	"kind",
	"keen",
	"wise",
	"bold",
	"brave",
	"fresh",
	"sharp",
	"warm",
	"true",
	"fair",
	"neat",
	"smart",
	"lucid",
	"solid",
	"quick",
	"mellow",
	"curious",
	"patient",
	"honest",
	"gentle",
	"nimble",
	"crafty",
	"golden",
	"sunny",
	"careful",
	"focused",
	"helpful",
	"tidy",
] as const;

const ANONYMOUS_NOUNS = [
	"mentor",
	"editor",
	"guide",
	"scout",
	"builder",
	"reader",
	"coach",
	"scribe",
	"maker",
	"finder",
	"thinker",
	"helper",
	"advisor",
	"analyst",
	"planner",
	"pilot",
	"curator",
	"reviewer",
	"spark",
	"lens",
	"compass",
	"beacon",
	"anchor",
	"path",
	"draft",
	"signal",
	"proof",
	"polish",
	"craft",
	"notebook",
	"margin",
	"brief",
] as const;

const FALLBACK_SEED = "linted-profile";
const GENERATED_USERNAME_MAX_LENGTH = 18;
const LEGACY_GENERATED_USERNAME_PATTERN = /^[a-z]+-[a-z]+-[a-f0-9]{10}$/;

function hashString(value: string) {
	let hash = 0x811c9dc5;

	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}

	return hash >>> 0;
}

function getAnonymousProfileParts(seed?: string | null) {
	const cleanSeed = seed?.trim() || FALLBACK_SEED;
	const firstHash = hashString(`linted:${cleanSeed}`);
	const secondHash = hashString(`profile:${cleanSeed}`);
	const adjective = ANONYMOUS_ADJECTIVES[firstHash % ANONYMOUS_ADJECTIVES.length];
	const noun = ANONYMOUS_NOUNS[secondHash % ANONYMOUS_NOUNS.length];

	return { adjective, noun };
}

function titleCase(value: string) {
	return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

export function getAnonymousProfileUsername(seed?: string | null) {
	const { adjective, noun } = getAnonymousProfileParts(seed);
	return `${adjective}${noun}`.slice(0, GENERATED_USERNAME_MAX_LENGTH);
}

export function getAnonymousProfileDisplayName(seed?: string | null) {
	const { adjective, noun } = getAnonymousProfileParts(seed);
	return `${titleCase(adjective)} ${titleCase(noun)}`;
}

export function isGeneratedAnonymousUsername(
	username?: string | null,
	seed?: string | null,
) {
	const normalized = username?.trim().replace(/^@+/, "").toLowerCase();
	if (!normalized) return false;

	return (
		normalized === getAnonymousProfileUsername(seed) ||
		LEGACY_GENERATED_USERNAME_PATTERN.test(normalized)
	);
}
