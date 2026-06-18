import { describe, expect, it } from "vitest";
import {
	detectAvatarImageMimeType,
	getAvatarImageUploadIssue,
} from "@/lib/avatar-validation";

const pngBytes = new Uint8Array([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const jpgBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const webpBytes = new Uint8Array([
	0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
const gifBytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const svgBytes = new TextEncoder().encode("<svg onload=alert(1)></svg>");

describe("avatar upload validation", () => {
	it("detects supported public avatar image signatures", () => {
		expect(detectAvatarImageMimeType(pngBytes)).toBe("image/png");
		expect(detectAvatarImageMimeType(jpgBytes)).toBe("image/jpeg");
		expect(detectAvatarImageMimeType(webpBytes)).toBe("image/webp");
	});

	it("accepts small PNG, JPG, and WebP avatars", () => {
		for (const [bytes, type, name] of [
			[pngBytes, "image/png", "avatar.png"],
			[jpgBytes, "image/jpeg", "avatar.jpg"],
			[webpBytes, "image/webp", "avatar.webp"],
		] as const) {
			expect(
				getAvatarImageUploadIssue({
					bytes,
					name,
					size: bytes.length,
					type,
				}),
			).toBe("");
		}
	});

	it("rejects scriptable, animated, and spoofed avatar uploads", () => {
		expect(
			getAvatarImageUploadIssue({
				bytes: svgBytes,
				name: "avatar.svg",
				size: svgBytes.length,
				type: "image/svg+xml",
			}),
		).toBe("Upload a PNG, JPG, or WebP profile image.");

		expect(
			getAvatarImageUploadIssue({
				bytes: gifBytes,
				name: "avatar.gif",
				size: gifBytes.length,
				type: "image/gif",
			}),
		).toBe("Upload a PNG, JPG, or WebP profile image.");

		expect(
			getAvatarImageUploadIssue({
				bytes: webpBytes,
				name: "avatar.png",
				size: webpBytes.length,
				type: "image/png",
			}),
		).toBe("The profile image type does not match its contents.");
	});

	it("enforces the 5MB profile image limit", () => {
		expect(
			getAvatarImageUploadIssue({
				bytes: pngBytes,
				name: "avatar.png",
				size: 5 * 1024 * 1024 + 1,
				type: "image/png",
			}),
		).toBe("Profile image must be 5 MB or smaller.");
	});
});
