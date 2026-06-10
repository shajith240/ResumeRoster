import { POST } from "@/app/api/comment-media/upload/route";
import { requireSignedInUser } from "@/lib/server-auth";
import { enforceApiRateLimit } from "@/lib/server/rate-limit";
import { enforceUploadSecurity } from "@/lib/server/upload-security";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-auth", () => ({
	requireSignedInUser: vi.fn(),
	serverAuthErrorResponse: vi.fn(() =>
		Response.json({ message: "Request failed." }, { status: 500 }),
	),
}));

vi.mock("@/lib/server/rate-limit", () => ({
	enforceApiRateLimit: vi.fn(),
}));

vi.mock("@/lib/server/upload-security", () => ({
	enforceUploadSecurity: vi.fn(),
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const originalScanMode = process.env.UPLOAD_MALWARE_SCAN_MODE;
const originalScanUrl = process.env.UPLOAD_MALWARE_SCAN_URL;
const pngBytes = new Uint8Array([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function uploadRequest(file: File) {
	const formData = new FormData();
	formData.set("file", file);

	return {
		formData: async () => formData,
	} as Request;
}

function mockSignedInUser() {
	const insert = vi.fn(async () => ({
		data: {
			alt_text: "comment",
			created_at: "2026-06-05T00:00:00.000Z",
			file_size: pngBytes.byteLength,
			id: "22222222-2222-4222-8222-222222222222",
			kind: "image",
			mime_type: "image/png",
			source: "upload",
			storage_path: `${USER_ID}/image.png`,
			title: "comment",
		},
		error: null,
	}));
	const single = vi.fn(() => insert());
	const select = vi.fn(() => ({ single }));
	const upload = vi.fn(async () => ({ data: null, error: null }));
	const getPublicUrl = vi.fn((path: string) => ({
		data: { publicUrl: `https://storage.test/comment-media/${path}` },
	}));
	const from = vi.fn((tableOrBucket: string) => {
		if (tableOrBucket === "comment_attachments") {
			return { insert: vi.fn(() => ({ select })) };
		}

		return { getPublicUrl, upload };
	});

	vi.mocked(requireSignedInUser).mockResolvedValue({
		admin: {
			from,
			storage: { from },
		} as never,
		user: { id: USER_ID } as never,
	});

	return { upload };
}

describe("comment media upload route rate limits", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		delete process.env.UPLOAD_MALWARE_SCAN_MODE;
		delete process.env.UPLOAD_MALWARE_SCAN_URL;
		vi.mocked(enforceApiRateLimit).mockResolvedValue(null);
		vi.mocked(enforceUploadSecurity).mockResolvedValue({
			ok: true,
			sha256:
				"9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
		});
	});

	afterEach(() => {
		if (originalScanMode === undefined) {
			delete process.env.UPLOAD_MALWARE_SCAN_MODE;
		} else {
			process.env.UPLOAD_MALWARE_SCAN_MODE = originalScanMode;
		}

		if (originalScanUrl === undefined) {
			delete process.env.UPLOAD_MALWARE_SCAN_URL;
		} else {
			process.env.UPLOAD_MALWARE_SCAN_URL = originalScanUrl;
		}
	});

	it("checks the DB-backed upload limit before scanning images", async () => {
		const { upload } = mockSignedInUser();

		const response = await POST(
			uploadRequest(new File([pngBytes], "comment.png", { type: "image/png" })),
		);

		expect(response.status).toBe(200);
		expect(enforceApiRateLimit).toHaveBeenCalledWith(
			expect.anything(),
			USER_ID,
			"commentMediaUpload",
		);
		expect(enforceUploadSecurity).toHaveBeenCalled();
		expect(enforceUploadSecurity).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				mimeType: "image/png",
				uploadKind: "comment-media",
				userId: USER_ID,
			}),
			expect.objectContaining({
				UPLOAD_MALWARE_SCAN_MODE: "optional",
			}),
		);
		expect(upload).toHaveBeenCalledTimes(1);
	});

	it("stops over-quota image uploads before scanning or storage", async () => {
		const { upload } = mockSignedInUser();
		vi.mocked(enforceApiRateLimit).mockResolvedValue(
			Response.json(
				{ message: "Too many image uploads. Try again soon." },
				{ status: 429 },
			),
		);

		const response = await POST(
			uploadRequest(new File([pngBytes], "comment.png", { type: "image/png" })),
		);

		expect(response.status).toBe(429);
		expect(enforceUploadSecurity).not.toHaveBeenCalled();
		expect(upload).not.toHaveBeenCalled();
		await expect(response.json()).resolves.toEqual({
			message: "Too many image uploads. Try again soon.",
		});
	});
});
