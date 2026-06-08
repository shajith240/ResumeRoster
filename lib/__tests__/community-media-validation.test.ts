import { describe, expect, it } from "vitest";
import {
	COMMUNITY_POST_IMAGE_MAX_FILE_SIZE_BYTES,
	detectCommunityPostImageMimeType,
	getCommunityPostImageClientIssue,
	getCommunityPostImageUploadIssue,
} from "@/lib/community-media-validation";

const pngBytes = new Uint8Array([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

describe("community post image validation", () => {
	it("detects supported raster image signatures", () => {
		expect(detectCommunityPostImageMimeType(pngBytes)).toBe("image/png");
	});

	it("rejects unsupported client image types and oversized files", () => {
		expect(
			getCommunityPostImageClientIssue({
				name: "diagram.svg",
				size: 120,
				type: "image/svg+xml",
			}),
		).toBe("Upload a PNG, JPG, or WebP image.");

		expect(
			getCommunityPostImageClientIssue({
				name: "large.png",
				size: COMMUNITY_POST_IMAGE_MAX_FILE_SIZE_BYTES + 1,
				type: "image/png",
			}),
		).toBe("Keep post images under 5MB.");
	});

	it("rejects spoofed upload content", () => {
		expect(
			getCommunityPostImageUploadIssue({
				bytes: pngBytes,
				name: "spoof.jpg",
				size: pngBytes.byteLength,
				type: "image/jpeg",
			}),
		).toBe("The image file type does not match its contents.");
	});
});
