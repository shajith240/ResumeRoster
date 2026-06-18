import { describe, expect, it } from "vitest";
import {
	getFeedbackStatusForAction,
	isAdminFeedbackAction,
	isUserFeedbackCategory,
	isUserFeedbackPriority,
	isUserFeedbackStatus,
	USER_FEEDBACK_BODY_MAX_LENGTH,
	USER_FEEDBACK_TITLE_MAX_LENGTH,
	validateUserFeedbackPayload,
} from "@/lib/user-feedback";

describe("user feedback validation", () => {
	it("accepts known feedback enums only", () => {
		expect(isUserFeedbackCategory("bug")).toBe(true);
		expect(isUserFeedbackCategory("billing")).toBe(false);
		expect(isUserFeedbackPriority("urgent")).toBe(true);
		expect(isUserFeedbackPriority("critical")).toBe(false);
		expect(isUserFeedbackStatus("needs_user_reply")).toBe(true);
		expect(isUserFeedbackStatus("waiting")).toBe(false);
	});

	it("maps admin actions to the next ticket status", () => {
		expect(getFeedbackStatusForAction("mark_feedback_reviewing")).toBe(
			"reviewing",
		);
		expect(getFeedbackStatusForAction("mark_feedback_planned")).toBe("planned");
		expect(getFeedbackStatusForAction("mark_feedback_resolved")).toBe(
			"resolved",
		);
		expect(getFeedbackStatusForAction("close_feedback_ticket")).toBe("closed");
		expect(getFeedbackStatusForAction("update_feedback_priority")).toBeNull();
	});

	it("rejects malformed feedback payloads", () => {
		expect(validateUserFeedbackPayload(null).ok).toBe(false);
		expect(
			validateUserFeedbackPayload({
				body: "This is long enough.",
				category: "bug",
				title: "x",
			}).ok,
		).toBe(false);
		expect(
			validateUserFeedbackPayload({
				body: "short",
				category: "bug",
				title: "Bug title",
			}).ok,
		).toBe(false);
	});

	it("normalizes safe payload data before inserting feedback", () => {
		const result = validateUserFeedbackPayload({
			body: `  ${"a".repeat(USER_FEEDBACK_BODY_MAX_LENGTH + 20)}  `,
			category: "made-up",
			metadata: {
				" current page ": "  Admin dashboard  ",
				empty: "   ",
				oversized: "x".repeat(250),
			},
			sourcePath: "https://evil.test/admin",
			title: `  ${"t".repeat(USER_FEEDBACK_TITLE_MAX_LENGTH + 20)}  `,
			viewport: "  390x844  ",
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.value.body).toHaveLength(USER_FEEDBACK_BODY_MAX_LENGTH);
		expect(result.value.category).toBe("other");
		expect(result.value.metadata["current page"]).toBe("Admin dashboard");
		expect(result.value.metadata.oversized).toHaveLength(180);
		expect(result.value.metadata.empty).toBeUndefined();
		expect(result.value.sourcePath).toBe("/");
		expect(result.value.title).toHaveLength(USER_FEEDBACK_TITLE_MAX_LENGTH);
		expect(result.value.viewport).toBe("390x844");
	});

	it("keeps the admin action allow-list explicit", () => {
		expect(isAdminFeedbackAction("reply_feedback_ticket")).toBe(true);
		expect(isAdminFeedbackAction("delete_everything")).toBe(false);
	});
});
