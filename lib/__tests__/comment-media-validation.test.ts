import { describe, expect, it } from "vitest";
import {
	detectCommentImageMimeType,
	getCommentImageUploadIssue,
	getReviewContentIssue,
	normalizeCommentContent,
} from "@/lib/comment-media-validation";

const pngBytes = new Uint8Array([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const jpgBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const webpBytes = new Uint8Array([
	0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
const svgBytes = new TextEncoder().encode("<svg onload=alert(1)></svg>");
const unsupportedBytes = new TextEncoder().encode("not an image");

describe("comment media upload validation", () => {
	it("detects supported image signatures", () => {
		expect(detectCommentImageMimeType(pngBytes)).toBe("image/png");
		expect(detectCommentImageMimeType(jpgBytes)).toBe("image/jpeg");
		expect(detectCommentImageMimeType(webpBytes)).toBe("image/webp");
	});

	it("accepts small PNG, JPG, and WebP uploads", () => {
		for (const [bytes, type, name] of [
			[pngBytes, "image/png", "screen.png"],
			[jpgBytes, "image/jpeg", "screen.jpg"],
			[webpBytes, "image/webp", "screen.webp"],
		] as const) {
			expect(
				getCommentImageUploadIssue({
					bytes,
					name,
					size: bytes.length,
					type,
				}),
			).toBe("");
		}
	});

	it("rejects scriptable SVG and spoofed image uploads", () => {
		expect(
			getCommentImageUploadIssue({
				bytes: svgBytes,
				name: "bad.svg",
				size: svgBytes.length,
				type: "image/svg+xml",
			}),
		).toBe("Upload a PNG, JPG, or WebP image.");

		expect(
			getCommentImageUploadIssue({
				bytes: unsupportedBytes,
				name: "screen.bmp",
				size: unsupportedBytes.length,
				type: "image/bmp",
			}),
		).toBe("Upload a PNG, JPG, or WebP image.");

		expect(
			getCommentImageUploadIssue({
				bytes: webpBytes,
				name: "bad.png",
				size: webpBytes.length,
				type: "image/png",
			}),
		).toBe("The image file type does not match its contents.");
	});

	it("enforces the 3MB size limit", () => {
		expect(
			getCommentImageUploadIssue({
				bytes: pngBytes,
				name: "huge.png",
				size: 3 * 1024 * 1024 + 1,
				type: "image/png",
			}),
		).toBe("Keep comment images under 3MB.");
	});
});

describe("review content validation", () => {
	const attachmentId = "1bd2bea3-d892-4d46-97cd-98a558846fd3";

	it("still requires useful text when media is selected", () => {
		expect(
			getReviewContentIssue({
				attachmentId,
				content: "nice",
				contentFormat: "markdown",
			}),
		).toBe("Write at least 10 characters of useful feedback.");
	});

	it("accepts plain and markdown comments with optional media", () => {
		expect(
			getReviewContentIssue({
				attachmentId,
				content: "**Lead with impact** and quantify the first bullet.",
				contentFormat: "markdown",
			}),
		).toBe("");

		expect(
			getReviewContentIssue({
				content: "Lead with impact and quantify the first bullet.",
				contentFormat: "plain",
			}),
		).toBe("");
	});

	it("accepts emoji in review and reply text", () => {
		expect(
			getReviewContentIssue({
				content: "Lead with impact 🔥 and quantify wins 👍",
				contentFormat: "plain",
			}),
		).toBe("");

		expect(
			getReviewContentIssue({
				content: "🔥".repeat(10),
				contentFormat: "plain",
			}),
		).toBe("");
	});

	it("normalizes comment unicode without stripping emoji", () => {
		expect(normalizeCommentContent("  Cafe\u0301 looks stronger 🚀\r\n")).toBe(
			"Caf\u00e9 looks stronger 🚀",
		);
	});

	it("keeps the emoji-aware limit aligned with database storage length", () => {
		expect(
			getReviewContentIssue({
				content: "👍🏽".repeat(2001),
				contentFormat: "plain",
			}),
		).toBe("Keep feedback under 4000 characters.");
	});

	it("rejects invalid formats and malformed attachment ids", () => {
		expect(
			getReviewContentIssue({
				content: "Lead with impact and quantify the first bullet.",
				contentFormat: "html",
			}),
		).toBe("Choose a valid comment format.");

		expect(
			getReviewContentIssue({
				attachmentId: "not-a-uuid",
				content: "Lead with impact and quantify the first bullet.",
				contentFormat: "plain",
			}),
		).toBe("Choose a valid image.");
	});
});
