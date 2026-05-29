export const COMMENT_IMAGE_MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024;
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
