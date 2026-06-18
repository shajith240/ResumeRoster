import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
	detectAvatarImageMimeType,
	getAvatarImageExtension,
	getAvatarImageUploadIssue,
	type AvatarImageMimeType,
} from "@/lib/avatar-validation";
import { capturePrivateError } from "@/lib/monitoring/capture-errors";
import { requireSignedInUser, serverAuthErrorResponse } from "@/lib/server-auth";
import { enforceApiRateLimit } from "@/lib/server/rate-limit";
import { enforceUploadSecurity } from "@/lib/server/upload-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AVATAR_UPLOAD_FAILED_MESSAGE =
	"Profile image upload failed. Please try again.";
const AVATAR_DELETE_FAILED_MESSAGE =
	"Profile image cleanup failed. Please try again.";

function badRequest(message: string, status = 400) {
	return Response.json({ message }, { status });
}

function uploadFailure() {
	return Response.json(
		{ message: AVATAR_UPLOAD_FAILED_MESSAGE },
		{ status: 500 },
	);
}

function deleteFailure() {
	return Response.json(
		{ message: AVATAR_DELETE_FAILED_MESSAGE },
		{ status: 500 },
	);
}

function isOwnedAvatarPath(path: string, userId: string) {
	return path.startsWith(`${userId}/`) && !path.includes("..");
}

async function removeAvatarPath(
	admin: SupabaseClient,
	userId: string,
	avatarPath: string,
) {
	if (!isOwnedAvatarPath(avatarPath, userId)) {
		return badRequest("Choose a valid profile image.", 400);
	}

	const { error } = await admin.storage.from("avatars").remove([avatarPath]);
	if (error) {
		capturePrivateError(error, {
			area: "profile",
			operation: "delete_avatar",
			route: "api/profile/avatar",
		});
		return deleteFailure();
	}

	return Response.json({ ok: true });
}

export async function POST(request: Request) {
	try {
		const { admin, user } = await requireSignedInUser(request);
		const formData = await request.formData().catch(() => null);
		const file = formData?.get("file");

		if (!file || !(file instanceof File)) {
			return badRequest("Upload a PNG, JPG, or WebP profile image.");
		}

		const rateLimitResponse = await enforceApiRateLimit(
			admin,
			user.id,
			"avatarUpload",
		);
		if (rateLimitResponse) return rateLimitResponse;

		const bytes = new Uint8Array(await file.arrayBuffer());
		const issue = getAvatarImageUploadIssue({
			bytes,
			name: file.name,
			size: file.size,
			type: file.type,
		});

		if (issue) return badRequest(issue);

		const mimeType = detectAvatarImageMimeType(bytes) as AvatarImageMimeType;
		const security = await enforceUploadSecurity(admin, {
			bytes,
			fileName: file.name,
			fileSize: file.size,
			mimeType,
			uploadKind: "avatar",
			userId: user.id,
		});

		if (!security.ok) {
			return badRequest(security.message, security.status);
		}

		const extension = getAvatarImageExtension(mimeType);
		const storagePath = `${user.id}/${Date.now()}-${randomUUID()}.${extension}`;
		const upload = await admin.storage.from("avatars").upload(storagePath, bytes, {
			contentType: mimeType,
			upsert: false,
		});

		if (upload.error) {
			capturePrivateError(upload.error, {
				area: "profile",
				operation: "upload_avatar",
				route: "api/profile/avatar",
			});
			return uploadFailure();
		}

		return Response.json({
			avatar_path: storagePath,
			avatar_url: admin.storage.from("avatars").getPublicUrl(storagePath).data
				.publicUrl,
		});
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			capturePrivateError(error, {
				area: "profile",
				operation: "upload_avatar",
				route: "api/profile/avatar",
			});
			return uploadFailure();
		}

		return serverAuthErrorResponse(error);
	}
}

export async function DELETE(request: Request) {
	try {
		const { admin, user } = await requireSignedInUser(request);
		const payload = (await request.json().catch(() => null)) as
			| { avatarPath?: unknown }
			| null;
		const avatarPath =
			typeof payload?.avatarPath === "string" ? payload.avatarPath.trim() : "";

		if (!avatarPath) {
			return badRequest("Choose a valid profile image.", 400);
		}

		return removeAvatarPath(admin, user.id, avatarPath);
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			capturePrivateError(error, {
				area: "profile",
				operation: "delete_avatar",
				route: "api/profile/avatar",
			});
			return deleteFailure();
		}

		return serverAuthErrorResponse(error);
	}
}
