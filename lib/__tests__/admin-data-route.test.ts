import { GET } from "@/app/api/admin/data/route";
import { requireAdmin } from "@/lib/admin";
import { capturePrivateError } from "@/lib/monitoring/capture-errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin", () => ({
	adminErrorResponse: vi.fn(() =>
		Response.json({ message: "Admin request failed." }, { status: 500 }),
	),
	requireAdmin: vi.fn(),
}));

vi.mock("@/lib/monitoring/capture-errors", () => ({
	capturePrivateError: vi.fn(),
}));

describe("admin data route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("does not expose raw database errors from inventory counts", async () => {
		const rawMessage = 'permission denied for table "moderation_actions"';
		const failedQuery = {
			not: vi.fn(() => failedQuery),
			then: vi.fn((resolve: (
				value: { count: null; error: { message: string } },
			) => unknown) =>
				Promise.resolve({
					count: null,
					error: { message: rawMessage },
				}).then(resolve),
			),
		};
		const select = vi.fn(() => failedQuery);
		const admin = {
			from: vi.fn(() => ({
				select,
			})),
		};

		vi.mocked(requireAdmin).mockResolvedValue({
			admin: admin as never,
			user: {
				email: "owner@example.com",
				id: "22222222-2222-4222-8222-222222222222",
			} as never,
		});

		const response = await GET(
			new Request("https://linted.test/api/admin/data"),
		);

		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toEqual({
			message: "Admin data inventory could not be loaded.",
		});
		expect(capturePrivateError).toHaveBeenCalledWith(
			expect.objectContaining({ message: rawMessage }),
			expect.objectContaining({
				operation: "load_data_inventory",
				route: "GET /api/admin/data",
			}),
		);
	});
});
