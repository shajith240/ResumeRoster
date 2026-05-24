import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import {
	detectStickerMimeType,
	getStickerExtension,
	getStickerUploadIssue,
	type StickerMimeType,
} from "@/lib/sticker-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function badRequest(message: string, status = 400) {
	return Response.json({ message }, { status });
}

function cleanStickerTitle(value: FormDataEntryValue | null, fileName = "Sticker") {
	const raw =
		typeof value === "string" && value.trim()
			? value.trim()
			: fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ");

	return raw.slice(0, 80) || "Sticker";
}

function cleanStickerAltText(value: FormDataEntryValue | null, title: string) {
	const raw = typeof value === "string" && value.trim() ? value.trim() : title;
	return raw.slice(0, 160);
}

function withPublicUrl(admin: Awaited<ReturnType<typeof requireAdmin>>["admin"], row: Record<string, unknown>) {
	const storagePath = String(row.storage_path ?? "");
	return {
		...row,
		publicUrl: admin.storage.from("stickers").getPublicUrl(storagePath).data.publicUrl,
	};
}

export async function GET(request: Request) {
	try {
		const { admin } = await requireAdmin(request);
		const { data, error } = await admin
			.from("stickers")
			.select("id,title,alt_text,storage_path,mime_type,file_size,status,created_by,created_at,updated_at")
			.order("created_at", { ascending: false });

		if (error) throw new Error(error.message);

		return Response.json({
			stickers: (data ?? []).map((row) => withPublicUrl(admin, row)),
		});
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return Response.json({ message: error.message }, { status: 500 });
		}
		return adminErrorResponse(error);
	}
}

export async function POST(request: Request) {
	try {
		const { admin, user } = await requireAdmin(request);
		const formData = await request.formData();
		const file = formData.get("file");

		if (!file || !(file instanceof File)) {
			return badRequest("Drop a PNG, WebP, or GIF sticker.");
		}

		const bytes = new Uint8Array(await file.arrayBuffer());
		const issue = getStickerUploadIssue({
			bytes,
			name: file.name,
			size: file.size,
			type: file.type,
		});

		if (issue) return badRequest(issue);

		const mimeType = detectStickerMimeType(bytes) as StickerMimeType;
		const extension = getStickerExtension(mimeType);
		const storagePath = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
		const title = cleanStickerTitle(formData.get("title"), file.name);
		const altText = cleanStickerAltText(formData.get("altText"), title);

		const upload = await admin.storage.from("stickers").upload(storagePath, bytes, {
			contentType: mimeType,
			upsert: false,
		});

		if (upload.error) throw new Error(upload.error.message);

		const insert = await admin
			.from("stickers")
			.insert({
				alt_text: altText,
				created_by: user.id,
				file_size: file.size,
				mime_type: mimeType,
				status: "active",
				storage_path: storagePath,
				title,
			})
			.select("id,title,alt_text,storage_path,mime_type,file_size,status,created_by,created_at,updated_at")
			.single();

		if (insert.error) {
			void admin.storage.from("stickers").remove([storagePath]);
			throw new Error(insert.error.message);
		}

		const logResult = await admin.from("moderation_actions").insert({
			action: "upload_sticker",
			admin_user_id: user.id,
			metadata: { mime_type: mimeType, storage_path: storagePath },
			reason: title,
			target_id: insert.data.id,
			target_type: "sticker",
		});

		if (logResult.error) throw new Error(logResult.error.message);

		return Response.json({
			sticker: withPublicUrl(admin, insert.data),
		});
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return Response.json({ message: error.message }, { status: 500 });
		}
		return adminErrorResponse(error);
	}
}
