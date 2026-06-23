/**
 * Tests for POST /api/resumes/[id]/premium-review
 *
 * The reviewer has already been assigned and a payout will be created here.
 * Wrong access control means a random user submits a review and earns money
 * they're not owed. Deadline bypass means the candidate gets a review after
 * a refund was already issued — they get both the money back AND the review.
 *
 * Guard order checked by these tests:
 *   auth → body parse → payload validation → resume fetch → is_premium check
 *   → reviewer match → status check → deadline check → duplicate check → insert
 */
import { POST } from "@/app/api/resumes/[id]/premium-review/route";
import { capturePrivateError } from "@/lib/monitoring/capture-errors";
import { requireSignedInUser } from "@/lib/server-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/monitoring/capture-errors", () => ({
	capturePrivateError: vi.fn(),
}));

vi.mock("@/lib/server-auth", () => ({
	requireSignedInUser: vi.fn(),
	serverAuthErrorResponse: vi.fn((error: unknown) =>
		Response.json(
			{ message: error instanceof Error ? error.message : "Auth failed." },
			{ status: (error as { status?: number }).status ?? 500 },
		),
	),
}));

vi.mock("@/lib/email/send", () => ({
	getUserEmail: vi.fn(async () => null),
	sendEmail: vi.fn(async () => {}),
}));

vi.mock("@/lib/email/templates", () => ({
	premiumReviewPosted: vi.fn(() => ({ subject: "Review posted", html: "<p>done</p>" })),
}));

const REVIEWER_ID = "55555555-5555-4555-8555-555555555555";
const RESUME_ID = "resume-premium-aaa111";
const RESUME_OWNER_ID = "66666666-6666-4666-8666-666666666666";
const ROAST_ID = "roast-001";

const VALID_PAYLOAD = {
	overallRating: 4,
	overallImpression: "Strong profile with clear progression across roles.",
	clarityFeedback: "Well-structured with good use of bullet points.",
	impactFeedback: "Quantify more achievements — currently only 2 of 8 bullets have numbers.",
	skillsGap: "Missing mention of system design experience for senior roles.",
	topChanges: "1. Add metrics to impact bullets. 2. Add system design section. 3. Fix LinkedIn URL.",
};

function makeRequest(body: unknown) {
	return {
		headers: new Headers({ Authorization: "Bearer test-token" }),
		json: async () => body,
	} as Request;
}

function makeContext(id = RESUME_ID) {
	return { params: Promise.resolve({ id }) };
}

type ResumeRow = {
	id: string;
	is_premium: boolean;
	payment_status: string;
	assigned_reviewer_id: string;
	status: string;
	user_id: string;
	review_deadline: string | null;
};

function mockAdminWithResume(resume: Partial<ResumeRow> | null, extraOptions: {
	existingReview?: boolean;
	roastInsertError?: boolean;
} = {}) {
	const defaultResume: ResumeRow = {
		id: RESUME_ID,
		is_premium: true,
		payment_status: "paid",
		assigned_reviewer_id: REVIEWER_ID,
		status: "open",
		user_id: RESUME_OWNER_ID,
		review_deadline: null,
		...resume,
	};

	const resumeFetch = vi.fn(async () => ({
		data: resume === null ? null : defaultResume,
		error: null,
	}));

	const existingReviewCheck = vi.fn(async () => ({
		data: extraOptions.existingReview ? { id: "existing-review-001", roast_id: "roast-old" } : null,
		error: null,
	}));

	const roastInsert = vi.fn(async () =>
		extraOptions.roastInsertError
			? { data: null, error: { message: "insert failed" } }
			: { data: { id: ROAST_ID }, error: null },
	);

	const admin = {
		from: vi.fn((table: string) => {
			if (table === "resumes") {
				return {
					select: vi.fn(() => ({
						eq: vi.fn(() => ({ maybeSingle: resumeFetch })),
					})),
				};
			}
			if (table === "premium_reviews") {
				return {
					select: vi.fn(() => ({
						eq: vi.fn(() => ({
							eq: vi.fn(() => ({ maybeSingle: existingReviewCheck })),
						})),
					})),
					insert: vi.fn(async () => ({ error: null })),
				};
			}
			if (table === "roasts") {
				return {
					insert: vi.fn(() => ({
						select: vi.fn(() => ({
							single: roastInsert,
						})),
					})),
				};
			}
			if (table === "reviewer_payouts") {
				return { insert: vi.fn(async () => ({ error: null })) };
			}
			return { insert: vi.fn(async () => ({ error: null })) };
		}),
	};

	vi.mocked(requireSignedInUser).mockResolvedValue({
		admin,
		user: { id: REVIEWER_ID, email: "reviewer@example.com" },
	} as never);

	return { admin, resumeFetch, roastInsert };
}

