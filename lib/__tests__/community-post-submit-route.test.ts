import { POST } from "@/app/api/community/posts/submit/route";
import { enforceApiRateLimit } from "@/lib/server/rate-limit";
import { requireSignedInUser } from "@/lib/server-auth";
import { enforceUploadSecurity } from "@/lib/server/upload-security";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
const TOPIC_ID = "22222222-2222-4222-8222-222222222222";
const originalScanMode = process.env.UPLOAD_MALWARE_SCAN_MODE;
const originalScanUrl = process.env.UPLOAD_MALWARE_SCAN_URL;
const pngBytes = new Uint8Array([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function communityPostRequest(body: Record<string, unknown>) {
	return new Request("https://linted.test/api/community/posts/submit", {
		body: JSON.stringify(body),
		headers: {
			Authorization: "Bearer session-token",
			"Content-Type": "application/json",
		},
		method: "POST",
	});
}

function mockAdmin(rpcResult = { data: [{ id: "post-1" }], error: null }) {
	const rpc = vi.fn(async () => rpcResult);
	const upload = vi.fn(async () => ({ data: null, error: null }));
	const remove = vi.fn(async () => ({ data: null, error: null }));
	const getPublicUrl = vi.fn((path: string) => ({
		data: {
			publicUrl: `https://cdn.linted.test/${path}`,
		},
	}));
	const admin = {
		rpc,
		storage: {
			from: vi.fn(() => ({ getPublicUrl, remove, upload })),
		},
	};

	vi.mocked(requireSignedInUser).mockResolvedValue({
		admin,
		user: { id: USER_ID },
	} as never);

	return { admin, getPublicUrl, remove, rpc, upload };
}

function communityPostFormRequest() {
	const formData = new FormData();
	formData.set("body", "How should I prepare for this internship interview?");
	formData.set("postType", "question");
	formData.set("tags", JSON.stringify(["interview"]));
	formData.set("title", "Interview prep");
	formData.set("topicId", TOPIC_ID);
	formData.append(
		"images",
		new File([pngBytes], "whiteboard.png", { type: "image/png" }),
	);

	return {
		formData: async () => formData,
		headers: new Headers({
			Authorization: "Bearer session-token",
			"Content-Type": "multipart/form-data",
		}),
	} as Request;
}

function communityInlinePostFormRequest() {
	const formData = new FormData();
	formData.set(
		"body",
		"Here is the diagram\n\n\\!\\[Whiteboard\\]\\(linted-inline-image:inline-123\\)",
	);
	formData.set("postType", "question");
	formData.set("tags", JSON.stringify(["interview"]));
	formData.set("title", "Interview prep");
	formData.set("topicId", TOPIC_ID);
	formData.append("imageIds", "inline-123");
	formData.append("imagePlacements", "inline");
	formData.append(
		"images",
		new File([pngBytes], "whiteboard.png", { type: "image/png" }),
	);

	return {
		formData: async () => formData,
		headers: new Headers({
			Authorization: "Bearer session-token",
			"Content-Type": "multipart/form-data",
		}),
	} as Request;
}

describe("community post submit route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.NEXT_PUBLIC_COMMUNITY_POSTS_ENABLED = "true";
		process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
		process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
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

	it("keeps the endpoint closed when the feature flag is off", async () => {
		process.env.NEXT_PUBLIC_COMMUNITY_POSTS_ENABLED = "false";

		const response = await POST(
			communityPostRequest({
				body: "How should I prepare for this internship interview?",
				postType: "question",
				title: "Interview prep",
				topicId: TOPIC_ID,
			}),
		);

		expect(response.status).toBe(404);
		expect(requireSignedInUser).not.toHaveBeenCalled();
		await expect(response.json()).resolves.toEqual({
			message: "Community posting is not enabled.",
		});
	});

	it("stops over-quota requests before the submit RPC", async () => {
		const { admin, rpc } = mockAdmin();
		vi.mocked(enforceApiRateLimit).mockResolvedValue(
			Response.json(
				{ message: "Too many community posts. Try again soon." },
				{ status: 429 },
			),
		);

		const response = await POST(
			communityPostRequest({
				body: "How should I prepare for this internship interview?",
				postType: "question",
				title: "Interview prep",
				tags: ["interview"],
				topicId: TOPIC_ID,
			}),
		);

		expect(response.status).toBe(429);
		expect(enforceApiRateLimit).toHaveBeenCalledWith(
			admin,
			USER_ID,
			"communityPostSubmit",
		);
		expect(rpc).not.toHaveBeenCalled();
	});

	it("creates posts through the service-role RPC", async () => {
		const { rpc } = mockAdmin({
			data: [{ id: "33333333-3333-4333-8333-333333333333" }],
			error: null,
		});

		const response = await POST(
			communityPostRequest({
				body: "How should I prepare for this internship interview?",
				postType: "question",
				tags: "interview, internship, interview",
				title: "Interview prep",
				topicId: TOPIC_ID,
			}),
		);

		expect(response.status).toBe(200);
		expect(rpc).toHaveBeenCalledWith("submit_community_post", {
			attachment_payload: [],
			post_body: "How should I prepare for this internship interview?",
			post_kind: "question",
			post_title: "Interview prep",
			selected_topic_id: TOPIC_ID,
			tag_names: ["interview", "internship"],
			target_user_id: USER_ID,
		});
		await expect(response.json()).resolves.toEqual({
			href: "/community/33333333-3333-4333-8333-333333333333",
			id: "33333333-3333-4333-8333-333333333333",
			status: "active",
		});
	});

	it("allows title-only posts", async () => {
		const { rpc } = mockAdmin({
			data: [{ id: "33333333-3333-4333-8333-333333333333" }],
			error: null,
		});

		const response = await POST(
			communityPostRequest({
				body: "",
				postType: "question",
				tags: [],
				title: "Interview prep",
				topicId: TOPIC_ID,
			}),
		);

		expect(response.status).toBe(200);
		expect(rpc).toHaveBeenCalledWith(
			"submit_community_post",
			expect.objectContaining({
				post_body: "",
				post_title: "Interview prep",
			}),
		);
	});

	it("creates polls through the poll RPC without media upload", async () => {
		const { admin, rpc, upload } = mockAdmin({
			data: [{ id: "44444444-4444-4444-8444-444444444444" }],
			error: null,
		});

		const response = await POST(
			communityPostRequest({
				body: "Vote for the next community topic.",
				format: "poll",
				pollDurationDays: "7",
				pollOptions: ["DSA practice", "System design"],
				postType: "discussion",
				tags: [],
				title: "What should we study next?",
				topicId: TOPIC_ID,
			}),
		);

		expect(response.status).toBe(200);
		expect(enforceApiRateLimit).toHaveBeenCalledWith(
			admin,
			USER_ID,
			"communityPostSubmit",
		);
		expect(enforceApiRateLimit).not.toHaveBeenCalledWith(
			admin,
			USER_ID,
			"communityPostMediaUpload",
		);
		expect(upload).not.toHaveBeenCalled();
		expect(rpc).toHaveBeenCalledWith("submit_community_poll_post", {
			poll_duration_days: 7,
			poll_option_labels: ["DSA practice", "System design"],
			post_body: "Vote for the next community topic.",
			post_kind: "discussion",
			post_title: "What should we study next?",
			selected_topic_id: TOPIC_ID,
			target_user_id: USER_ID,
		});
	});

	it("uploads post images and submits normalized attachment metadata", async () => {
		const { admin, rpc, upload } = mockAdmin({
			data: [{ id: "33333333-3333-4333-8333-333333333333" }],
			error: null,
		});

		const response = await POST(communityPostFormRequest());

		expect(response.status).toBe(200);
		expect(enforceApiRateLimit).toHaveBeenCalledWith(
			admin,
			USER_ID,
			"communityPostSubmit",
		);
		expect(enforceApiRateLimit).toHaveBeenCalledWith(
			admin,
			USER_ID,
			"communityPostMediaUpload",
		);
		expect(enforceUploadSecurity).toHaveBeenCalledWith(
			admin,
			expect.objectContaining({
				fileName: "whiteboard.png",
				mimeType: "image/png",
				uploadKind: "community-post-media",
				userId: USER_ID,
			}),
			expect.objectContaining({
				UPLOAD_MALWARE_SCAN_MODE: "optional",
			}),
		);
		expect(upload).toHaveBeenCalledTimes(1);
		expect(rpc).toHaveBeenCalledWith("submit_community_post", {
			attachment_payload: [
				expect.objectContaining({
					alt_text: "whiteboard",
					file_size: pngBytes.byteLength,
					mime_type: "image/png",
					storage_path: expect.stringMatching(
						new RegExp(`^${USER_ID}/.+\\.png$`),
					),
					title: "whiteboard",
				}),
			],
			post_body: "How should I prepare for this internship interview?",
			post_kind: "question",
			post_title: "Interview prep",
			selected_topic_id: TOPIC_ID,
			tag_names: ["interview"],
			target_user_id: USER_ID,
		});
	});

	it("embeds inline post images into the saved markdown body", async () => {
		const { getPublicUrl, rpc } = mockAdmin({
			data: [{ id: "33333333-3333-4333-8333-333333333333" }],
			error: null,
		});

		const response = await POST(communityInlinePostFormRequest());

		expect(response.status).toBe(200);
		expect(getPublicUrl).toHaveBeenCalledWith(
			expect.stringMatching(new RegExp(`^${USER_ID}/.+\\.png$`)),
		);
		expect(rpc).toHaveBeenCalledWith(
			"submit_community_post",
			expect.objectContaining({
				attachment_payload: [
					expect.objectContaining({
						alt_text: "whiteboard",
						mime_type: "image/png",
					}),
				],
				post_body: expect.stringMatching(
					/^Here is the diagram\n\n!\[Whiteboard]\(https:\/\/cdn\.linted\.test\/11111111-1111-4111-8111-111111111111\/.+\.png\)$/,
				),
			}),
		);
	});
});
