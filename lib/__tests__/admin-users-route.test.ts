import { GET } from "@/app/api/admin/users/route";
import { requireAdmin } from "@/lib/admin";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin", () => ({
	adminErrorResponse: vi.fn(() =>
		Response.json({ message: "Admin request failed." }, { status: 500 }),
	),
	requireAdmin: vi.fn(),
}));

function createReturnsChain(data: unknown[] = []) {
	const chain = {
		gte: vi.fn(() => chain),
		limit: vi.fn(() => chain),
		order: vi.fn(() => chain),
		returns: vi.fn(async () => ({ data, error: null })),
		select: vi.fn(() => chain),
	};

	return chain;
}

describe("admin users route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("searches through the database RPC without per-user Auth Admin calls", async () => {
		const authGetUserById = vi.fn();
		const rpcReturns = vi.fn(async () => ({
			data: {
				page: 1,
				perPage: 10,
				total: 1,
				users: [
					{
						created_at: "2026-06-01T00:00:00.000Z",
						dataFootprint: {
							attachments: 0,
							reportsFiled: 0,
							resumes: 1,
							reviewerApplications: 0,
							reviews: 0,
							votes: 0,
						},
						email: "alice@example.com",
						id: "11111111-1111-4111-8111-111111111111",
						last_sign_in_at: null,
						profile: {
							created_at: "2026-06-01T00:00:00.000Z",
							full_name: "Alice Admin",
							id: "11111111-1111-4111-8111-111111111111",
							username: "alice",
						},
					},
				],
			},
			error: null,
		}));
		const admin = {
			auth: {
				admin: {
					getUserById: authGetUserById,
				},
			},
			from: vi.fn((table: string) => {
				if (table === "profiles" || table === "app_presence_sessions") {
					return createReturnsChain();
				}
				throw new Error(`Unexpected table ${table}`);
			}),
			rpc: vi.fn(() => ({ returns: rpcReturns })),
		};

		vi.mocked(requireAdmin).mockResolvedValue({
			admin: admin as never,
			user: {
				email: "owner@example.com",
				id: "22222222-2222-4222-8222-222222222222",
			} as never,
		});

		const response = await GET(
			new Request("https://linted.test/api/admin/users?query=alice"),
		);

		expect(response.status).toBe(200);
		expect(admin.rpc).toHaveBeenCalledWith("admin_search_users", {
			page_number: 1,
			page_size: 10,
			search_query: "alice",
		});
		expect(authGetUserById).not.toHaveBeenCalled();
		await expect(response.json()).resolves.toMatchObject({
			pagination: {
				page: 1,
				total: 1,
			},
			users: [
				{
					email: "alice@example.com",
					id: "11111111-1111-4111-8111-111111111111",
				},
			],
		});
	});
});
