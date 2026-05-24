import { adminErrorResponse, requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
	params: Promise<{ id: string }>;
};

function badRequest(message: string, status = 400) {
	return Response.json({ message }, { status });
}

function cleanString(value: unknown, maxLength: number) {
	return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function PATCH(request: Request, context: RouteContext) {
	try {
		const { admin, user } = await requireAdmin(request);
		const { id } = await context.params;
		const payload = await request.json().catch(() => null);
		const status =
			typeof payload === "object" &&
			payload !== null &&
			"status" in payload &&
			(payload.status === "active" || payload.status === "hidden")
				? payload.status
				: null;
		const title = cleanString(
			typeof payload === "object" && payload !== null && "title" in payload
				? payload.title
				: undefined,
			80,
		);
		const altText = cleanString(
			typeof payload === "object" && payload !== null && "altText" in payload
				? payload.altText
				: undefined,
			160,
		);

		const updates: Record<string, string> = {};
		if (status) updates.status = status;
		if (title) updates.title = title;
		if (altText) updates.alt_text = altText;

		if (!Object.keys(updates).length) {
			return badRequest("Choose a sticker update.");
		}

		const update = await admin
			.from("stickers")
			.update(updates)
			.eq("id", id)
			.select("id,title,alt_text,storage_path,mime_type,file_size,status,created_by,created_at,updated_at")
			.single();

		if (update.error) throw new Error(update.error.message);

		if (status) {
			const logResult = await admin.from("moderation_actions").insert({
				action: status === "active" ? "show_sticker" : "hide_sticker",
				admin_user_id: user.id,
				metadata: {},
				reason: "",
				target_id: id,
				target_type: "sticker",
			});

			if (logResult.error) throw new Error(logResult.error.message);
		}

		return Response.json({
			sticker: {
				...update.data,
				publicUrl: admin.storage
					.from("stickers")
					.getPublicUrl(update.data.storage_path).data.publicUrl,
			},
		});
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return Response.json({ message: error.message }, { status: 500 });
		}
		return adminErrorResponse(error);
	}
}

export async function DELETE(request: Request, context: RouteContext) {
	try {
		const { admin, user } = await requireAdmin(request);
		const { id } = await context.params;

		const usage = await admin
			.from("roasts")
			.select("id", { count: "exact", head: true })
			.eq("sticker_id", id);
		if (usage.error) throw new Error(usage.error.message);
		if ((usage.count ?? 0) > 0) {
			return badRequest("Hide stickers that have already been used.", 409);
		}

		const sticker = await admin
			.from("stickers")
			.select("id,storage_path")
			.eq("id", id)
			.maybeSingle();
		if (sticker.error) throw new Error(sticker.error.message);
		if (!sticker.data) return badRequest("Sticker not found.", 404);

		const removeStorage = await admin.storage
			.from("stickers")
			.remove([sticker.data.storage_path]);
		if (removeStorage.error) throw new Error(removeStorage.error.message);

		const removeRow = await admin.from("stickers").delete().eq("id", id);
		if (removeRow.error) throw new Error(removeRow.error.message);

		const logResult = await admin.from("moderation_actions").insert({
			action: "delete_sticker",
			admin_user_id: user.id,
			metadata: { storage_path: sticker.data.storage_path },
			reason: "",
			target_id: id,
			target_type: "sticker",
		});
		if (logResult.error) throw new Error(logResult.error.message);

		return Response.json({ status: "ok" });
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return Response.json({ message: error.message }, { status: 500 });
		}
		return adminErrorResponse(error);
	}
}
