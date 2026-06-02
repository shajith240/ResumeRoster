const ANONYMOUS_ADJECTIVES = [
	"focused",
	"thoughtful",
	"sharp",
	"steady",
	"curious",
	"practical",
	"candid",
	"helpful",
	"precise",
	"patient",
	"bright",
	"calm",
	"clear",
	"driven",
	"honest",
	"keen",
] as const;

const ANONYMOUS_NOUNS = [
	"reviewer",
	"editor",
	"mentor",
	"analyst",
	"builder",
	"coach",
	"scout",
	"writer",
	"helper",
	"planner",
	"navigator",
	"advisor",
	"strategist",
	"observer",
	"guide",
	"reader",
] as const;

const FALLBACK_SEED = "linted-profile";
const USERNAME_MAX_LENGTH = 32;

function hashString(value: string) {
	let hash = 0x811c9dc5;

	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}

	return hash >>> 0;
}

function suffixFromHash(hash: number) {
	return hash.toString(16).padStart(10, "0").slice(-10);
}

export function getAnonymousProfileUsername(seed?: string | null) {
	const cleanSeed = seed?.trim() || FALLBACK_SEED;
	const firstHash = hashString(`linted:${cleanSeed}`);
	const secondHash = hashString(`profile:${cleanSeed}`);
	const adjective = ANONYMOUS_ADJECTIVES[firstHash % ANONYMOUS_ADJECTIVES.length];
	const noun = ANONYMOUS_NOUNS[secondHash % ANONYMOUS_NOUNS.length];
	const suffix = suffixFromHash(firstHash ^ secondHash);

	return `${adjective}-${noun}-${suffix}`.slice(0, USERNAME_MAX_LENGTH);
}

export function getAnonymousProfileDisplayName(seed?: string | null) {
	return getAnonymousProfileUsername(seed);
}
