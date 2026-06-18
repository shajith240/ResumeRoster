import { DELETE, POST } from "@/app/api/profile/avatar/route";
import { requireSignedInUser } from "@/lib/server-auth";
import { enforceApiRateLimit } from "@/lib/server/rate-limit";
import { enforceUploadSecurity } from "@/lib/server/upload-security";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-auth", () => ({
	requireSignedInUser: vi.fn(),
	serverAuthErrorResponse: vi.fn(() =>
		Response.json({ message: "Request failed." }, { status: 500 }),
	),
}));

vi.mock("@/lib/server/upload-security", () => ({
	enforceUploadSecurity: vi.fn(),
}));

vi.mock("@/lib/server/rate-limit", () => ({
	enforceApiRateLimit: vi.fn(),
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const pngBytes = new Uint8Array([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const svgBytes = new TextEncoder().encode("<svg onload=alert(1)></svg>");

function avatarRequest(file: File) {
	const formData = new FormData();
	formData.set("file", file);

	return {
		formData: async () => formData,
	} as Request;
}

function deleteRequest(avatarPath: string) {
	return {
		json: async () => ({ avatarPath }),
	} as Request;
}

function mockSignedInUser() {
	const upload = vi.fn(async () => ({ data: null, error: null }));
	const remove = vi.fn(async () => ({ data: null, error: null }));
	const getPublicUrl = vi.fn((path: string) => ({
		data: { publicUrl: `https://storage.test/avatars/${path}` },
	}));
	const from = vi.fn(() => ({ getPublicUrl, remove, upload }));

	vi.mocked(requireSignedInUser).mockResolvedValue({
		admin: {
			storage: { from },
		} as never,
		user: { id: USER_ID } as never,
	});

	return { from, getPublicUrl, remove, upload };
}

describe("profile avatar upload route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(enforceApiRateLimit).mockResolvedValue(null);
		vi.mocked(enforceUploadSecurity).mockResolvedValue({
			ok: true,
			sha256:
				"9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
		});
	});

	it("rejects unsupported avatar content before scanning or storage upload", async () => {
		const { upload } = mockSignedInUser();

		const response = await POST(
			avatarRequest(
				new File([svgBytes], "avatar.svg", { type: "image/svg+xml" }),
			),
		);

		expect(response.status).toBe(400);
		expect(enforceApiRateLimit).toHaveBeenCalledWith(
			expect.anything(),
			USER_ID,
			"avatarUpload",
		);
		expect(enforceUploadSecurity).not.toHaveBeenCalled();
		expect(upload).not.toHaveBeenCalled();
		await expect(response.json()).resolves.toEqual({
			message: "Upload a PNG, JPG, or WebP profile image.",
		});
	});

	it("scans before uploading a clean avatar to public avatar storage", async () => {
		const { from, getPublicUrl, upload } = mockSignedInUser();

		const response = await POST(
			avatarRequest(new File([pngBytes], "avatar.png", { type: "image/png" })),
		);

		expect(response.status).toBe(200);
		expect(enforceApiRateLimit).toHaveBeenCalledWith(
			expect.anything(),
			USER_ID,
			"avatarUpload",
		);
		expect(enforceUploadSecurity).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				fileName: "avatar.png",
				mimeType: "image/png",
				uploadKind: "avatar",
				userId: USER_ID,
			}),
		);
		expect(from).toHaveBeenCalledWith("avatars");
		expect(upload).toHaveBeenCalledTimes(1);
		const uploadCall = upload.mock.calls[0] as unknown as [
			string,
			unknown,
			Record<string, unknown>,
		];
		expect(uploadCall[0]).toMatch(new RegExp(`^${USER_ID}/.+\\.png$`));
		expect(ArrayBuffer.isView(uploadCall[1])).toBe(true);
		expect(uploadCall[2]).toMatchObject({
			contentType: "image/png",
			upsert: false,
		});
		expect(getPublicUrl).toHaveBeenCalled();
		await expect(response.json()).resolves.toMatchObject({
			avatar_path: expect.stringMatching(new RegExp(`^${USER_ID}/.+\\.png$`)),
			avatar_url: expect.stringContaining("https://storage.test/avatars/"),
		});
	});

	it("stops over-quota avatar uploads before scanning or public storage", async () => {
		const { upload } = mockSignedInUser();
		vi.mocked(enforceApiRateLimit).mockResolvedValue(
			Response.json(
				{ message: "Too many profile image uploads. Try again later." },
				{ status: 429 },
			),
		);

		const response = await POST(
			avatarRequest(new File([pngBytes], "avatar.png", { type: "image/png" })),
		);

		expect(response.status).toBe(429);
		expect(enforceUploadSecurity).not.toHaveBeenCalled();
		expect(upload).not.toHaveBeenCalled();
		await expect(response.json()).resolves.toEqual({
			message: "Too many profile image uploads. Try again later.",
		});
	});

	it("blocks scanner failures before public avatar storage upload", async () => {
		const { upload } = mockSignedInUser();
		vi.mocked(enforceUploadSecurity).mockResolvedValue({
			message:
				"Uploads are temporarily unavailable while security scanning is offline.",
			ok: false,
			sha256:
				"9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
			status: 503,
			verdict: "unscanned",
		});

		const response = await POST(
			avatarRequest(new File([pngBytes], "avatar.png", { type: "image/png" })),
		);

		expect(response.status).toBe(503);
		expect(upload).not.toHaveBeenCalled();
		await expect(response.json()).resolves.toEqual({
			message:
				"Uploads are temporarily unavailable while security scanning is offline.",
		});
	});

	it("only removes avatar paths owned by the signed-in user", async () => {
		const { remove } = mockSignedInUser();

		const blocked = await DELETE(deleteRequest("other-user/avatar.png"));
		expect(blocked.status).toBe(400);
		expect(remove).not.toHaveBeenCalled();

		const removed = await DELETE(deleteRequest(`${USER_ID}/avatar.png`));
		expect(removed.status).toBe(200);
		expect(remove).toHaveBeenCalledWith([`${USER_ID}/avatar.png`]);
	});
});
