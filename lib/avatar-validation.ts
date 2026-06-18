import {
	RASTER_IMAGE_ALLOWED_MIME_TYPES,
	detectRasterImageMimeType,
	getRasterImageExtension,
	type RasterImageMimeType,
} from "@/lib/image-upload-validation";

export const AVATAR_IMAGE_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const AVATAR_IMAGE_ALLOWED_MIME_TYPES = RASTER_IMAGE_ALLOWED_MIME_TYPES;

export type AvatarImageMimeType = RasterImageMimeType;

export type AvatarImageFileInput = {
	bytes: Uint8Array;
	name: string;
	size: number;
	type: string;
};

export const detectAvatarImageMimeType = detectRasterImageMimeType;
export const getAvatarImageExtension = getRasterImageExtension;

export function getAvatarImageUploadIssue(file: AvatarImageFileInput) {
	const declaredType = file.type.toLowerCase();
	const detectedType = detectAvatarImageMimeType(file.bytes);

	if (!file.name.trim()) return "Choose a profile image.";
	if (!file.size || !file.bytes.length) return "Choose a non-empty profile image.";
	if (file.size > AVATAR_IMAGE_MAX_FILE_SIZE_BYTES) {
		return "Profile image must be 5 MB or smaller.";
	}

	if (
		!detectedType ||
		!AVATAR_IMAGE_ALLOWED_MIME_TYPES.includes(declaredType as AvatarImageMimeType)
	) {
		return "Upload a PNG, JPG, or WebP profile image.";
	}

	if (declaredType && declaredType !== detectedType) {
		return "The profile image type does not match its contents.";
	}

	return "";
}
