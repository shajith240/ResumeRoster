import type { SupabaseClient } from "@supabase/supabase-js";
import { adminErrorResponse, isAdminEmail, requireAdmin } from "@/lib/admin";
import { internalErrorResponse } from "@/lib/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminUserAction =
	| "delete_user_account"
	| "reset_reviewer_trust"
	| "clear_public_profile_text"
	| "clear_reviewer_profile";

type RouteContext = {
	params: Promise<{ id: string }>;
};

type DeleteStage =
	| "db_delete"
	| "storage_cleanup"
	| "auth_delete"
	| "completed";
type DeleteFailureStatus =
	| "auth_delete_failed"
	| "db_delete_failed"
	| "storage_cleanup_failed";
type DeleteAuditStatus = DeleteStage | DeleteFailureStatus;

type DeleteUserAppDataResult = {
	audit_log_id: string;
	avatar_paths: string[] | null;
	comment_media_paths: string[] | null;
	community_post_media_paths: string[] | null;
	deleted_counts: Record<string, unknown> | null;
	resume_paths: string[] | null;
};

type StorageRemovalCounts = {
	avatars: number;
	commentMedia: number;
	communityPostMedia: number;
	resumes: number;
};

const ACTIONS = new Set<AdminUserAction>([
	"delete_user_account",
	"reset_reviewer_trust",
	"clear_public_profile_text",
	"clear_reviewer_profile",
]);

function badRequest(message: string, status = 400) {
	return Response.json({ message }, { status });
}

function normalizeNote(value: unknown) {
	return typeof value === "string" ? value.trim().slice(0, 800) : "";
}

function uniqueStrings(values: Array<string | null | undefined>) {
	return Array.from(
		new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]),
	);
}

async function removeStorageObjects(
	admin: SupabaseClient,
	bucket: string,
	paths: Array<string | null | undefined>,
) {
	const uniquePaths = uniqueStrings(paths);
	if (!uniquePaths.length) return 0;

	for (let index = 0; index < uniquePaths.length; index += 1000) {
		const { error } = await admin.storage
			.from(bucket)
			.remove(uniquePaths.slice(index, index + 1000));
		if (error) throw new Error(error.message);
	}

	return uniquePaths.length;
}

async function listUserStorageFolder(
	admin: SupabaseClient,
	bucket: string,
	userId: string,
) {
	const paths: string[] = [];
	let offset = 0;

	while (true) {
		const { data, error } = await admin.storage
			.from(bucket)
			.list(userId, { limit: 1000, offset });

		if (error) throw new Error(`${bucket}: ${error.message}`);

		const batch = data ?? [];
		paths.push(
			...batch
				.filter((item) => item.name && item.id)
				.map((item) => `${userId}/${item.name}`),
		);

		if (batch.length < 1000) break;
		offset += 1000;
	}

	return paths;
}

async function listOptionalUserStorageFolder(
	admin: SupabaseClient,
	bucket: string,
	userId: string,
) {
	try {
		return await listUserStorageFolder(admin, bucket, userId);
	} catch (error) {
		const message = error instanceof Error ? error.message : "";
		if (/not found|does not exist|not exist/i.test(message)) return [];
		throw error;
	}
}

async function removeAccountStorageObjects(
	admin: SupabaseClient,
	profileId: string,
	appData: DeleteUserAppDataResult,
) {
	const [
		resumeFolderPaths,
		avatarFolderPaths,
		commentMediaFolderPaths,
		communityPostMediaFolderPaths,
	] = await Promise.all([
		listUserStorageFolder(admin, "resumes", profileId),
		listUserStorageFolder(admin, "avatars", profileId),
		listUserStorageFolder(admin, "comment-media", profileId),
		listOptionalUserStorageFolder(admin, "community-post-media", profileId),
	]);

	const removed: StorageRemovalCounts = {
		avatars: 0,
		commentMedia: 0,
		communityPostMedia: 0,
		resumes: 0,
	};

	removed.resumes = await removeStorageObjects(admin, "resumes", [
		...(appData.resume_paths ?? []),
		...resumeFolderPaths,
	]);
	removed.avatars = await removeStorageObjects(admin, "avatars", [
		...(appData.avatar_paths ?? []),
		...avatarFolderPaths,
	]);
	removed.commentMedia = await removeStorageObjects(admin, "comment-media", [
		...(appData.comment_media_paths ?? []),
		...commentMediaFolderPaths,
	]);
	removed.communityPostMedia = await removeStorageObjects(
		admin,
		"community-post-media",
		[
			...(appData.community_post_media_paths ?? []),
			...communityPostMediaFolderPaths,
		],
	);

	return removed;
}

