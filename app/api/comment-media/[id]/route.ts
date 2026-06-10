import { requireSignedInUser, serverAuthErrorResponse } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
	params: Promise<{ id: string }>;
};

type DeleteCommentAttachmentResult = {
	id: string;
	storage_path: string | null;
};

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(message: string, status = 400) {
	return Response.json({ message }, { status });
}

function firstRpcRow(
	data:
		| DeleteCommentAttachmentResult[]
		| DeleteCommentAttachmentResult
		| null,
) {
	if (Array.isArray(data)) return data[0] ?? null;
	return data;
}

function publicDeleteError(message: string) {
	if (/already attached/i.test(message)) {
		return jsonResponse("Media is already attached to a comment.", 409);
	}

	if (/not found/i.test(message)) {
		return jsonResponse("Media was not found.", 404);
	}

	return jsonResponse("Media was not removed. Please try again.", 500);
}

export async function DELETE(request: Request, context: RouteContext) {
	try {
		const { id } = await context.params;
		if (!UUID_PATTERN.test(id)) {
			return jsonResponse("Media was not found.", 404);
		}

		const { admin, user } = await requireSignedInUser(request, {
			missingTokenMessage: "Sign in again before removing media.",
			setupMessage: "Server media setup is missing.",
		});

		const deleteResult = await admin.rpc("delete_unclaimed_comment_attachment", {
			target_attachment_id: id,
			target_user_id: user.id,
		});

		if (deleteResult.error) {
			return publicDeleteError(deleteResult.error.message);
		}

		const deletedAttachment = firstRpcRow(
			deleteResult.data as
				| DeleteCommentAttachmentResult[]
				| DeleteCommentAttachmentResult
				| null,
		);

		if (!deletedAttachment?.id) {
			return jsonResponse("Media was not removed. Please try again.", 500);
		}

		const storagePath = deletedAttachment.storage_path?.trim();
		let storageCleanupFailed = false;
		if (storagePath) {
			const { error: storageError } = await admin.storage
				.from("comment-media")
				.remove([storagePath]);

			if (storageError) {
				storageCleanupFailed = true;
				console.error("Comment media storage cleanup failed after DB delete", {
					attachmentId: id,
					message: storageError.message,
				});
			}
		}

		return Response.json({
			attachmentId: deletedAttachment.id,
			status: "ok",
			storageCleanupFailed,
		});
	} catch (error) {
		return serverAuthErrorResponse(error);
	}
}
