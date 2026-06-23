/**
 * Tests for POST /api/payments/create-order
 *
 * This route creates a Razorpay order before the user pays. Failures here mean
 * the user can't reach the checkout screen. The money hasn't moved yet, so the
 * blast radius is low — but every guard (feature flag, auth, rate limit, duplicate
 * active review check) must fire in the right order.
 */
import { POST } from "@/app/api/payments/create-order/route";
import { capturePrivateError } from "@/lib/monitoring/capture-errors";
import { getRazorpayClient } from "@/lib/razorpay";
import { enforceApiRateLimit } from "@/lib/server/rate-limit";
import { requireSignedInUser } from "@/lib/server-auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/monitoring/capture-errors", () => ({
	capturePrivateError: vi.fn(),
}));

vi.mock("@/lib/server/rate-limit", () => ({
	enforceApiRateLimit: vi.fn(),
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

vi.mock("@/lib/razorpay", () => ({
	getRazorpayClient: vi.fn(),
	PREMIUM_AMOUNT_PAISE: 39900,
	PREMIUM_CURRENCY: "INR",
}));

// PREMIUM_REVIEW_ENABLED is a module-level constant — use vi.hoisted so the
// mutable ref is initialized before vi.mock's factory is hoisted and executed.
const premiumFlag = vi.hoisted(() => ({ PREMIUM_REVIEW_ENABLED: true }));
vi.mock("@/lib/premium-payments", () => premiumFlag);

const USER_ID = "33333333-3333-4333-8333-333333333333";

function makeRequest() {
	return {
		headers: new Headers({ Authorization: "Bearer test-token" }),
	} as Request;
}

/**
 * Builds a mock admin client whose resumes query returns the given result.
 * The route does: admin.from("resumes").select(...).eq(...).eq(...).eq(...).in(...).maybeSingle()
 */
function mockAdminWithResumeCheck(
	resumeResult: { data: { id: string } | null; error: { message: string } | null },
) {
	const maybeSingle = vi.fn(async () => resumeResult);
	const inFn = vi.fn(() => ({ maybeSingle }));
	const eqChain: ReturnType<typeof vi.fn> = vi.fn(() => ({ eq: eqChain, in: inFn }));
	const select = vi.fn(() => ({ eq: eqChain }));
	const admin = { from: vi.fn(() => ({ select })) };

	vi.mocked(requireSignedInUser).mockResolvedValue({
		admin,
		user: { id: USER_ID, email: "user@example.com" },
	} as never);

	return { admin, maybeSingle };
}

describe("POST /api/payments/create-order", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		premiumFlag.PREMIUM_REVIEW_ENABLED = true;
		process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = "rzp_test_abc123";
		vi.mocked(enforceApiRateLimit).mockResolvedValue(null);
	});

	afterEach(() => {
		delete process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
	});

	// ─── Feature flag ─────────────────────────────────────────────────────────

	it("returns 503 and a waitlist message when premium reviews are disabled", async () => {
		premiumFlag.PREMIUM_REVIEW_ENABLED = false;

		const response = await POST(makeRequest());

		expect(response.status).toBe(503);
		await expect(response.json()).resolves.toMatchObject({
			message: expect.stringContaining("not available"),
		});
		// Auth must not be attempted when the feature is off
		expect(requireSignedInUser).not.toHaveBeenCalled();
	});

	// ─── Auth ──────────────────────────────────────────────────────────────────

	it("returns 401 when the request carries no auth token", async () => {
		const authError = Object.assign(new Error("Sign in to purchase a priority review."), {
			status: 401,
		});
		vi.mocked(requireSignedInUser).mockRejectedValue(authError);

		const response = await POST(makeRequest());

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toMatchObject({
			message: "Sign in to purchase a priority review.",
		});
	});

	// ─── Rate limiting ────────────────────────────────────────────────────────

	it("returns 429 without touching Razorpay when the user is over quota", async () => {
		mockAdminWithResumeCheck({ data: null, error: null });
		vi.mocked(enforceApiRateLimit).mockResolvedValue(
			Response.json(
				{ message: "Too many payment attempts. Try again in an hour." },
				{ status: 429 },
			),
		);

		const response = await POST(makeRequest());

		expect(response.status).toBe(429);
		expect(getRazorpayClient).not.toHaveBeenCalled();
		await expect(response.json()).resolves.toMatchObject({
			message: expect.stringContaining("Too many payment"),
		});
	});

	it("enforces rate limit with the paymentCreateOrder policy", async () => {
		const { admin } = mockAdminWithResumeCheck({ data: null, error: null });
		vi.mocked(enforceApiRateLimit).mockResolvedValue(null);
		vi.mocked(getRazorpayClient).mockReturnValue({
			orders: { create: vi.fn(async () => ({ id: "order_abc" })) },
		} as never);

		await POST(makeRequest());

		expect(enforceApiRateLimit).toHaveBeenCalledWith(admin, USER_ID, "paymentCreateOrder");
	});

	// ─── Duplicate active premium ─────────────────────────────────────────────

	it("returns 409 when the user already has an active premium review in flight", async () => {
		mockAdminWithResumeCheck({ data: { id: "resume-existing" }, error: null });

		const response = await POST(makeRequest());

		expect(response.status).toBe(409);
		expect(getRazorpayClient).not.toHaveBeenCalled();
		await expect(response.json()).resolves.toMatchObject({
			message: expect.stringContaining("already have an active"),
		});
	});

	it("returns 500 and captures the error when the duplicate-check query fails", async () => {
		mockAdminWithResumeCheck({ data: null, error: { message: "connection timeout" } });

		const response = await POST(makeRequest());

		expect(response.status).toBe(500);
		expect(capturePrivateError).toHaveBeenCalledWith(
			expect.objectContaining({ message: "connection timeout" }),
			expect.objectContaining({ area: "payments", operation: "check_active_premium" }),
		);
		expect(getRazorpayClient).not.toHaveBeenCalled();
	});

	// ─── Razorpay client setup ────────────────────────────────────────────────

	it("returns 503 when Razorpay credentials are not configured", async () => {
		mockAdminWithResumeCheck({ data: null, error: null });
		vi.mocked(getRazorpayClient).mockImplementation(() => {
			throw new Error("Razorpay credentials not configured.");
		});

		const response = await POST(makeRequest());

		expect(response.status).toBe(503);
		await expect(response.json()).resolves.toMatchObject({
			message: expect.stringContaining("temporarily unavailable"),
		});
	});

	// ─── Razorpay API failure ─────────────────────────────────────────────────

	it("returns 502 and captures the error when the Razorpay API call fails", async () => {
		mockAdminWithResumeCheck({ data: null, error: null });
		vi.mocked(getRazorpayClient).mockReturnValue({
			orders: {
				create: vi.fn(async () => {
					throw new Error("Razorpay gateway timeout");
				}),
			},
		} as never);

		const response = await POST(makeRequest());

		expect(response.status).toBe(502);
		expect(capturePrivateError).toHaveBeenCalledWith(
			expect.any(Error),
			expect.objectContaining({ area: "payments", operation: "razorpay_create_order" }),
		);
		await expect(response.json()).resolves.toMatchObject({
			message: expect.stringContaining("Could not create payment order"),
		});
	});

	// ─── Happy path ───────────────────────────────────────────────────────────

	it("returns order details with the Razorpay key ID on success", async () => {
		mockAdminWithResumeCheck({ data: null, error: null });
		vi.mocked(getRazorpayClient).mockReturnValue({
			orders: { create: vi.fn(async () => ({ id: "order_live123" })) },
		} as never);

		const response = await POST(makeRequest());

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			orderId: "order_live123",
			amount: 39900,
			currency: "INR",
			keyId: "rzp_test_abc123",
		});
	});

	it("includes an empty keyId when NEXT_PUBLIC_RAZORPAY_KEY_ID is not set", async () => {
		delete process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
		mockAdminWithResumeCheck({ data: null, error: null });
		vi.mocked(getRazorpayClient).mockReturnValue({
			orders: { create: vi.fn(async () => ({ id: "order_nk" })) },
		} as never);

		const response = await POST(makeRequest());
		const body = await response.json() as { keyId: string };

		expect(body.keyId).toBe("");
	});
});
