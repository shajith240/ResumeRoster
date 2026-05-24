import { describe, expect, it } from "vitest";
import {
	STICKER_MAX_FILE_SIZE_BYTES,
	detectStickerMimeType,
	getRoastPayloadIssue,
	getStickerUploadIssue,
} from "@/lib/sticker-validation";

const pngBytes = new Uint8Array([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);
const gifBytes = new TextEncoder().encode("GIF89a sticker");
const webpBytes = new Uint8Array([
	0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

describe("sticker upload validation", () => {
	it("detects supported sticker signatures", () => {
		expect(detectStickerMimeType(pngBytes)).toBe("image/png");
		expect(detectStickerMimeType(gifBytes)).toBe("image/gif");
		expect(detectStickerMimeType(webpBytes)).toBe("image/webp");
	});

	it("accepts PNG, GIF, and WebP uploads", () => {
		expect(
			getStickerUploadIssue({
				bytes: pngBytes,
				name: "roast.png",
				size: pngBytes.length,
				type: "image/png",
			}),
		).toBe("");
		expect(
			getStickerUploadIssue({
				bytes: gifBytes,
				name: "roast.gif",
				size: gifBytes.length,
				type: "image/gif",
			}),
		).toBe("");
		expect(
			getStickerUploadIssue({
				bytes: webpBytes,
				name: "roast.webp",
				size: webpBytes.length,
				type: "image/webp",
			}),
		).toBe("");
	});

	it("rejects SVG, JPEG, renamed mismatches, and oversized files", () => {
		expect(
			getStickerUploadIssue({
				bytes: new TextEncoder().encode("<svg></svg>"),
				name: "script.svg",
				size: 11,
				type: "image/svg+xml",
			}),
		).toBe("Upload a PNG, WebP, or GIF sticker.");
		expect(
			getStickerUploadIssue({
				bytes: jpegBytes,
				name: "photo.jpg",
				size: jpegBytes.length,
				type: "image/jpeg",
			}),
		).toBe("Upload a PNG, WebP, or GIF sticker.");
		expect(
			getStickerUploadIssue({
				bytes: pngBytes,
				name: "fake.gif",
				size: pngBytes.length,
				type: "image/gif",
			}),
		).toBe("The sticker file type does not match its contents.");
		expect(
			getStickerUploadIssue({
				bytes: pngBytes,
				name: "huge.png",
				size: STICKER_MAX_FILE_SIZE_BYTES + 1,
				type: "image/png",
			}),
		).toBe("Keep stickers under 2MB.");
	});
});

describe("roast sticker payload validation", () => {
	const stickerId = "1bd2bea3-d892-4d46-97cd-98a558846fd3";

	it("requires useful text even when a sticker is selected", () => {
		expect(
			getRoastPayloadIssue({
				content: "lol",
				stickerId,
			}),
		).toBe("Give at least 10 characters of useful feedback.");
	});

	it("accepts useful text with one active sticker", () => {
		expect(
			getRoastPayloadIssue({
				activeStickerIds: new Set([stickerId]),
				content: "This bullet needs stronger proof.",
				stickerId,
			}),
		).toBe("");
	});

	it("rejects missing or malformed sticker ids", () => {
		expect(
			getRoastPayloadIssue({
				activeStickerIds: new Set([stickerId]),
				content: "This bullet needs stronger proof.",
				stickerId: "not-a-sticker",
			}),
		).toBe("Choose a valid sticker.");
		expect(
			getRoastPayloadIssue({
				activeStickerIds: new Set(),
				content: "This bullet needs stronger proof.",
				stickerId,
			}),
		).toBe("Choose an available sticker.");
	});
});
