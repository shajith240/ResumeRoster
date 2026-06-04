import { createClient } from "@supabase/supabase-js";
import { POST } from "@/app/api/resumes/submit/route";
import { redactResumePdf } from "@/lib/pdf-redaction";
import { enforceApiRateLimit } from "@/lib/server/rate-limit";
import { enforceUploadSecurity } from "@/lib/server/upload-security";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@supabase/supabase-js", () => ({
	createClient: vi.fn(),
}));

vi.mock("@/lib/pdf-redaction", () => ({
	buildRedactionProfileFromUser: vi.fn(() => ({})),
	redactResumePdf: vi.fn(),
}));

vi.mock("@/lib/server/rate-limit", () => ({
	enforceApiRateLimit: vi.fn(),
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
	const upload = vi.fn();
	const admin = {
		auth: {
			getUser: vi.fn(async () => ({
				data: {
					user: {
						email: "candidate@example.com",
						id: USER_ID,
					},
				},
				error: null,
			})),
		},
		from,
		storage: {
			from: vi.fn(() => ({ upload })),
		},
	};

	vi.mocked(createClient).mockReturnValue(admin as never);

	return { admin, from, upload };
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
		const { admin, from, upload } = mockAdmin();
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
		expect(enforceUploadSecurity).not.toHaveBeenCalled();
		expect(redactResumePdf).not.toHaveBeenCalled();
		expect(upload).not.toHaveBeenCalled();
		await expect(response.json()).resolves.toEqual({
			message: "Too many resume uploads. Try again later.",
		});
	});
});
