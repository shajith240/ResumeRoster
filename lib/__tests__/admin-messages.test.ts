import { describe, expect, it } from "vitest";
import {
	ADMIN_MESSAGE_BODY_MAX_LENGTH,
	ADMIN_MESSAGE_TITLE_MAX_LENGTH,
	DEFAULT_ADMIN_MESSAGE_LINK,
	normalizeAdminMessageLink,
	validateAdminMessagePayload,
} from "@/lib/admin-messages";

const userId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";

function getPayload(overrides: Record<string, unknown> = {}) {
	return {
		body: "A short update.",
		linkHref: "/feed",
		requestId,
		target: { mode: "user", userId },
		title: "Linted update",
		...overrides,
	};
}

describe("admin message validation", () => {
	it("requires a stable request id", () => {
		expect(validateAdminMessagePayload(getPayload({ requestId: "" })).ok).toBe(
			false,
		);
		expect(
			validateAdminMessagePayload(getPayload({ requestId: "not-a-uuid" })).ok,
		).toBe(false);
	});

	it("rejects empty and long titles", () => {
		expect(validateAdminMessagePayload(getPayload({ title: "   " })).ok).toBe(
			false,
		);
		expect(
			validateAdminMessagePayload(
				getPayload({ title: "x".repeat(ADMIN_MESSAGE_TITLE_MAX_LENGTH + 1) }),
			).ok,
		).toBe(false);
	});

	it("rejects empty and long bodies", () => {
		expect(validateAdminMessagePayload(getPayload({ body: "" })).ok).toBe(
			false,
		);
		expect(
			validateAdminMessagePayload(
				getPayload({ body: "x".repeat(ADMIN_MESSAGE_BODY_MAX_LENGTH + 1) }),
			).ok,
		).toBe(false);
	});

	it("rejects external links and protocol-relative links", () => {
		expect(
			validateAdminMessagePayload(
				getPayload({ linkHref: "https://evil.com/feed" }),
			).ok,
		).toBe(false);
		expect(
			validateAdminMessagePayload(getPayload({ linkHref: "//evil.com" })).ok,
		).toBe(false);
	});

	it("defaults missing or unsafe links to feed for safe notification rendering", () => {
		const missingLink = validateAdminMessagePayload(
			getPayload({ linkHref: undefined }),
		);

		expect(missingLink.ok).toBe(true);
		if (missingLink.ok) {
			expect(missingLink.value.linkHref).toBe(DEFAULT_ADMIN_MESSAGE_LINK);
		}

		expect(normalizeAdminMessageLink("https://evil.com")).toBe(
			DEFAULT_ADMIN_MESSAGE_LINK,
		);
		expect(normalizeAdminMessageLink("//evil.com")).toBe(
			DEFAULT_ADMIN_MESSAGE_LINK,
		);
	});
});
