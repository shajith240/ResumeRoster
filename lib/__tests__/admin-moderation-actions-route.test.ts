import { POST as postReportAction } from "@/app/api/admin/reports/[id]/action/route";
import { POST as postReviewerAction } from "@/app/api/admin/reviewers/[id]/action/route";
import { requireAdmin } from "@/lib/admin";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin", () => ({
	adminErrorResponse: vi.fn(() =>
		Response.json({ message: "Admin request failed." }, { status: 500 }),
	),
	requireAdmin: vi.fn(),
}));

const ADMIN_USER_ID = "22222222-2222-4222-8222-222222222222";
const APPLICATION_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "33333333-3333-4333-8333-333333333333";

function jsonPost(body: unknown) {
	return new Request("https://linted.test/api/admin/action", {
		body: JSON.stringify(body),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
}

function mockAdmin(rpc: ReturnType<typeof vi.fn>) {
	vi.mocked(requireAdmin).mockResolvedValue({
		admin: { rpc } as never,
		user: {
			email: "owner@example.com",
			id: ADMIN_USER_ID,
		} as never,
	});
}

describe("admin moderation action routes", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("sends reviewer decisions through the transactional reviewer RPC", async () => {
		const rpc = vi.fn(async () => ({
			data: [
				{
					application: {
						id: APPLICATION_ID,
						status: "approved",
					},
					error_code: null,
					ok: true,
				},
			],
			error: null,
		}));
		mockAdmin(rpc);

		const response = await postReviewerAction(
			jsonPost({
				action: "approve_reviewer",
				adminNote: "  Verified proof.  ",
			}),
			{ params: Promise.resolve({ id: APPLICATION_ID }) },
		);

		expect(response.status).toBe(200);
		expect(rpc).toHaveBeenCalledWith("admin_review_reviewer_application", {
			reviewer_action: "approve_reviewer",
			reviewer_admin_note: "Verified proof.",
			reviewing_admin_user_id: ADMIN_USER_ID,
			target_application_id: APPLICATION_ID,
		});
		await expect(response.json()).resolves.toMatchObject({
			application: {
				id: APPLICATION_ID,
				status: "approved",
			},
			status: "ok",
		});
	});

	it("does not leak reviewer RPC database errors", async () => {
		const rpc = vi.fn(async () => ({
			data: null,
			error: { message: "duplicate key value violates unique constraint" },
		}));
		mockAdmin(rpc);

		const response = await postReviewerAction(
			jsonPost({ action: "reject_reviewer" }),
			{ params: Promise.resolve({ id: APPLICATION_ID }) },
		);

		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toEqual({
			message: "Reviewer action failed. No changes were saved.",
		});
	});

	it("rejects malformed reviewer ids before calling the database", async () => {
		const rpc = vi.fn();
		mockAdmin(rpc);

		const response = await postReviewerAction(
			jsonPost({ action: "reset_reviewer" }),
			{ params: Promise.resolve({ id: "not-a-uuid" }) },
		);

		expect(response.status).toBe(404);
		expect(rpc).not.toHaveBeenCalled();
		await expect(response.json()).resolves.toEqual({
			message: "Application not found.",
		});
	});

	it("sends report decisions through the transactional report RPC", async () => {
		const rpc = vi.fn(async () => ({
			data: {
				error_code: null,
				ok: true,
				report: {
					id: REPORT_ID,
					status: "actioned",
				},
			},
			error: null,
		}));
		mockAdmin(rpc);

		const response = await postReportAction(
			jsonPost({
				action: "remove_roast",
				note: "  Removed unsafe content.  ",
			}),
			{ params: Promise.resolve({ id: REPORT_ID }) },
		);

		expect(response.status).toBe(200);
		expect(rpc).toHaveBeenCalledWith("admin_apply_report_action", {
			moderation_note: "Removed unsafe content.",
			report_action: "remove_roast",
			reviewing_admin_user_id: ADMIN_USER_ID,
			target_report_id: REPORT_ID,
		});
		await expect(response.json()).resolves.toMatchObject({
			report: {
				id: REPORT_ID,
				status: "actioned",
			},
			status: "ok",
		});
	});

	it("maps expected report RPC failures without exposing database text", async () => {
		const rpc = vi.fn(async () => ({
			data: [
				{
					error_code: "restore_history_missing",
					ok: false,
					report: null,
				},
			],
			error: null,
		}));
		mockAdmin(rpc);

		const response = await postReportAction(
			jsonPost({ action: "restore_roast" }),
			{ params: Promise.resolve({ id: REPORT_ID }) },
		);

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			message: "This review cannot be restored from admin history.",
		});
	});

	it("does not leak report RPC database errors", async () => {
		const rpc = vi.fn(async () => ({
			data: null,
			error: { message: "insert or update on table violates foreign key" },
		}));
		mockAdmin(rpc);

		const response = await postReportAction(
			jsonPost({ action: "dismiss_report" }),
			{ params: Promise.resolve({ id: REPORT_ID }) },
		);

		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toEqual({
			message: "Moderation action failed. No changes were saved.",
		});
	});
});