function firstDeleteResult(
	data: DeleteUserAppDataResult[] | DeleteUserAppDataResult | null,
) {
	if (Array.isArray(data)) return data[0] ?? null;
	return data;
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : "Unknown deletion failure";
}

function deleteFailureStatus(stage: DeleteStage): DeleteFailureStatus {
	if (stage === "storage_cleanup") return "storage_cleanup_failed";
	if (stage === "auth_delete") return "auth_delete_failed";
	return "db_delete_failed";
}

function buildDeleteAuditMetadata({
	authUserDeleted = false,
	baseMetadata,
	error,
	stage,
	storageCounts,
	appData,
}: {
	authUserDeleted?: boolean;
	baseMetadata: Record<string, unknown>;
	error?: unknown;
	stage: DeleteAuditStatus;
	storageCounts: StorageRemovalCounts;
	appData: DeleteUserAppDataResult | null;
}) {
	const metadata: Record<string, unknown> = {
		...baseMetadata,
		auth_user_deleted: authUserDeleted,
		delete_status: stage,
		removed_storage_objects: storageCounts,
		removed_table_rows: appData?.deleted_counts ?? {},
		storage_cleanup: {
			status:
				stage === "completed" || stage === "auth_delete_failed"
					? "completed"
					: stage === "storage_cleanup_failed"
						? "failed"
						: "not_started",
		},
	};

	if (stage === "completed") {
		metadata.deletion_finished_at = new Date().toISOString();
	} else {
		metadata.deletion_failed_at = new Date().toISOString();
	}

	if (error) metadata.delete_error = errorMessage(error);

	return metadata;
}

async function tryUpdateDeleteAuditMetadata(
	admin: SupabaseClient,
	auditLogId: string,
	metadata: Record<string, unknown>,
) {
	try {
		await admin.from("moderation_actions").update({ metadata }).eq("id", auditLogId);
	} catch {
		// The destructive operation already reached its real state. Never make a
		// retry more dangerous because a best-effort audit metadata update failed.
	}
}

async function getPayload(request: Request) {
	try {
		return await request.json();
	} catch {
		return null;
	}
}

