export const COMMENT_IMAGE_MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024;
export const COMMENT_IMAGE_MAX_DIMENSION = 4096;
export const COMMENT_IMAGE_MAX_PIXELS = 12_000_000;
export const ROAST_CONTENT_MIN_LENGTH = 10;
export const ROAST_CONTENT_MAX_LENGTH = 4000;

export const COMMENT_IMAGE_ALLOWED_MIME_TYPES = [
	"image/png",
	"image/jpeg",
	"image/webp",
] as const;

export const COMMENT_CONTENT_FORMATS = ["plain", "markdown"] as const;

export type CommentImageMimeType =
	(typeof COMMENT_IMAGE_ALLOWED_MIME_TYPES)[number];
export type CommentContentFormat = (typeof COMMENT_CONTENT_FORMATS)[number];

export type CommentImageFileInput = {
	bytes: Uint8Array;
	name: string;
	size: number;
	type: string;
};

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hasBytes(bytes: Uint8Array, values: number[], offset = 0) {
	return values.every((value, index) => bytes[offset + index] === value);
}

function readUint16(bytes: Uint8Array, offset: number, littleEndian = false) {
	if (offset + 1 >= bytes.length) return 0;
	return littleEndian
		? bytes[offset] | (bytes[offset + 1] << 8)
		: (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint24(bytes: Uint8Array, offset: number) {
	if (offset + 2 >= bytes.length) return 0;
	return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readUint32(bytes: Uint8Array, offset: number) {
	if (offset + 3 >= bytes.length) return 0;
	return (
		(bytes[offset] << 24) |
		(bytes[offset + 1] << 16) |
		(bytes[offset + 2] << 8) |
		bytes[offset + 3]
	) >>> 0;
}

export function detectCommentImageMimeType(
	bytes: Uint8Array,
): CommentImageMimeType | "" {
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

export function getCommentImageDimensions(bytes: Uint8Array): {
	height: number;
	width: number;
} | null {
	const mimeType = detectCommentImageMimeType(bytes);

	if (mimeType === "image/png" && bytes.length >= 24) {
		return {
			height: readUint32(bytes, 20),
			width: readUint32(bytes, 16),
		};
	}

	if (mimeType === "image/jpeg") {
		let offset = 2;

		while (offset + 9 <= bytes.length) {
			if (bytes[offset] !== 0xff) return null;

			const marker = bytes[offset + 1];
			const segmentLength = readUint16(bytes, offset + 2);
			const isStartOfFrame =
				(marker >= 0xc0 && marker <= 0xc3) ||
				(marker >= 0xc5 && marker <= 0xc7) ||
				(marker >= 0xc9 && marker <= 0xcb) ||
				(marker >= 0xcd && marker <= 0xcf);

			if (isStartOfFrame) {
				return {
					height: readUint16(bytes, offset + 5),
					width: readUint16(bytes, offset + 7),
				};
			}

			if (!segmentLength) return null;
			offset += 2 + segmentLength;
		}

		return null;
	}

	if (mimeType === "image/webp" && bytes.length >= 30) {
		const chunkType = new TextDecoder().decode(bytes.slice(12, 16));

		if (chunkType === "VP8X") {
			return {
				height: readUint24(bytes, 27) + 1,
				width: readUint24(bytes, 24) + 1,
			};
		}

		if (chunkType === "VP8 " && hasBytes(bytes, [0x9d, 0x01, 0x2a], 23)) {
			return {
				height: readUint16(bytes, 28, true) & 0x3fff,
				width: readUint16(bytes, 26, true) & 0x3fff,
			};
		}

		if (chunkType === "VP8L" && bytes[20] === 0x2f) {
			const b0 = bytes[21];
			const b1 = bytes[22];
			const b2 = bytes[23];
			const b3 = bytes[24];
			return {
				height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
				width: 1 + (((b1 & 0x3f) << 8) | b0),
			};
		}
	}

	return null;
}

export function getCommentImageExtension(mimeType: CommentImageMimeType) {
	switch (mimeType) {
		case "image/jpeg":
			return "jpg";
		case "image/webp":
			return "webp";
		default:
			return "png";
	}
}

export function getCommentImageUploadIssue(file: CommentImageFileInput) {
	const declaredType = file.type.toLowerCase();
	const detectedType = detectCommentImageMimeType(file.bytes);

	if (!file.name.trim()) return "Choose an image file.";
	if (!file.size || !file.bytes.length) return "Choose a non-empty image file.";
	if (file.size > COMMENT_IMAGE_MAX_FILE_SIZE_BYTES) {
		return "Keep comment images under 3MB.";
	}

	if (
		!detectedType ||
		!COMMENT_IMAGE_ALLOWED_MIME_TYPES.includes(
			declaredType as CommentImageMimeType,
		)
	) {
		return "Upload a PNG, JPG, or WebP image.";
	}

	if (declaredType && declaredType !== detectedType) {
		return "The image file type does not match its contents.";
	}

	const dimensions = getCommentImageDimensions(file.bytes);
	if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
		return "Upload a valid PNG, JPG, or WebP image.";
	}

	if (
		dimensions.width > COMMENT_IMAGE_MAX_DIMENSION ||
		dimensions.height > COMMENT_IMAGE_MAX_DIMENSION ||
		dimensions.width * dimensions.height > COMMENT_IMAGE_MAX_PIXELS
	) {
		return "Choose an image under 4096px per side.";
	}

	return "";
}

export function isCommentContentFormat(
	value: unknown,
): value is CommentContentFormat {
	return COMMENT_CONTENT_FORMATS.includes(value as CommentContentFormat);
}

export function getRoastContentIssue({
	attachmentId,
	content,
	contentFormat,
}: {
	attachmentId?: string | null;
	content: string;
	contentFormat: unknown;
}) {
	const normalizedContent = content.trim();

	if (normalizedContent.length < ROAST_CONTENT_MIN_LENGTH) {
		return "Write at least 10 characters of useful feedback.";
	}

	if (normalizedContent.length > ROAST_CONTENT_MAX_LENGTH) {
		return "Keep feedback under 4000 characters.";
	}

	if (!isCommentContentFormat(contentFormat)) {
		return "Choose a valid comment format.";
	}

	if (attachmentId && !UUID_PATTERN.test(attachmentId)) {
		return "Choose a valid image.";
	}

	return "";
}
