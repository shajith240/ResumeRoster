import { describe, expect, it } from "vitest";
import {
	detectCommentImageMimeType,
	getCommentImageDimensions,
	getCommentImageUploadIssue,
	getRoastContentIssue,
} from "@/lib/comment-media-validation";

function pngBytes(width = 100, height = 100) {
	const bytes = new Uint8Array(24);
	bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	bytes[16] = (width >>> 24) & 0xff;
	bytes[17] = (width >>> 16) & 0xff;
	bytes[18] = (width >>> 8) & 0xff;
	bytes[19] = width & 0xff;
	bytes[20] = (height >>> 24) & 0xff;
	bytes[21] = (height >>> 16) & 0xff;
	bytes[22] = (height >>> 8) & 0xff;
	bytes[23] = height & 0xff;
	return bytes;
}

const jpgBytes = new Uint8Array([
	0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x64, 0x00, 0x64,
]);
const webpBytes = new Uint8Array([
	0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
	0x56, 0x50, 0x38, 0x58, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
	0x63, 0x00, 0x00, 0x63, 0x00, 0x00,
]);
const svgBytes = new TextEncoder().encode("<svg onload=alert(1)></svg>");
const unsupportedBytes = new TextEncoder().encode("not an image");

describe("comment media upload validation", () => {
	it("detects supported image signatures", () => {
		expect(detectCommentImageMimeType(pngBytes())).toBe("image/png");
		expect(detectCommentImageMimeType(jpgBytes)).toBe("image/jpeg");
		expect(detectCommentImageMimeType(webpBytes)).toBe("image/webp");
	});

	it("extracts dimensions before accepting images", () => {
		expect(getCommentImageDimensions(pngBytes())).toEqual({
			height: 100,
			width: 100,
		});
		expect(getCommentImageDimensions(jpgBytes)).toEqual({
			height: 100,
			width: 100,
		});
		expect(getCommentImageDimensions(webpBytes)).toEqual({
			height: 100,
			width: 100,
		});
	});

	it("accepts small PNG, JPG, and WebP uploads", () => {
		for (const [bytes, type, name] of [
			[pngBytes(), "image/png", "screen.png"],
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
				bytes: pngBytes(),
				name: "huge.png",
				size: 3 * 1024 * 1024 + 1,
				type: "image/png",
			}),
		).toBe("Keep comment images under 3MB.");
	});

	it("rejects image dimensions that are risky to decode", () => {
		const oversizedPng = pngBytes(5000, 100);

		expect(
			getCommentImageUploadIssue({
				bytes: oversizedPng,
				name: "wide.png",
				size: oversizedPng.length,
				type: "image/png",
			}),
		).toBe("Choose an image under 4096px per side.");
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
