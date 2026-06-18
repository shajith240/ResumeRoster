import { POST } from "@/app/api/resumes/submit/route";
import { redactResumePdf } from "@/lib/pdf-redaction";
import { enforceApiRateLimit } from "@/lib/server/rate-limit";
import { requireSignedInUser } from "@/lib/server-auth";
import { enforceUploadSecurity } from "@/lib/server/upload-security";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/pdf-redaction", () => ({
	buildRedactionProfileFromUser: vi.fn(() => ({})),
	redactResumePdf: vi.fn(),
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

vi.mock("@/lib/server/upload-security", () => ({
	enforceUploadSecurity: vi.fn(),
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";

function submitRequest() {
	const formData = new FormData();
	formData.set(
		"file",
		new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "resume.pdf", {
			type: "application/pdf",
		}),
	);
	formData.set("title", "Data resume");
	formData.set("targetRole", "Data Analyst");
	formData.set(
		"jobDescription",
		"We need a data analyst with SQL and dashboard experience.",
	);
	formData.set("postDescription", "Please review the analytics story.");
	formData.set("privacyMode", "anonymous");

	return {
		formData: async () => formData,
		headers: new Headers({ Authorization: "Bearer session-token" }),
	} as Request;
}

function mockAdmin() {
	const from = vi.fn();
	const rpc = vi.fn();
	const upload = vi.fn();
	const admin = {
		from,
		rpc,
		storage: {
			from: vi.fn(() => ({ upload })),
		},
	};

	vi.mocked(requireSignedInUser).mockResolvedValue({
		admin,
		user: {
			email: "candidate@example.com",
			id: USER_ID,
		},
	} as never);

	return { admin, from, rpc, upload };
}

function mockSuccessfulSubmitAdmin({
	rpcResult = {
		data: [
			{
				activation_reviews_completed: 0,
				activation_reviews_required: 2,
				id: "resume-queued",
				review_queue_status: "waiting",
			},
		],
		error: null,
	},
}: {
	rpcResult?: unknown;
} = {}) {
	const profileSelectResults = [
		{ data: { id: USER_ID }, error: null },
		{
			data: {
				full_name: "Candidate User",
				username: "candidate-user",
			},
			error: null,
		},
	];
	const profileUpdateEq = vi.fn(async () => ({ error: null }));
	const resumeInsert = vi.fn();
	const from = vi.fn((table: string) => {
		if (table === "profiles") {
			return {
				insert: vi.fn(async () => ({ error: null })),
				select: vi.fn(() => ({
					eq: vi.fn(() => ({
						maybeSingle: vi.fn(async () => profileSelectResults.shift()),
					})),
				})),
				update: vi.fn(() => ({
					eq: profileUpdateEq,
				})),
			};
		}

		return {
			insert: resumeInsert,
		};
	});
	const rpc = vi.fn(async () => rpcResult);
	const upload = vi.fn(async () => ({ error: null }));
	const remove = vi.fn(async () => ({ error: null }));
	const admin = {
		from,
		rpc,
		storage: {
			from: vi.fn(() => ({ remove, upload })),
		},
	};

	vi.mocked(requireSignedInUser).mockResolvedValue({
		admin,
		user: {
			email: "candidate@example.com",
			id: USER_ID,
		},
	} as never);

	return { admin, from, profileUpdateEq, remove, resumeInsert, rpc, upload };
}

describe("resume submit route rate limits", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
		process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
		vi.mocked(enforceApiRateLimit).mockResolvedValue(null);
		vi.mocked(enforceUploadSecurity).mockResolvedValue({
			ok: true,
			sha256:
				"9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
		});
		vi.mocked(redactResumePdf).mockResolvedValue({
			bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
			redactionCounts: {
				address: 0,
				email: 0,
				link: 0,
				name: 0,
				phone: 0,
			},
		});
	});

	it("stops over-quota resume submits before profile writes, scanning, or redaction", async () => {
		const { admin, from, rpc, upload } = mockAdmin();
		vi.mocked(enforceApiRateLimit).mockResolvedValue(
			Response.json(
				{ message: "Too many resume uploads. Try again later." },
				{ status: 429 },
			),
		);

		const response = await POST(submitRequest());

		expect(response.status).toBe(429);
		expect(enforceApiRateLimit).toHaveBeenCalledWith(
			admin,
			USER_ID,
			"resumeSubmit",
		);
		expect(from).not.toHaveBeenCalled();
		expect(rpc).not.toHaveBeenCalled();
		expect(enforceUploadSecurity).not.toHaveBeenCalled();
		expect(redactResumePdf).not.toHaveBeenCalled();
		expect(upload).not.toHaveBeenCalled();
		await expect(response.json()).resolves.toEqual({
			message: "Too many resume uploads. Try again later.",
		});
	});

	it("creates new resumes through the queue RPC and returns activation progress", async () => {
		const { rpc, upload } = mockSuccessfulSubmitAdmin();

		const response = await POST(submitRequest());

		expect(response.status).toBe(200);
		expect(upload).toHaveBeenCalledWith(
			expect.stringMatching(new RegExp(`^${USER_ID}/\\d+-resume\\.pdf$`)),
			expect.any(Uint8Array),
			expect.objectContaining({
				contentType: "application/pdf",
				upsert: false,
			}),
		);
		expect(rpc).toHaveBeenCalledWith("create_resume_with_review_queue", {
			resume_file_path: expect.stringMatching(
				new RegExp(`^${USER_ID}/\\d+-resume\\.pdf$`),
			),
			resume_is_anonymous: true,
			resume_job_description:
				"We need a data analyst with SQL and dashboard experience.",
			resume_post_description: "Please review the analytics story.",
			resume_privacy_mode: "anonymous",
			resume_title: "Data resume",
			target_user_id: USER_ID,
		});
		await expect(response.json()).resolves.toMatchObject({
			activationReviewsCompleted: 0,
			activationReviewsRequired: 2,
			id: "resume-queued",
			reviewQueueStatus: "waiting",
		});
	});

	it("fails safely when the queue RPC is missing instead of bypassing review", async () => {
		const { remove, resumeInsert, rpc } = mockSuccessfulSubmitAdmin({
			rpcResult: {
				data: null,
				error: {
					message:
						"Could not find the function public.create_resume_with_review_queue",
				},
			},
		});

		const response = await POST(submitRequest());

		expect(response.status).toBe(500);
		expect(rpc).toHaveBeenCalledOnce();
		expect(resumeInsert).not.toHaveBeenCalled();
		expect(remove).toHaveBeenCalledWith([
			expect.stringMatching(new RegExp(`^${USER_ID}/\\d+-resume\\.pdf$`)),
		]);
		await expect(response.json()).resolves.toEqual({
			message: "Resume upload failed. Please try again.",
		});
	});
});
