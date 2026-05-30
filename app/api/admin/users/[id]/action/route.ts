import type { SupabaseClient } from "@supabase/supabase-js";
import { adminErrorResponse, isAdminEmail, requireAdmin } from "@/lib/admin";

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

	const { error } = await admin.storage.from(bucket).remove(uniquePaths);
	if (error) throw new Error(error.message);

	return uniquePaths.length;
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

			const [authUserResult, profileResult, resumesResult, attachmentsResult] =
				await Promise.all([
					admin.auth.admin.getUserById(profileId),
					admin
						.from("profiles")
						.select("id,avatar_path")
						.eq("id", profileId)
						.maybeSingle(),
					admin
						.from("resumes")
						.select("id,file_path")
						.eq("user_id", profileId),
					admin
						.from("comment_attachments")
						.select("id,storage_path")
						.eq("user_id", profileId),
				]);

			if (authUserResult.error) throw new Error(authUserResult.error.message);
			if (profileResult.error) throw new Error(profileResult.error.message);
			if (resumesResult.error) throw new Error(resumesResult.error.message);
			if (attachmentsResult.error) {
				throw new Error(attachmentsResult.error.message);
			}

			const targetEmail = authUserResult.data.user?.email ?? null;
			if (isAdminEmail(targetEmail)) {
				return badRequest("Admin allowlist accounts cannot be deleted here.", 403);
			}

			const resumes = resumesResult.data ?? [];
			const attachments = attachmentsResult.data ?? [];
			const logResult = await admin
				.from("moderation_actions")
				.insert({
					action,
					admin_user_id: user.id,
					metadata: {
						delete_status: "started",
						profile_existed: Boolean(profileResult.data?.id),
						user_data_counts: {
							attachments: attachments.length,
							resumes: resumes.length,
						},
					},
					reason: note,
					target_id: profileId,
					target_type: "user",
				})
				.select("id,metadata")
				.single();

			if (logResult.error) throw new Error(logResult.error.message);

			try {
				const [removedResumeFiles, removedAvatarFiles, removedCommentFiles] =
					await Promise.all([
						removeStorageObjects(
							admin,
							"resumes",
							resumes.map((resume) => resume.file_path),
						),
						removeStorageObjects(admin, "avatars", [
							profileResult.data?.avatar_path,
						]),
						removeStorageObjects(
							admin,
							"comment-media",
							attachments.map((attachment) => attachment.storage_path),
						),
					]);

				const attachmentIds = attachments.map((attachment) => attachment.id);
				if (attachmentIds.length) {
					const deleteAttachments = await admin
						.from("comment_attachments")
						.delete()
						.in("id", attachmentIds);
					if (deleteAttachments.error) {
						throw new Error(deleteAttachments.error.message);
					}
				}

				const deleteAuthUser = await admin.auth.admin.deleteUser(profileId);
				if (deleteAuthUser.error) throw new Error(deleteAuthUser.error.message);

				const updateLog = await admin
					.from("moderation_actions")
					.update({
						metadata: {
							...(logResult.data.metadata as Record<string, unknown>),
							delete_status: "completed",
							removed_storage_objects: {
								avatars: removedAvatarFiles,
								commentMedia: removedCommentFiles,
								resumes: removedResumeFiles,
							},
						},
					})
					.eq("id", logResult.data.id);

				if (updateLog.error) throw new Error(updateLog.error.message);

				return Response.json({
					deletedUserId: profileId,
					status: "ok",
				});
			} catch (deleteError) {
				await admin
					.from("moderation_actions")
					.update({
						metadata: {
							...(logResult.data.metadata as Record<string, unknown>),
							delete_error:
								deleteError instanceof Error
									? deleteError.message
									: "Unknown deletion failure",
							delete_status: "failed",
						},
					})
					.eq("id", logResult.data.id);

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
			return Response.json({ message: error.message }, { status: 500 });
		}

		return adminErrorResponse(error);
	}
}
