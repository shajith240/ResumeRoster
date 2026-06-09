import { POST as postFeedbackAction } from "@/app/api/admin/feedback/[id]/action/route";
import { requireAdmin } from "@/lib/admin";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin", () => ({
	adminErrorResponse: vi.fn((error: unknown) =>
		Response.json(
			{ message: error instanceof Error ? error.message : "Admin failed." },
			{ status: 403 },
		),
	),
	requireAdmin: vi.fn(),
}));

const ADMIN_ID = "22222222-2222-4222-8222-222222222222";
const FEEDBACK_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "33333333-3333-4333-8333-333333333333";

function routeContext(id = FEEDBACK_ID) {
	return {
		params: Promise.resolve({ id }),
	};
}

function jsonRequest(body: Record<string, unknown>) {
	return new Request(`https://linted.test/api/admin/feedback/${FEEDBACK_ID}`, {
		body: JSON.stringify(body),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
}

function mockAdmin(admin: unknown = {}) {
	vi.mocked(requireAdmin).mockResolvedValue({
		admin,
		user: { email: "owner@linted.test", id: ADMIN_ID },
	} as never);
}

function getTicket(overrides: Record<string, unknown> = {}) {
	return {
		admin_note: null,
		admin_reply: null,
		assigned_admin_id: null,
		body: "The app crashed when I opened the feed.",
		category: "bug",
		id: FEEDBACK_ID,
		priority: "normal",
		source_path: "/community",
		status: "new",
		title: "Feed crash",
		user_id: USER_ID,
		...overrides,
	};
}

function getActionAdmin({
	sendResult = {
		data: {
			audit_log_id: "44444444-4444-4444-8444-444444444444",
			delivered_count: 1,
			delivery_status: "completed",
			error_code: null,
			failed_count: 0,
			skipped_count: 0,
			total_recipients: 1,
		},
		error: null,
	},
	ticket = getTicket(),
	updateResult = {
		data: { id: FEEDBACK_ID, status: "reviewing" },
		error: null,
	},
}: {
	sendResult?: unknown;
	ticket?: Record<string, unknown> | null;
	updateResult?: unknown;
} = {}) {
	const maybeSingle = vi.fn(async () => ({ data: ticket, error: null }));
	const ticketEq = vi.fn(() => ({ maybeSingle }));
	const ticketSelect = vi.fn(() => ({ eq: ticketEq }));

	const single = vi.fn(async () => updateResult);
	const updateSelect = vi.fn(() => ({ single }));
	const updateEq = vi.fn(() => ({ select: updateSelect }));
	const update = vi.fn(() => ({ eq: updateEq }));

	const auditInsert = vi.fn(async () => ({ error: null }));
	const rpc = vi.fn(async () => sendResult);
	const from = vi.fn((table: string) => {
		if (table === "user_feedback") {
			return {
				select: ticketSelect,
				update,
			};
		}

		if (table === "moderation_actions") {
			return { insert: auditInsert };
		}

		throw new Error(`Unexpected table ${table}`);
	});

	return {
		admin: { from, rpc },
		auditInsert,
		from,
		maybeSingle,
		rpc,
		update,
		updateEq,
	};
}

describe("admin feedback action route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("rejects malformed feedback ids before database work", async () => {
		mockAdmin();

		const response = await postFeedbackAction(
			jsonRequest({ action: "mark_feedback_reviewing" }),
			routeContext("not-a-uuid"),
		);

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({
			message: "Feedback ticket not found.",
		});
	});

	it("rejects unsupported admin actions before loading the ticket", async () => {
		const setup = getActionAdmin();
		mockAdmin(setup.admin);

		const response = await postFeedbackAction(
			jsonRequest({ action: "delete_feedback_ticket" }),
			routeContext(),
		);

		expect(response.status).toBe(400);
		expect(setup.from).not.toHaveBeenCalled();
	});

	it("requires a valid priority for priority changes", async () => {
		const setup = getActionAdmin();
		mockAdmin(setup.admin);

		const response = await postFeedbackAction(
			jsonRequest({
				action: "update_feedback_priority",
				priority: "critical",
			}),
			routeContext(),
		);

		expect(response.status).toBe(400);
		expect(setup.update).not.toHaveBeenCalled();
		await expect(response.json()).resolves.toEqual({
			message: "Choose a valid priority.",
		});
	});

	it("updates ticket state and writes an audit row for review actions", async () => {
		const setup = getActionAdmin();
		mockAdmin(setup.admin);

		const response = await postFeedbackAction(
			jsonRequest({
				action: "mark_feedback_reviewing",
				note: "  Looking into this.  ",
			}),
			routeContext(),
		);

		expect(response.status).toBe(200);
		expect(setup.update).toHaveBeenCalledWith(
			expect.objectContaining({
				admin_note: "Looking into this.",
				assigned_admin_id: ADMIN_ID,
				status: "reviewing",
			}),
		);
		expect(setup.auditInsert).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "mark_feedback_reviewing",
				admin_user_id: ADMIN_ID,
				reason: "Looking into this.",
				target_id: FEEDBACK_ID,
				target_type: "feedback",
			}),
		);
	});

	it("sends an in-app message before recording an admin reply", async () => {
		const setup = getActionAdmin({
			updateResult: {
				data: { id: FEEDBACK_ID, status: "needs_user_reply" },
				error: null,
			},
		});
		mockAdmin(setup.admin);

		const response = await postFeedbackAction(
			jsonRequest({
				action: "reply_feedback_ticket",
				reply: "Thanks for reporting this. I pushed a fix for review.",
			}),
			routeContext(),
		);

		expect(response.status).toBe(200);
		expect(setup.rpc).toHaveBeenCalledWith("admin_send_message", {
			message_body: "Thanks for reporting this. I pushed a fix for review.",
			message_link_href: "/community",
			message_request_id: expect.any(String),
			message_title: "Reply from Linted",
			sending_admin_email: "owner@linted.test",
			sending_admin_user_id: ADMIN_ID,
			target_mode: "user",
			target_user_id: USER_ID,
		});
		expect(setup.update).toHaveBeenCalledWith(
			expect.objectContaining({
				admin_reply: "Thanks for reporting this. I pushed a fix for review.",
				status: "needs_user_reply",
			}),
		);
	});
});
