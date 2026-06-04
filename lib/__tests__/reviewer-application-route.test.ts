import { POST } from "@/app/api/reviewer-application/route";
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
const APPLICATION_ID = "22222222-2222-4222-8222-222222222222";

function jsonPost(body: unknown) {
	return new Request("https://linted.test/api/reviewer-application", {
		body: JSON.stringify(body),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
}

function mockSignedInUser(rpc: ReturnType<typeof vi.fn>) {
	vi.mocked(requireSignedInUser).mockResolvedValue({
		admin: { rpc } as never,
		user: {
			email: "reviewer@example.com",
			id: USER_ID,
		} as never,
	});
}

describe("reviewer application route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(enforceApiRateLimit).mockResolvedValue(null);
	});

	it("submits reviewer applications through the transactional RPC", async () => {
		const rpc = vi.fn(async () => ({
			data: [
				{
					application: {
						id: APPLICATION_ID,
						status: "pending",
					},
					error_code: null,
					ok: true,
				},
			],
			error: null,
		}));
		mockSignedInUser(rpc);

		const response = await POST(
			jsonPost({
				communityRole: "both",
				note: "  I review backend resumes.  ",
				proofUrl: "  https://example.com/proof  ",
				reviewerBio: "  Senior engineer  ",
				reviewerExpertise: ["ignored by current UI contract"],
				reviewerHeadline: "  Backend mentor  ",
				reviewerType: "engineer",
			}),
		);

		expect(response.status).toBe(200);
		expect(enforceApiRateLimit).toHaveBeenCalledWith(
			expect.anything(),
			USER_ID,
			"reviewerApplicationSubmit",
		);
		expect(rpc).toHaveBeenCalledWith("submit_reviewer_application", {
			requested_community_role: "both",
			requested_expertise: [],
			requested_note: "I review backend resumes.",
			requested_proof_url: "https://example.com/proof",
			requested_reviewer_bio: "Senior engineer",
			requested_reviewer_headline: "Backend mentor",
			requested_reviewer_type: "engineer",
			target_user_id: USER_ID,
		});
		await expect(response.json()).resolves.toMatchObject({
			application: {
				id: APPLICATION_ID,
				status: "pending",
			},
			status: "ok",
		});
	});

	it("stops over-quota reviewer applications before the transactional RPC", async () => {
		const rpc = vi.fn();
		mockSignedInUser(rpc);
		vi.mocked(enforceApiRateLimit).mockResolvedValue(
			Response.json(
				{ message: "Too many reviewer applications. Try again later." },
				{ status: 429 },
			),
		);

		const response = await POST(
			jsonPost({
				communityRole: "reviewer",
				note: "",
				proofUrl: "https://example.com/proof",
				reviewerType: "engineer",
			}),
		);

		expect(response.status).toBe(429);
		expect(rpc).not.toHaveBeenCalled();
		await expect(response.json()).resolves.toEqual({
			message: "Too many reviewer applications. Try again later.",
		});
	});

	it("maps expected RPC failures without leaking database details", async () => {
		const rpc = vi.fn(async () => ({
			data: {
				application: null,
				error_code: "profile_not_found",
				ok: false,
			},
			error: null,
		}));
		mockSignedInUser(rpc);

		const response = await POST(
			jsonPost({
				communityRole: "reviewer",
				note: "",
				proofUrl: "https://example.com/proof",
				reviewerType: "designer",
			}),
		);

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({
			message: "Profile not found.",
		});
	});

	it("does not leak raw RPC database errors", async () => {
		const rpc = vi.fn(async () => ({
			data: null,
			error: { message: "duplicate key value violates unique constraint" },
		}));
		mockSignedInUser(rpc);

		const response = await POST(
			jsonPost({
				communityRole: "reviewer",
				note: "",
				proofUrl: "https://example.com/proof",
				reviewerType: "recruiter",
			}),
		);

		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toEqual({
			message: "Reviewer application failed. No changes were saved.",
		});
	});

	it("rejects invalid payloads before calling the RPC", async () => {
		const rpc = vi.fn();
		mockSignedInUser(rpc);

		const response = await POST(
			jsonPost({
				communityRole: "candidate",
				note: "",
				proofUrl: "https://example.com/proof",
				reviewerType: "engineer",
			}),
		);

		expect(response.status).toBe(400);
		expect(rpc).not.toHaveBeenCalled();
		await expect(response.json()).resolves.toEqual({
			message: "Choose Review resumes or Both before applying.",
		});
	});
});
