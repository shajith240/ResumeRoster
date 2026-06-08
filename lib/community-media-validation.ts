import {
	RASTER_IMAGE_ALLOWED_MIME_TYPES,
	detectRasterImageMimeType,
	getRasterImageExtension,
	type RasterImageMimeType,
} from "@/lib/image-upload-validation";

export const COMMUNITY_POST_IMAGE_MAX_COUNT = 4;
export const COMMUNITY_POST_IMAGE_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const COMMUNITY_POST_IMAGE_ALLOWED_MIME_TYPES =
	RASTER_IMAGE_ALLOWED_MIME_TYPES;

export type CommunityPostImageMimeType = RasterImageMimeType;

export type CommunityPostImageFileInput = {
	bytes: Uint8Array;
	name: string;
	size: number;
	type: string;
};

export type CommunityPostImageClientInput = {
	name: string;
	size: number;
	type: string;
};

export const detectCommunityPostImageMimeType = detectRasterImageMimeType;
export const getCommunityPostImageExtension = getRasterImageExtension;

export function getCommunityPostImageClientIssue(
	file: CommunityPostImageClientInput,
) {
	if (!file.name.trim()) return "Choose an image file.";
	if (!file.size) return "Choose a non-empty image file.";
	if (file.size > COMMUNITY_POST_IMAGE_MAX_FILE_SIZE_BYTES) {
		return "Keep post images under 5MB.";
	}

	if (
		!COMMUNITY_POST_IMAGE_ALLOWED_MIME_TYPES.includes(
			file.type.toLowerCase() as CommunityPostImageMimeType,
		)
	) {
		return "Upload a PNG, JPG, or WebP image.";
	}

	return "";
}

export function getCommunityPostImageUploadIssue(
	file: CommunityPostImageFileInput,
) {
	const clientIssue = getCommunityPostImageClientIssue(file);
	if (clientIssue) return clientIssue;

	const declaredType = file.type.toLowerCase();
	const detectedType = detectCommunityPostImageMimeType(file.bytes);

	if (!detectedType) return "Upload a PNG, JPG, or WebP image.";

	if (declaredType && declaredType !== detectedType) {
		return "The image file type does not match its contents.";
	}

	return "";
}
