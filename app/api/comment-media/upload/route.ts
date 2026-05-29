import {
	detectCommentImageMimeType,
	getCommentImageExtension,
	getCommentImageUploadIssue,
	type CommentImageMimeType,
} from "@/lib/comment-media-validation";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireSignedInUser, serverAuthErrorResponse } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function badRequest(message: string, status = 400) {
	return Response.json({ message }, { status });
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

export async function POST(request: Request) {
	try {
		const { admin, user } = await requireSignedInUser(request);
		await enforceRateLimit(admin, {
			action: "comment_media_upload",
			limit: 20,
			request,
			userId: user.id,
			windowSeconds: 60 * 60,
		});

		const formData = await request.formData().catch(() => null);
		const file = formData?.get("file");

		if (!file || !(file instanceof File)) {
			return badRequest("Upload a PNG, JPG, or WebP image.");
		}

		const bytes = new Uint8Array(await file.arrayBuffer());
		const issue = getCommentImageUploadIssue({
			bytes,
			name: file.name,
			size: file.size,
			type: file.type,
		});

		if (issue) return badRequest(issue);

		const mimeType = detectCommentImageMimeType(bytes) as CommentImageMimeType;
		const extension = getCommentImageExtension(mimeType);
		const storagePath = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
		const title = cleanTitle(file.name);

		const upload = await admin.storage
			.from("comment-media")
			.upload(storagePath, bytes, {
				contentType: mimeType,
				upsert: false,
			});

		if (upload.error) {
			console.error("Comment media upload failed", upload.error);
			throw new Error("comment-media-upload-failed");
		}

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
			void admin.storage.from("comment-media").remove([storagePath]);
			console.error("Comment attachment insert failed", insert.error);
			throw new Error("comment-attachment-insert-failed");
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
			return Response.json(
				{ message: "We could not upload this image." },
				{ status: 500 },
			);
		}

		return serverAuthErrorResponse(error);
	}
}
