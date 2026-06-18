import { GET } from "@/app/api/admin/users/route";
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

function createReturnsChain({
	data = [],
	error = null,
}: {
	data?: unknown[];
	error?: { message: string } | null;
} = {}) {
	const chain = {
		gte: vi.fn(() => chain),
		limit: vi.fn(() => chain),
		order: vi.fn(() => chain),
		range: vi.fn(() => chain),
		returns: vi.fn(async () => ({ data, error })),
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

	it("does not expose raw database errors when user listing fails", async () => {
		const rawMessage = 'relation "public.profiles" does not exist';
		const admin = {
			auth: {
				admin: {
					getUserById: vi.fn(),
				},
			},
			from: vi.fn(() =>
				createReturnsChain({
					error: { message: rawMessage },
				}),
			),
			rpc: vi.fn(),
		};

		vi.mocked(requireAdmin).mockResolvedValue({
			admin: admin as never,
			user: {
				email: "owner@example.com",
				id: "22222222-2222-4222-8222-222222222222",
			} as never,
		});

		const response = await GET(
			new Request("https://linted.test/api/admin/users"),
		);

		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toEqual({
			message: "Admin users could not be loaded.",
		});
		expect(capturePrivateError).toHaveBeenCalledWith(
			expect.objectContaining({ message: rawMessage }),
			expect.objectContaining({
				operation: "list_users",
				route: "GET /api/admin/users",
			}),
		);
	});
});
