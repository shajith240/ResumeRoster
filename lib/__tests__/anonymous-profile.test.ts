import { describe, expect, it } from "vitest";
import {
	getAnonymousProfileDisplayName,
	getAnonymousProfileUsername,
} from "@/lib/anonymous-profile";

describe("anonymous profile handles", () => {
	it("generates stable, meaningful handles without using personal metadata", () => {
		const handle = getAnonymousProfileUsername(
			"00000000-0000-4000-8000-000000000001",
		);

		expect(handle).toMatch(/^[a-z]+-[a-z]+-[a-f0-9]{10}$/);
		expect(handle.length).toBeLessThanOrEqual(32);
		expect(handle).toBe(
			getAnonymousProfileUsername("00000000-0000-4000-8000-000000000001"),
		);
		expect(handle).not.toContain("alex");
		expect(handle).not.toContain("gmail");
	});

	it("uses the anonymous username as the default display name", () => {
		const seed = "00000000-0000-4000-8000-000000000002";

		expect(getAnonymousProfileDisplayName(seed)).toBe(
			getAnonymousProfileUsername(seed),
		);
	});
});
