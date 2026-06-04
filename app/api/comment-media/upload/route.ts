import type { SupabaseClient } from "@supabase/supabase-js";
import {
	detectCommentImageMimeType,
	getCommentImageExtension,
	getCommentImageUploadIssue,
	type CommentImageMimeType,
} from "@/lib/comment-media-validation";
import { requireSignedInUser, serverAuthErrorResponse } from "@/lib/server-auth";
import { enforceApiRateLimit } from "@/lib/server/rate-limit";
import { enforceUploadSecurity } from "@/lib/server/upload-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMMENT_IMAGE_UPLOAD_FAILED_MESSAGE =
	"Image upload failed. Please try again.";

function badRequest(message: string, status = 400) {
	return Response.json({ message }, { status });
}

function uploadFailure() {
	return Response.json(
		{ message: COMMENT_IMAGE_UPLOAD_FAILED_MESSAGE },
		{ status: 500 },
	);
}

function cleanTitle(fileName: string) {
	return (
		fileName
			.replace(/\.[a-z0-9]+$/i, "")
			.replace(/[-_]+/g, " ")
			.trim()
			.slice(0, 120) || "Comment image"
	);
}

async function removeUploadedFile(
	admin: SupabaseClient,
	bucket: string,
	storagePath: string,
) {
	try {
		await admin.storage.from(bucket).remove([storagePath]);
	} catch {
		// The client still gets the original upload failure response.
	}
}

export async function POST(request: Request) {
	try {
		const { admin, user } = await requireSignedInUser(request);
		const formData = await request.formData().catch(() => null);
		const file = formData?.get("file");

		if (!file || !(file instanceof File)) {
			return badRequest("Upload a PNG, JPG, or WebP image.");
		}

		const rateLimitResponse = await enforceApiRateLimit(
			admin,
			user.id,
			"commentMediaUpload",
		);
		if (rateLimitResponse) return rateLimitResponse;

		const bytes = new Uint8Array(await file.arrayBuffer());
		const issue = getCommentImageUploadIssue({
			bytes,
			name: file.name,
			size: file.size,
			type: file.type,
		});

		if (issue) return badRequest(issue);

		const mimeType = detectCommentImageMimeType(bytes) as CommentImageMimeType;
		const uploadSecurity = await enforceUploadSecurity(admin, {
			bytes,
			fileName: file.name,
			fileSize: file.size,
			mimeType,
			uploadKind: "comment-media",
			userId: user.id,
		});

		if (!uploadSecurity.ok) {
			return badRequest(uploadSecurity.message, uploadSecurity.status);
		}

		const extension = getCommentImageExtension(mimeType);
		const storagePath = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
		const title = cleanTitle(file.name);

		const upload = await admin.storage
			.from("comment-media")
			.upload(storagePath, bytes, {
				contentType: mimeType,
				upsert: false,
			});

		if (upload.error) return uploadFailure();

		const insert = await admin
			.from("comment_attachments")
			.insert({
				alt_text: title,
				file_size: file.size,
				kind: "image",
				mime_type: mimeType,
				source: "upload",
				storage_path: storagePath,
				title,
				user_id: user.id,
			})
			.select("id,kind,source,storage_path,title,alt_text,mime_type,file_size,created_at")
			.single();

		if (insert.error) {
			await removeUploadedFile(admin, "comment-media", storagePath);
			return uploadFailure();
		}

		return Response.json({
			attachment: {
				...insert.data,
				publicUrl: admin.storage.from("comment-media").getPublicUrl(storagePath)
					.data.publicUrl,
			},
		});
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return uploadFailure();
		}

		return serverAuthErrorResponse(error);
	}
}
