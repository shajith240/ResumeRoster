import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { capturePrivateError } from "@/lib/monitoring/capture-errors";
import { requireSignedInUser, serverAuthErrorResponse } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DeleteUserAppDataResult = {
	audit_log_id: string;
	avatar_paths: string[] | null;
	comment_media_paths: string[] | null;
	community_post_media_paths: string[] | null;
	deleted_counts: Record<string, unknown> | null;
	resume_paths: string[] | null;
};

async function removeStorageObjects(
	admin: SupabaseClient,
	bucket: string,
	paths: Array<string | null | undefined>,
) {
	const unique = [...new Set(paths.map((p) => p?.trim()).filter(Boolean) as string[])];
	if (!unique.length) return 0;

	for (let i = 0; i < unique.length; i += 1000) {
		const { error } = await admin.storage.from(bucket).remove(unique.slice(i, i + 1000));
		if (error) throw new Error(`${bucket}: ${error.message}`);
	}
	return unique.length;
}

async function listStorageFolder(
	admin: SupabaseClient,
	bucket: string,
	userId: string,
): Promise<string[]> {
	const paths: string[] = [];
	let offset = 0;

	while (true) {
		const { data, error } = await admin.storage.from(bucket).list(userId, { limit: 1000, offset });

		if (error) return paths; // treat missing/empty folder as non-fatal
		const batch = data ?? [];
		paths.push(
			...batch.filter((item) => item.name && item.id).map((item) => `${userId}/${item.name}`),
		);
		if (batch.length < 1000) break;
		offset += 1000;
	}

	return paths;
}

async function tryUpdateAuditMetadata(
	admin: SupabaseClient,
	auditLogId: string,
	metadata: Record<string, unknown>,
) {
	try {
		await admin.from("moderation_actions").update({ metadata }).eq("id", auditLogId);
	} catch {
		// Never mask the real error just because audit update fails.
	}
}

export async function DELETE(request: Request) {
	let signedIn: Awaited<ReturnType<typeof requireSignedInUser>>;
	try {
		signedIn = await requireSignedInUser(request, {
			missingTokenMessage: "Sign in to delete your account.",
			setupMessage: "Server setup is missing.",
		});
	} catch (error) {
		return serverAuthErrorResponse(error);
	}
	const { admin, user } = signedIn;

	let reason = "";
	try {
		const body = await request.json();
		if (typeof body?.reason === "string") reason = body.reason.trim().slice(0, 500);
	} catch {
		// body is optional
	}

	// Idempotency guard: a previous deletion request for this user already ran.
	const existing = await admin
		.from("moderation_actions")
		.select("id")
		.eq("action", "delete_user_account")
		.eq("target_type", "user")
		.eq("target_id", user.id)
		.maybeSingle();

	if (existing.data) {
		return NextResponse.json({ deleted: true });
	}

	// Create the audit log first — the RPC validates it by ID as a safety lock.
	const logResult = await admin
		.from("moderation_actions")
		.insert({
			action: "delete_user_account",
			admin_user_id: user.id, // self — FK ON DELETE SET NULL clears this automatically
			metadata: {
				delete_status: "started",
				requested_by: "self",
				storage_cleanup: { status: "not_started" },
			},
			reason: reason || "Self-requested account deletion",
			target_id: user.id,
			target_type: "user",
		})
		.select("id,metadata")
		.single();

	if (logResult.error) {
		capturePrivateError(logResult.error, {
			area: "account",
			operation: "delete_audit_log_insert",
			userId: user.id,
		});
		return NextResponse.json(
			{ message: "Could not start account deletion. Please try again." },
			{ status: 500 },
		);
	}

	const auditLogId = logResult.data.id;
	let appData: DeleteUserAppDataResult | null = null;

	try {
		// Atomically anonymize + hard-delete all user data and child rows.
		const rpcResult = await admin.rpc("admin_delete_user_app_data", {
			deletion_audit_log_id: auditLogId,
			target_user_id: user.id,
		});

		if (rpcResult.error) throw new Error(rpcResult.error.message);

		const rows = rpcResult.data as DeleteUserAppDataResult[] | null;
		appData = Array.isArray(rows) ? (rows[0] ?? null) : (rows as DeleteUserAppDataResult | null);

		if (!appData) throw new Error("Deletion RPC returned no result.");

		// List storage folders in parallel so orphaned files are also caught.
		const [resumeFolderPaths, avatarFolderPaths, commentMediaPaths, communityMediaPaths] =
			await Promise.all([
				listStorageFolder(admin, "resumes", user.id),
				listStorageFolder(admin, "avatars", user.id),
				listStorageFolder(admin, "comment-media", user.id),
				listStorageFolder(admin, "community-post-media", user.id),
			]);

		// Remove storage objects bucket-by-bucket — merge RPC-reported paths with folder scan.
		await Promise.all([
			removeStorageObjects(admin, "resumes", [
				...(appData.resume_paths ?? []),
				...resumeFolderPaths,
			]),
			removeStorageObjects(admin, "avatars", [
				...(appData.avatar_paths ?? []),
				...avatarFolderPaths,
			]),
			removeStorageObjects(admin, "comment-media", [
				...(appData.comment_media_paths ?? []),
				...commentMediaPaths,
			]),
			removeStorageObjects(admin, "community-post-media", [
				...(appData.community_post_media_paths ?? []),
				...communityMediaPaths,
			]),
		]);

		// Permanently delete the auth.users record — cascades profile deletion.
		const { error: authDeleteError } = await admin.auth.admin.deleteUser(user.id);
		if (authDeleteError) throw new Error(authDeleteError.message);

		await tryUpdateAuditMetadata(admin, auditLogId, {
			delete_status: "completed",
			requested_by: "self",
			auth_user_deleted: true,
			deletion_finished_at: new Date().toISOString(),
			removed_table_rows: appData.deleted_counts ?? {},
			storage_cleanup: { status: "completed" },
		});

		return NextResponse.json({ deleted: true });
	} catch (error) {
		capturePrivateError(error, {
			area: "account",
			operation: "delete_user",
			userId: user.id,
		});

		await tryUpdateAuditMetadata(admin, auditLogId, {
			delete_status: "failed",
			requested_by: "self",
			deletion_failed_at: new Date().toISOString(),
			delete_error: error instanceof Error ? error.message : "Unknown error",
			removed_table_rows: appData?.deleted_counts ?? {},
			storage_cleanup: { status: "partial" },
		});

		return NextResponse.json(
			{ message: "Account deletion failed. Please contact support." },
			{ status: 500 },
		);
	}
}