describe("POST /api/resumes/[id]/premium-review", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// ─── Auth ──────────────────────────────────────────────────────────────────

	it("returns 401 when the reviewer is not signed in", async () => {
		const authError = Object.assign(new Error("Sign in to submit a premium review."), {
			status: 401,
		});
		vi.mocked(requireSignedInUser).mockRejectedValue(authError);

		const response = await POST(makeRequest(VALID_PAYLOAD), makeContext());

		expect(response.status).toBe(401);
	});

	// ─── Payload validation ───────────────────────────────────────────────────

	it("returns 400 for a non-object body", async () => {
		mockAdminWithResume({});

		const response = await POST(makeRequest("not an object"), makeContext());

		expect(response.status).toBe(400);
	});

	it("returns 400 when overall rating is 0 (below minimum)", async () => {
		mockAdminWithResume({});

		const response = await POST(
			makeRequest({ ...VALID_PAYLOAD, overallRating: 0 }),
			makeContext(),
		);

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			message: expect.stringContaining("rating"),
		});
	});

	it("returns 400 when overall rating is 6 (above maximum)", async () => {
		mockAdminWithResume({});

		const response = await POST(
			makeRequest({ ...VALID_PAYLOAD, overallRating: 6 }),
			makeContext(),
		);

		expect(response.status).toBe(400);
	});

	it("returns 400 when overall rating is a float", async () => {
		mockAdminWithResume({});

		const response = await POST(
			makeRequest({ ...VALID_PAYLOAD, overallRating: 3.5 }),
			makeContext(),
		);

		expect(response.status).toBe(400);
	});

	it("returns 400 when a required text field is too short", async () => {
		mockAdminWithResume({});

		const response = await POST(
			makeRequest({ ...VALID_PAYLOAD, overallImpression: "Too short" }),
			makeContext(),
		);

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			message: expect.stringContaining("Overall impression"),
		});
	});

	it("returns 400 when a required text field is missing entirely", async () => {
		mockAdminWithResume({});
		const { clarityFeedback: _omit, ...payload } = VALID_PAYLOAD;

		const response = await POST(makeRequest(payload), makeContext());

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			message: expect.stringContaining("Clarity feedback"),
		});
	});

	// ─── Resume access guards ─────────────────────────────────────────────────

	it("returns 404 when the resume does not exist", async () => {
		mockAdminWithResume(null);

		const response = await POST(makeRequest(VALID_PAYLOAD), makeContext());

		expect(response.status).toBe(404);
	});

	it("returns 400 when the resume is not flagged as premium", async () => {
		mockAdminWithResume({ is_premium: false, payment_status: "paid" });

		const response = await POST(makeRequest(VALID_PAYLOAD), makeContext());

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			message: expect.stringContaining("not eligible"),
		});
	});

	it("returns 400 when the premium payment has not been captured yet", async () => {
		mockAdminWithResume({ is_premium: true, payment_status: "pending" });

		const response = await POST(makeRequest(VALID_PAYLOAD), makeContext());

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			message: expect.stringContaining("not eligible"),
		});
	});

	it("returns 403 when a different reviewer tries to submit", async () => {
		mockAdminWithResume({ assigned_reviewer_id: "different-reviewer-id" });

		const response = await POST(makeRequest(VALID_PAYLOAD), makeContext());

		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toMatchObject({
			message: expect.stringContaining("not the assigned reviewer"),
		});
	});

	it("returns 409 when the resume is no longer open for feedback", async () => {
		mockAdminWithResume({ status: "closed" });

		const response = await POST(makeRequest(VALID_PAYLOAD), makeContext());

		expect(response.status).toBe(409);
		await expect(response.json()).resolves.toMatchObject({
			message: expect.stringContaining("no longer accepting"),
		});
	});

	// ─── Deadline enforcement (P0 bug fix) ────────────────────────────────────

	it("returns 409 when the review deadline has passed", async () => {
		// A reviewer who missed the deadline cannot submit. Without this check,
		// they could submit after the cron has already refunded the candidate —
		// candidate gets both the refund AND the review.
		const pastDeadline = new Date(Date.now() - 60_000).toISOString(); // 1 minute ago
		mockAdminWithResume({ review_deadline: pastDeadline });

		const response = await POST(makeRequest(VALID_PAYLOAD), makeContext());

		expect(response.status).toBe(409);
		await expect(response.json()).resolves.toMatchObject({
			message: expect.stringContaining("deadline"),
		});
	});

	it("allows submission when the review deadline has not yet passed", async () => {
		const futureDeadline = new Date(Date.now() + 3_600_000).toISOString(); // 1 hour from now
		mockAdminWithResume({ review_deadline: futureDeadline });

		const response = await POST(makeRequest(VALID_PAYLOAD), makeContext());

		expect(response.status).toBe(200);
	});

	it("allows submission when no review deadline is set", async () => {
		mockAdminWithResume({ review_deadline: null });

		const response = await POST(makeRequest(VALID_PAYLOAD), makeContext());

		expect(response.status).toBe(200);
	});

	// ─── Duplicate review guard ────────────────────────────────────────────────

	it("returns 409 when the reviewer has already submitted for this resume", async () => {
		mockAdminWithResume({}, { existingReview: true });

		const response = await POST(makeRequest(VALID_PAYLOAD), makeContext());

		expect(response.status).toBe(409);
		await expect(response.json()).resolves.toMatchObject({
			message: expect.stringContaining("already submitted"),
		});
	});

	// ─── DB write failures ────────────────────────────────────────────────────

	it("returns 500 when the roast insert fails", async () => {
		mockAdminWithResume({}, { roastInsertError: true });

		const response = await POST(makeRequest(VALID_PAYLOAD), makeContext());

		expect(response.status).toBe(500);
		expect(capturePrivateError).toHaveBeenCalledWith(
			expect.any(Object),
			expect.objectContaining({ operation: "premium_review_insert_roast" }),
		);
	});

	// ─── Happy path ───────────────────────────────────────────────────────────

	it("creates the roast and returns its ID on a valid submission", async () => {
		mockAdminWithResume({});

		const response = await POST(makeRequest(VALID_PAYLOAD), makeContext());

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ roastId: ROAST_ID });
	});

	it("formats the review as structured markdown in the roast content", async () => {
		const { admin } = mockAdminWithResume({});
		let capturedContent = "";

		// Capture the existing impl BEFORE replacing — calling admin.from(table)
		// inside the new implementation would recurse infinitely.
		const existingImpl = admin.from.getMockImplementation()!;
		vi.mocked(admin.from).mockImplementation((table: string) => {
			if (table === "roasts") {
				return {
					insert: vi.fn((row: { content: string }) => {
						capturedContent = row.content;
						return {
							select: vi.fn(() => ({
								single: vi.fn(async () => ({ data: { id: ROAST_ID }, error: null })),
							})),
						};
					}),
				} as never;
			}
			return existingImpl(table);
		});

		await POST(makeRequest(VALID_PAYLOAD), makeContext());

		expect(capturedContent).toContain("### Priority Review");
		expect(capturedContent).toContain("★★★★"); // 4 stars
		expect(capturedContent).toContain("Good"); // rating label for 4
		expect(capturedContent).toContain(VALID_PAYLOAD.overallImpression);
		expect(capturedContent).toContain(VALID_PAYLOAD.topChanges);
	});
});
