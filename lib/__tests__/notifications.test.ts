import { describe, expect, it } from "vitest";
import {
	getNotificationHref,
	getNotificationTone,
	unreadNotificationCount,
} from "@/lib/notifications";
import { getAppHomeRoute } from "@/lib/app-routes";

describe("notifications", () => {
	it("keeps notification links inside the app", () => {
		expect(getNotificationHref({ link_href: "/resume/123#comment-456" })).toBe(
			"/resume/123#comment-456",
		);
		expect(getNotificationHref({ link_href: "https://example.com" })).toBe(
			getAppHomeRoute(),
		);
		expect(getNotificationHref({ link_href: "//example.com" })).toBe(
			getAppHomeRoute(),
		);
	});

	it("maps notification types to stable UI tones", () => {
		expect(getNotificationTone("comment_reply")).toBe("feedback");
		expect(getNotificationTone("helpful_vote")).toBe("helpful");
		expect(getNotificationTone("reviewer_status")).toBe("trust");
		expect(getNotificationTone("moderation")).toBe("moderation");
	});

	it("counts unread rows from loaded notifications", () => {
		expect(
			unreadNotificationCount([
				{ read_at: null },
				{ read_at: "2026-05-29T10:00:00.000Z" },
				{ read_at: null },
			]),
		).toBe(2);
	});
});
