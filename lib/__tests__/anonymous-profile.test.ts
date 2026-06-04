import { describe, expect, it } from "vitest";
import {
	getAnonymousProfileDisplayName,
	getAnonymousProfileUsername,
	isGeneratedAnonymousUsername,
} from "@/lib/anonymous-profile";

describe("anonymous profile handles", () => {
	it("generates stable, meaningful handles without using personal metadata", () => {
		const handle = getAnonymousProfileUsername(
			"00000000-0000-4000-8000-000000000001",
		);

		expect(handle).toMatch(/^[a-z]+$/);
		expect(handle).not.toMatch(/[-_0-9]/);
		expect(handle.length).toBeLessThanOrEqual(18);
		expect(handle).toBe(
			getAnonymousProfileUsername("00000000-0000-4000-8000-000000000001"),
		);
		expect(handle).not.toContain("alex");
		expect(handle).not.toContain("gmail");
	});

	it("uses a readable anonymous display name", () => {
		const seed = "00000000-0000-4000-8000-000000000002";

		expect(getAnonymousProfileDisplayName(seed)).toMatch(
			/^[A-Z][a-z]+ [A-Z][a-z]+$/,
		);
	});

	it("recognizes current and legacy generated usernames", () => {
		const seed = "00000000-0000-4000-8000-000000000003";

		expect(isGeneratedAnonymousUsername(getAnonymousProfileUsername(seed), seed)).toBe(
			true,
		);
		expect(isGeneratedAnonymousUsername("sharp-advisor-f24bab3763", seed)).toBe(
			true,
		);
		expect(isGeneratedAnonymousUsername("customhandle", seed)).toBe(false);
	});
});
