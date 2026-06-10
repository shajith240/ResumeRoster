import { describe, expect, it } from "vitest";
import {
	getCommunityCodeLanguageLabel,
	normalizeCommunityCodeLanguage,
} from "@/lib/community-code-languages";

describe("community code language helpers", () => {
	it("normalizes common code fence aliases", () => {
		expect(normalizeCommunityCodeLanguage("js")).toBe("javascript");
		expect(normalizeCommunityCodeLanguage("tsx")).toBe("typescript");
		expect(normalizeCommunityCodeLanguage("c++")).toBe("cpp");
		expect(normalizeCommunityCodeLanguage("py")).toBe("python");
	});

	it("falls back safely for unknown languages", () => {
		expect(normalizeCommunityCodeLanguage("made-up-language")).toBe("auto");
		expect(getCommunityCodeLanguageLabel("made-up-language")).toBe("Auto");
	});
});
