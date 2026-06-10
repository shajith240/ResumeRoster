import { GET, POST } from "@/app/api/mentions/users/route";
import { requireSignedInUser } from "@/lib/server-auth";
import { enforceApiRateLimit } from "@/lib/server/rate-limit";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-auth", () => ({
	requireSignedInUser: vi.fn(),
	serverAuthErrorResponse: vi.fn(() =>
		Response.json({ message: "Request failed." }, { status: 500 }),
	),
}));

vi.mock("@/lib/server/rate-limit", () => ({
	enforceApiRateLimit: vi.fn(),
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";

function mockSignedInUser(rpc: ReturnType<typeof vi.fn>) {
	vi.mocked(requireSignedInUser).mockResolvedValue({
		admin: { rpc } as never,
		user: { id: USER_ID } as never,
	});
}

describe("mention users route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(enforceApiRateLimit).mockResolvedValue(null);
	});

	it("searches mentionable profiles with a bounded indexed RPC", async () => {
		const rpc = vi.fn(async () => ({
			data: [
				{
					avatar_url: "https://cdn.test/alice.png",
					current_position: "Product designer",
					full_name: "Alice Example",
					id: "22222222-2222-4222-8222-222222222222",
					username: "alice",
				},
			],
			error: null,
		}));
		mockSignedInUser(rpc);

		const response = await GET(
			new Request("https://linted.test/api/mentions/users?query=alice&limit=99"),
		);

		expect(response.status).toBe(200);
		expect(enforceApiRateLimit).toHaveBeenCalledWith(
			expect.anything(),
			USER_ID,
			"mentionSearch",
		);
		expect(rpc).toHaveBeenCalledWith("search_mentionable_profiles", {
			excluded_user_id: USER_ID,
			result_limit: 12,
			search_query: "alice",
		});
		await expect(response.json()).resolves.toEqual({
			suggestions: [
				{
					avatarUrl: "https://cdn.test/alice.png",
					displayName: "Alice Example",
					handle: "alice",
					id: "22222222-2222-4222-8222-222222222222",
					subtitle: "Product designer",
				},
			],
		});
	});

	it("looks up exact handles for rendering existing mentions", async () => {
		const rpc = vi.fn(async () => ({
			data: [
				{
					avatar_url: null,
					full_name: "Blake Reviewer",
					id: "33333333-3333-4333-8333-333333333333",
					username: "blake",
				},
			],
			error: null,
		}));
		mockSignedInUser(rpc);

		const response = await POST(
			new Request("https://linted.test/api/mentions/users", {
				body: JSON.stringify({
					handles: ["@Blake", "blake", "not a handle"],
					limit: 10,
				}),
				method: "POST",
			}),
		);

		expect(response.status).toBe(200);
		expect(rpc).toHaveBeenCalledWith("lookup_mentionable_profiles_by_handles", {
			mention_handles: ["Blake", "notahandle"],
			result_limit: 10,
		});
		const body = await response.json();
		expect(body.suggestions[0]).toMatchObject({
			displayName: "Blake Reviewer",
			handle: "blake",
			id: "33333333-3333-4333-8333-333333333333",
		});
	});

	it("stops before search when the user is over quota", async () => {
		const rpc = vi.fn();
		mockSignedInUser(rpc);
		vi.mocked(enforceApiRateLimit).mockResolvedValue(
			Response.json(
				{ message: "Too many user searches. Try again soon." },
				{ status: 429 },
			),
		);

		const response = await GET(
			new Request("https://linted.test/api/mentions/users?query=alice"),
		);

		expect(response.status).toBe(429);
		expect(rpc).not.toHaveBeenCalled();
		await expect(response.json()).resolves.toEqual({
			message: "Too many user searches. Try again soon.",
		});
	});
});