export async function POST(request: Request, context: RouteContext) {
	try {
		const { admin, user } = await requireAdmin(request);
		const { id: profileId } = await context.params;
		const payload = await getPayload(request);
		const action =
			typeof payload === "object" &&
			payload !== null &&
			"action" in payload &&
			typeof payload.action === "string"
				? payload.action
				: "";
		const note = normalizeNote(
			typeof payload === "object" && payload !== null && "note" in payload
				? payload.note
				: "",
		);

		if (!ACTIONS.has(action as AdminUserAction)) {
			return badRequest("Choose a valid profile action.");
		}

		if (profileId === user.id) {
			return badRequest("Use another admin account before moderating yourself.", 403);
		}

		if (action === "delete_user_account") {
			const confirm =
				typeof payload === "object" &&
				payload !== null &&
				"confirm" in payload &&
				typeof payload.confirm === "string"
					? payload.confirm
					: "";

			if (confirm !== "delete-user-data") {
				return badRequest("Confirm the irreversible user deletion first.");
			}

			const authUserResult = await admin.auth.admin.getUserById(profileId);
			if (authUserResult.error) throw new Error(authUserResult.error.message);

			const targetEmail = authUserResult.data.user?.email ?? null;
			if (isAdminEmail(targetEmail)) {
				return badRequest("Admin allowlist accounts cannot be deleted here.", 403);
			}

			const startedMetadata = {
				delete_status: "started",
				storage_cleanup: { status: "not_started" },
			};
			const logResult = await admin
				.from("moderation_actions")
				.insert({
					action,
					admin_user_id: user.id,
					metadata: startedMetadata,
					reason: note,
					target_id: profileId,
					target_type: "user",
				})
				.select("id,metadata")
				.single();

			if (logResult.error) throw new Error(logResult.error.message);

			let appDataCleanup: DeleteUserAppDataResult | null = null;
			let deleteStage: DeleteStage = "db_delete";
			let removedStorageObjects: StorageRemovalCounts = {
				avatars: 0,
				commentMedia: 0,
				communityPostMedia: 0,
				resumes: 0,
			};
			const baseMetadata = {
				...(logResult.data.metadata as Record<string, unknown>),
			};

			try {
				const appDataResult = await admin.rpc("admin_delete_user_app_data", {
					deletion_audit_log_id: logResult.data.id,
					target_user_id: profileId,
				});

				if (appDataResult.error) throw new Error(appDataResult.error.message);

				appDataCleanup = firstDeleteResult(
					appDataResult.data as DeleteUserAppDataResult[] | null,
				);

				if (!appDataCleanup) {
					throw new Error("Database deletion did not return an audit result.");
				}

				deleteStage = "storage_cleanup";
				removedStorageObjects = await removeAccountStorageObjects(
					admin,
					profileId,
					appDataCleanup,
				);

				deleteStage = "auth_delete";
				const deleteAuthUser = await admin.auth.admin.deleteUser(profileId);
				if (deleteAuthUser.error) throw new Error(deleteAuthUser.error.message);

				deleteStage = "completed";
				await tryUpdateDeleteAuditMetadata(
					admin,
					logResult.data.id,
					buildDeleteAuditMetadata({
						appData: appDataCleanup,
						authUserDeleted: true,
						baseMetadata,
						stage: deleteStage,
						storageCounts: removedStorageObjects,
					}),
				);

				return Response.json({
					deletedUserId: profileId,
					status: "ok",
				});
			} catch (deleteError) {
				await tryUpdateDeleteAuditMetadata(
					admin,
					logResult.data.id,
					buildDeleteAuditMetadata({
						appData: appDataCleanup,
						baseMetadata,
						error: deleteError,
						stage: deleteFailureStatus(deleteStage),
						storageCounts: removedStorageObjects,
					}),
				);

				throw deleteError;
			}
		}

		const profileResult = await admin
			.from("profiles")
			.select(
				"id,tagline,about,skills,community_role,reviewer_type,reviewer_headline,reviewer_bio,reviewer_expertise,reviewer_verification_status",
			)
			.eq("id", profileId)
			.maybeSingle();

		if (profileResult.error) throw new Error(profileResult.error.message);
		if (!profileResult.data) return badRequest("Profile not found.", 404);

		let profilePatch: Record<string, unknown> = {};

		if (action === "reset_reviewer_trust") {
			profilePatch = {
				reviewer_verification_status: "none",
				reviewer_verified_at: null,
				reviewer_verified_by: null,
			};
		}

		if (action === "clear_public_profile_text") {
			profilePatch = {
				about: null,
				skills: [],
				tagline: null,
			};
		}

		if (action === "clear_reviewer_profile") {
			profilePatch = {
				community_role: "candidate",
				reviewer_bio: null,
				reviewer_expertise: [],
				reviewer_headline: null,
				reviewer_type: null,
				reviewer_verification_status: "none",
				reviewer_verified_at: null,
				reviewer_verified_by: null,
			};
		}

		const updateProfile = await admin
			.from("profiles")
			.update(profilePatch)
			.eq("id", profileId)
			.select(
				"id,username,full_name,avatar_url,current_position,community_role,reviewer_type,reviewer_headline,reviewer_verification_status,roast_count,helpful_votes,created_at",
			)
			.single();

		if (updateProfile.error) throw new Error(updateProfile.error.message);

		const logResult = await admin.from("moderation_actions").insert({
			action,
			admin_user_id: user.id,
			metadata: { previous_profile: profileResult.data },
			reason: note,
			target_id: profileId,
			target_type: "profile",
		});

		if (logResult.error) throw new Error(logResult.error.message);

		return Response.json({
			profile: updateProfile.data,
			status: "ok",
		});
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return internalErrorResponse(error, {
				context: {
					area: "admin",
					operation: "mutate_user",
					route: "POST /api/admin/users/[id]/action",
				},
				publicMessage: "Admin user action failed. No changes were saved.",
			});
		}

		return adminErrorResponse(error);
	}
}
