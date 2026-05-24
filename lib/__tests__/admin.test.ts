import { describe, expect, it } from "vitest";
import { isAdminEmail, parseAdminEmails } from "@/lib/admin";

describe("admin allowlist helpers", () => {
	it("normalizes comma-separated admin emails", () => {
		expect(parseAdminEmails(" OWNER@SITE.COM, admin@example.com ,, ")).toEqual(
			new Set(["owner@site.com", "admin@example.com"]),
		);
	});

	it("matches admin emails case-insensitively", () => {
		expect(isAdminEmail("Owner@Site.com", "owner@site.com")).toBe(true);
		expect(isAdminEmail("member@site.com", "owner@site.com")).toBe(false);
		expect(isAdminEmail(null, "owner@site.com")).toBe(false);
	});
});
