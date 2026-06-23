/**
 * Tests for POST /api/payments/verify
 *
 * This is the highest-stakes route in the codebase. Razorpay has ALREADY
 * captured money before this handler runs. Every failure path must trigger an
 * automatic refund so the user is never charged for nothing.
 *
 * Test priorities (in descending order of severity):
 *  1. HMAC signature verification — a bypass here means free premium access
 *  2. Idempotency — the same order_id must never create a second resume
 *  3. Auto-refund on failure — every post-payment failure must refund
 *  4. Input validation — bad data must be rejected before any DB work
 */
import { POST } from "@/app/api/payments/verify/route";
import { capturePrivateError } from "@/lib/monitoring/capture-errors";
import { verifyRazorpayPaymentSignature, issueRazorpayRefund } from "@/lib/razorpay";
import { enforceUploadSecurity } from "@/lib/server/upload-security";
import { redactResumePdf, buildRedactionProfileFromUser } from "@/lib/pdf-redaction";
import { requireSignedInUser } from "@/lib/server-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/monitoring/capture-errors", () => ({
	capturePrivateError: vi.fn(),
}));

vi.mock("@/lib/razorpay", () => ({
	verifyRazorpayPaymentSignature: vi.fn(),
	issueRazorpayRefund: vi.fn(),
	PREMIUM_AMOUNT_PAISE: 39900,
}));

vi.mock("@/lib/server/upload-security", () => ({
	enforceUploadSecurity: vi.fn(),
}));

vi.mock("@/lib/pdf-redaction", () => ({
	buildRedactionProfileFromUser: vi.fn(() => ({})),
	redactResumePdf: vi.fn(),
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
	premiumReviewPosted: vi.fn(() => ({ subject: "s", html: "h" })),
}));

const USER_ID = "44444444-4444-4444-8444-444444444444";
const ORDER_ID = "order_testXYZ789";
const PAYMENT_ID = "pay_testABC012";
const SIGNATURE = "valid-signature-hash";

// Minimal valid PDF magic bytes
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

function makeFormData(overrides: Record<string, string | File> = {}) {
	const form = new FormData();
	form.set("razorpay_order_id", ORDER_ID);
	form.set("razorpay_payment_id", PAYMENT_ID);
	form.set("razorpay_signature", SIGNATURE);
	form.set("title", "My Senior SWE Resume");
	form.set("targetRole", "Senior SDE");
	form.set("jobDescription", "We need a senior SWE with 5+ years experience in distributed systems.");
	form.set("postDescription", "Please focus on the impact statements in my experience section.");
	form.set("privacyMode", "contact_hidden");
	form.set(
		"file",
		new File([PDF_BYTES], "resume.pdf", { type: "application/pdf" }),
	);
	for (const [key, value] of Object.entries(overrides)) {
		form.set(key, value);
	}
	return form;
}

function makeRequest(form?: FormData) {
	const formData = form ?? makeFormData();
	return {
		headers: new Headers({ Authorization: "Bearer test-token" }),
		formData: async () => formData,
	} as Request;
}

/**
 * Wires up a fully functional mock admin for the happy-path scenario.
 * Returns the mocks so individual tests can assert on specific calls.
 */
function mockHappyPathAdmin() {
	const duplicateCheck = vi.fn(async () => ({ data: null, error: null }));
	// Return existing profile so ensureProfile skips the insert entirely.
	// An object with a `then` property is a JS thenable — if insert were to
	// return { error: null, then: vi.fn() } the route would await it as a
	// Promise that never resolves, causing a 5 s timeout.
	const profileSelect = vi.fn(async () => ({ data: { id: USER_ID }, error: null }));
	const rpc = vi.fn(async () => ({
		data: [{ id: "resume-premium-001" }],
		error: null,
	}));
	const upload = vi.fn(async () => ({ error: null }));
	const remove = vi.fn(async () => ({ error: null }));

	const admin = {
		from: vi.fn((table: string) => {
			if (table === "resumes") {
				// duplicate check: .select("id").eq("razorpay_order_id", ...).maybeSingle()
				return {
					select: vi.fn(() => ({
						eq: vi.fn(() => ({ maybeSingle: duplicateCheck })),
					})),
				};
			}
			if (table === "profiles") {
				return {
					select: vi.fn(() => ({
						eq: vi.fn(() => ({ maybeSingle: profileSelect })),
					})),
					insert: vi.fn(async () => ({ error: null })),
					update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
				};
			}
			// moderation_actions fallback
			return { insert: vi.fn(async () => ({ error: null })) };
		}),
		rpc,
		storage: { from: vi.fn(() => ({ upload, remove })) },
	};

	vi.mocked(requireSignedInUser).mockResolvedValue({
		admin,
		user: { id: USER_ID, email: "user@example.com" },
	} as never);

	return { admin, duplicateCheck, rpc, upload, remove };
}

