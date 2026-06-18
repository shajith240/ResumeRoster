import { describe, expect, it } from "vitest";
import {
	AUTH_SESSION_EXPIRED_MESSAGE,
	getSafeAuthErrorMessage,
	isAuthSessionError,
} from "@/lib/auth-errors";

describe("auth-errors", () => {
	it("recognizes expired or unverifiable JWT messages as session errors", () => {
		expect(isAuthSessionError({ message: "JWT expired" })).toBe(true);
		expect(
			isAuthSessionError({
				message: "Failed to fetch permissions: JWT failed verification.",
			}),
		).toBe(true);
	});

	it("does not mask unrelated errors", () => {
		expect(isAuthSessionError({ message: "Network request failed" })).toBe(
			false,
		);
		expect(getSafeAuthErrorMessage({ message: "Network request failed" })).toBe(
			"Network request failed",
		);
	});

	it("hides raw auth-token details from users", () => {
		expect(getSafeAuthErrorMessage({ message: "JWT expired" })).toBe(
			AUTH_SESSION_EXPIRED_MESSAGE,
		);
	});
});
