import { describe, expect, it } from "vitest";
import {
	detectCommentImageMimeType,
	getCommentImageUploadIssue,
	getRoastContentIssue,
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

describe("roast content validation", () => {
	const attachmentId = "1bd2bea3-d892-4d46-97cd-98a558846fd3";

	it("still requires useful text when media is selected", () => {
		expect(
			getRoastContentIssue({
				attachmentId,
				content: "nice",
				contentFormat: "markdown",
			}),
		).toBe("Write at least 10 characters of useful feedback.");
	});

	it("accepts plain and markdown comments with optional media", () => {
		expect(
			getRoastContentIssue({
				attachmentId,
				content: "**Lead with impact** and quantify the first bullet.",
				contentFormat: "markdown",
			}),
		).toBe("");

		expect(
			getRoastContentIssue({
				content: "Lead with impact and quantify the first bullet.",
				contentFormat: "plain",
			}),
		).toBe("");
	});

	it("rejects invalid formats and malformed attachment ids", () => {
		expect(
			getRoastContentIssue({
				content: "Lead with impact and quantify the first bullet.",
				contentFormat: "html",
			}),
		).toBe("Choose a valid comment format.");

		expect(
			getRoastContentIssue({
				attachmentId: "not-a-uuid",
				content: "Lead with impact and quantify the first bullet.",
				contentFormat: "plain",
			}),
		).toBe("Choose a valid image.");
	});
});