describe("POST /api/payments/verify", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(verifyRazorpayPaymentSignature).mockReturnValue(true);
		vi.mocked(enforceUploadSecurity).mockResolvedValue({
			ok: true,
			sha256: "abcd1234".repeat(8),
		});
		vi.mocked(redactResumePdf).mockResolvedValue({
			bytes: PDF_BYTES,
			redactionCounts: { address: 0, email: 1, link: 0, name: 1, phone: 0 },
		});
		vi.mocked(issueRazorpayRefund).mockResolvedValue({ refundId: "rfnd_test001" });
		process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ci.supabase.co";
		process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
	});

	// ─── Auth ──────────────────────────────────────────────────────────────────

	it("returns 401 when the session token is missing", async () => {
		const authError = Object.assign(new Error("Sign in again to complete payment."), {
			status: 401,
		});
		vi.mocked(requireSignedInUser).mockRejectedValue(authError);

		const response = await POST(makeRequest());

		expect(response.status).toBe(401);
	});

	// ─── Form data validation ──────────────────────────────────────────────────

	it("returns 400 when payment fields are missing from the form", async () => {
		const form = makeFormData();
		form.delete("razorpay_payment_id");
		mockHappyPathAdmin();

		const response = await POST(makeRequest(form));

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			message: expect.stringContaining("incomplete"),
		});
		expect(verifyRazorpayPaymentSignature).not.toHaveBeenCalled();
	});

	// ─── HMAC signature verification (critical security gate) ─────────────────

	it("returns 400 and never touches the DB when the HMAC signature is invalid", async () => {
		vi.mocked(verifyRazorpayPaymentSignature).mockReturnValue(false);
		const { admin } = mockHappyPathAdmin();

		const response = await POST(makeRequest());

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			message: expect.stringContaining("verification failed"),
		});
		// No DB access after a bad signature
		expect(admin.from).not.toHaveBeenCalled();
		expect(capturePrivateError).toHaveBeenCalledWith(
			expect.any(Error),
			expect.objectContaining({ operation: "verify_payment_signature" }),
		);
	});

	it("does not issue a refund when the signature check fails (money was never captured)", async () => {
		vi.mocked(verifyRazorpayPaymentSignature).mockReturnValue(false);
		mockHappyPathAdmin();

		await POST(makeRequest());

		expect(issueRazorpayRefund).not.toHaveBeenCalled();
	});

	// ─── Idempotency ───────────────────────────────────────────────────────────

	it("returns 200 with alreadyProcessed when the same order_id is submitted twice", async () => {
		const duplicateCheck = vi.fn(async () => ({
			data: { id: "resume-already-created" },
			error: null,
		}));
		const admin = {
			from: vi.fn(() => ({
				select: vi.fn(() => ({
					eq: vi.fn(() => ({ maybeSingle: duplicateCheck })),
				})),
			})),
		};
		vi.mocked(requireSignedInUser).mockResolvedValue({
			admin,
			user: { id: USER_ID, email: "user@example.com" },
		} as never);

		const response = await POST(makeRequest());

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			id: "resume-already-created",
			alreadyProcessed: true,
		});
	});

	// ─── Resume form field validation ─────────────────────────────────────────

	it("returns 400 when the uploaded file is not a PDF by MIME type", async () => {
		const form = makeFormData();
		form.set("file", new File([PDF_BYTES], "resume.png", { type: "image/png" }));
		mockHappyPathAdmin();

		const response = await POST(makeRequest(form));

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			message: expect.stringContaining("PDF"),
		});
	});

	it("returns 400 when the PDF exceeds the 5 MB limit", async () => {
		const bigFile = new File([new Uint8Array(6 * 1024 * 1024)], "big.pdf", {
			type: "application/pdf",
		});
		const form = makeFormData({ file: bigFile });
		mockHappyPathAdmin();

		const response = await POST(makeRequest(form));

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			message: expect.stringContaining("5MB"),
		});
	});

	it("returns 400 when the job description is too short", async () => {
		// Route returns "Add a valid job description." — confirmed by reading the route source
		const form = makeFormData({ jobDescription: "Too short" });
		mockHappyPathAdmin();

		const response = await POST(makeRequest(form));

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			message: expect.stringContaining("valid job description"),
		});
	});

	it("returns 400 when the target role is not in the allowed list", async () => {
		const form = makeFormData({ targetRole: "Ninja Developer" });
		mockHappyPathAdmin();

		const response = await POST(makeRequest(form));

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			message: expect.stringContaining("target role"),
		});
	});

	it("returns 400 when the privacy mode is not a recognised value", async () => {
		const form = makeFormData({ privacyMode: "invisible" });
		mockHappyPathAdmin();

		const response = await POST(makeRequest(form));

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			message: expect.stringContaining("privacy mode"),
		});
	});

	// ─── Auto-refund on post-payment failures ──────────────────────────────────

	it("issues an immediate refund and returns 422 when PDF redaction fails", async () => {
		mockHappyPathAdmin();
		vi.mocked(redactResumePdf).mockRejectedValue(new Error("Unsupported PDF version"));

		const response = await POST(makeRequest());

		expect(response.status).toBe(422);
		await expect(response.json()).resolves.toMatchObject({
			message: expect.stringContaining("refunded automatically"),
		});
		// Refund must be triggered with the real payment ID
		expect(issueRazorpayRefund).toHaveBeenCalledWith(PAYMENT_ID, 39900);
	});

	it("issues an immediate refund and returns 500 when the storage upload fails", async () => {
		const { upload } = mockHappyPathAdmin();
		upload.mockResolvedValue({ error: { message: "storage bucket full" } } as never);

		const response = await POST(makeRequest());

		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toMatchObject({
			message: expect.stringContaining("refunded automatically"),
		});
		expect(issueRazorpayRefund).toHaveBeenCalledWith(PAYMENT_ID, 39900);
	});

	it("issues an immediate refund and returns 500 when the resume DB insert fails", async () => {
		const { rpc } = mockHappyPathAdmin();
		rpc.mockResolvedValue({
			data: null,
			error: { message: "insert failed", code: "50000" },
		} as never);

		const response = await POST(makeRequest());

		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toMatchObject({
			message: expect.stringContaining("refunded automatically"),
		});
		expect(issueRazorpayRefund).toHaveBeenCalledWith(PAYMENT_ID, 39900);
	});

	it("returns 409 without a refund when the order_id is a unique-constraint duplicate", async () => {
		const { rpc } = mockHappyPathAdmin();
		rpc.mockResolvedValue({
			data: null,
			error: { message: "duplicate key value", code: "23505" },
		} as never);

		const response = await POST(makeRequest());

		expect(response.status).toBe(409);
		// This is an idempotency collision at the DB layer — no refund needed
		expect(issueRazorpayRefund).not.toHaveBeenCalled();
	});

	it("records a failed-refund audit entry when Razorpay refund itself throws", async () => {
		const { rpc, admin } = mockHappyPathAdmin();
		rpc.mockResolvedValue({ data: null, error: { message: "rpc error", code: "50000" } } as never);
		vi.mocked(issueRazorpayRefund).mockRejectedValue(new Error("Razorpay unreachable"));

		// Capture the existing mockImplementation BEFORE replacing it so we can
		// delegate to it for non-moderation_actions tables. Calling admin.from(table)
		// directly inside the new implementation would be infinite recursion.
		const existingImpl = admin.from.getMockImplementation()!;
		const moderationInsert = vi.fn(async () => ({ error: null }));
		vi.mocked(admin.from).mockImplementation((table: string) => {
			if (table === "moderation_actions") return { insert: moderationInsert } as never;
			return existingImpl(table);
		});

		await POST(makeRequest());

		expect(capturePrivateError).toHaveBeenCalledWith(
			expect.objectContaining({ message: "Razorpay unreachable" }),
			expect.objectContaining({ operation: "orphan_payment_refund" }),
		);
	});

	// ─── Happy path ───────────────────────────────────────────────────────────

	it("creates a premium resume and returns its ID and redaction counts on success", async () => {
		const { rpc, upload } = mockHappyPathAdmin();
		rpc.mockResolvedValue({
			data: [{ id: "resume-premium-success" }],
			error: null,
		});

		const response = await POST(makeRequest());

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			id: "resume-premium-success",
			paymentStatus: "paid",
			redactionCounts: { address: 0, email: 1, link: 0, name: 1, phone: 0 },
		});
		expect(upload).toHaveBeenCalledWith(
			expect.stringMatching(new RegExp(`^${USER_ID}/\\d+-resume\\.pdf$`)),
			PDF_BYTES,
			expect.objectContaining({ contentType: "application/pdf" }),
		);
		expect(rpc).toHaveBeenCalledWith(
			"create_premium_resume",
			expect.objectContaining({
				target_user_id: USER_ID,
				p_razorpay_order_id: ORDER_ID,
				p_payment_id: PAYMENT_ID,
			}),
		);
		// Payment capture succeeded — no refund
		expect(issueRazorpayRefund).not.toHaveBeenCalled();
	});
});
