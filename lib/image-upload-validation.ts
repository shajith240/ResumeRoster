export const RASTER_IMAGE_ALLOWED_MIME_TYPES = [
	"image/png",
	"image/jpeg",
	"image/webp",
] as const;

export type RasterImageMimeType =
	(typeof RASTER_IMAGE_ALLOWED_MIME_TYPES)[number];

function hasBytes(bytes: Uint8Array, values: number[], offset = 0) {
	return values.every((value, index) => bytes[offset + index] === value);
}

export function detectRasterImageMimeType(
	bytes: Uint8Array,
): RasterImageMimeType | "" {
	if (hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
		return "image/png";
	}

	if (hasBytes(bytes, [0xff, 0xd8, 0xff])) {
		return "image/jpeg";
	}

	if (
		hasBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
		hasBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8)
	) {
		return "image/webp";
	}

	return "";
}

export function getRasterImageExtension(mimeType: RasterImageMimeType) {
	switch (mimeType) {
		case "image/jpeg":
			return "jpg";
		case "image/webp":
			return "webp";
		default:
			return "png";
	}
}
