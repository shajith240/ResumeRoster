export const STICKER_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
export const STICKER_ALLOWED_MIME_TYPES = [
	"image/png",
	"image/webp",
	"image/gif",
] as const;
export const ROAST_CONTENT_MIN_LENGTH = 10;
export const ROAST_CONTENT_MAX_LENGTH = 4000;

export type StickerMimeType = (typeof STICKER_ALLOWED_MIME_TYPES)[number];

export type StickerFileInput = {
	bytes: Uint8Array;
	name: string;
	size: number;
	type: string;
};

export type RoastPayloadInput = {
	activeStickerIds?: Set<string>;
	content: string;
	stickerId?: string | null;
};

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function startsWith(bytes: Uint8Array, signature: number[]) {
	return signature.every((value, index) => bytes[index] === value);
}

export function detectStickerMimeType(bytes: Uint8Array): StickerMimeType | "" {
	if (
		bytes.length >= 8 &&
		startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
	) {
		return "image/png";
	}

	if (bytes.length >= 6) {
		const header = new TextDecoder().decode(bytes.slice(0, 6));
		if (header === "GIF87a" || header === "GIF89a") return "image/gif";
	}

	if (bytes.length >= 12) {
		const riff = new TextDecoder().decode(bytes.slice(0, 4));
		const webp = new TextDecoder().decode(bytes.slice(8, 12));
		if (riff === "RIFF" && webp === "WEBP") return "image/webp";
	}

	return "";
}

export function getStickerExtension(mimeType: StickerMimeType) {
	if (mimeType === "image/png") return "png";
	if (mimeType === "image/webp") return "webp";
	return "gif";
}

export function getStickerUploadIssue(file: StickerFileInput) {
	const declaredType = file.type.toLowerCase();
	const detectedType = detectStickerMimeType(file.bytes);

	if (!file.name.trim()) return "Choose a sticker file.";
	if (!file.size || !file.bytes.length) return "Choose a non-empty sticker file.";
	if (file.size > STICKER_MAX_FILE_SIZE_BYTES) {
		return "Keep stickers under 2MB.";
	}
	if (
		!STICKER_ALLOWED_MIME_TYPES.includes(
			declaredType as StickerMimeType,
		)
	) {
		return "Upload a PNG, WebP, or GIF sticker.";
	}
	if (!detectedType || detectedType !== declaredType) {
		return "The sticker file type does not match its contents.";
	}

	return "";
}

export function getRoastPayloadIssue({
	activeStickerIds,
	content,
	stickerId,
}: RoastPayloadInput) {
	const trimmedContent = content.trim();

	if (trimmedContent.length < ROAST_CONTENT_MIN_LENGTH) {
		return "Give at least 10 characters of useful feedback.";
	}
	if (trimmedContent.length > ROAST_CONTENT_MAX_LENGTH) {
		return "Keep roasts under 4000 characters.";
	}
	if (stickerId) {
		if (!UUID_PATTERN.test(stickerId)) {
			return "Choose a valid sticker.";
		}
		if (activeStickerIds && !activeStickerIds.has(stickerId)) {
			return "Choose an available sticker.";
		}
	}

	return "";
}
