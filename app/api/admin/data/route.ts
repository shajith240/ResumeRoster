import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import { internalErrorResponse } from "@/lib/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CountQuery = PromiseLike<{
	count: number | null;
	error: { message?: string } | null;
}>;

async function getCount(query: CountQuery) {
	const { count, error } = await query;
	if (error) throw new Error(error.message ?? "Count query failed.");
	return count ?? 0;
}

async function getOptionalCommunityPostAttachmentCount(query: CountQuery) {
	const { count, error } = await query;
	if (!error) return count ?? 0;

	if (
		/community_post_attachments|schema cache|relation .* does not exist/i.test(
			error.message ?? "",
		)
	) {
		return 0;
	}

	throw new Error(error.message ?? "Count query failed.");
}

export async function GET(request: Request) {
	try {
		const { admin } = await requireAdmin(request);

		const [
			profiles,
			resumes,
			reviews,
			votes,
			commentAttachments,
			reports,
			reviewerApplications,
			feedbackTickets,
			notifications,
			moderationActions,
			resumeFiles,
			avatarFiles,
			commentMediaFiles,
			communityPostMediaFiles,
		] = await Promise.all([
			getCount(admin.from("profiles").select("id", { count: "exact", head: true })),
			getCount(admin.from("resumes").select("id", { count: "exact", head: true })),
			getCount(admin.from("roasts").select("id", { count: "exact", head: true })),
			getCount(admin.from("votes").select("id", { count: "exact", head: true })),
			getCount(
				admin
					.from("comment_attachments")
					.select("id", { count: "exact", head: true }),
			),
			getCount(
				admin.from("content_reports").select("id", {
					count: "exact",
					head: true,
				}),
			),
			getCount(
				admin.from("reviewer_applications").select("id", {
					count: "exact",
					head: true,
				}),
			),
			getCount(
				admin.from("user_feedback").select("id", {
					count: "exact",
					head: true,
				}),
			),
			getCount(
				admin.from("notifications").select("id", {
					count: "exact",
					head: true,
				}),
			),
			getCount(
				admin.from("moderation_actions").select("id", {
					count: "exact",
					head: true,
				}),
			),
			getCount(
				admin
					.from("resumes")
					.select("file_path", { count: "exact", head: true })
					.not("file_path", "is", null),
			),
			getCount(
				admin
					.from("profiles")
					.select("avatar_path", { count: "exact", head: true })
					.not("avatar_path", "is", null),
			),
			getCount(
				admin
					.from("comment_attachments")
					.select("storage_path", { count: "exact", head: true })
					.not("storage_path", "is", null),
			),
			getOptionalCommunityPostAttachmentCount(
				admin
					.from("community_post_attachments")
					.select("storage_path", { count: "exact", head: true })
					.not("storage_path", "is", null),
			),
		]);

		return Response.json({
			lifecycle: [
				{
					detail: "Auth account is removed through the service-role admin API.",
					key: "auth",
					label: "Auth user",
					value: "delete",
				},
				{
					detail: "Profile-owned rows cascade through foreign keys.",
					key: "cascade",
					label: "Owned rows",
					value: "cascade",
				},
				{
					detail: "Resume, avatar, comment, and community post upload objects are removed first.",
					key: "storage",
					label: "Storage",
					value: "cleanup",
				},
				{
					detail: "Admin action record stays for accountability.",
					key: "audit",
					label: "Audit",
					value: "retained",
				},
			],
			storage: [
				{
					detail: "Private resume PDFs linked from resumes.file_path.",
					key: "resumes",
					label: "Resume files",
					value: resumeFiles,
				},
				{
					detail: "Public avatar files linked from profiles.avatar_path.",
					key: "avatars",
					label: "Avatar files",
					value: avatarFiles,
				},
				{
					detail: "Public images linked from comment_attachments.storage_path.",
					key: "comment-media",
					label: "Comment media",
					value: commentMediaFiles,
				},
				{
					detail:
						"Public images linked from community_post_attachments.storage_path.",
					key: "community-post-media",
					label: "Community post media",
					value: communityPostMediaFiles,
				},
			],
			tables: [
				{ key: "profiles", label: "Profiles", value: profiles },
				{ key: "resumes", label: "Resumes", value: resumes },
				{ key: "roasts", label: "Reviews", value: reviews },
				{ key: "votes", label: "Lint votes", value: votes },
				{
					key: "comment_attachments",
					label: "Comment uploads",
					value: commentAttachments,
				},
				{ key: "content_reports", label: "Reports", value: reports },
				{
					key: "reviewer_applications",
					label: "Reviewer applications",
					value: reviewerApplications,
				},
				{
					key: "user_feedback",
					label: "Feedback tickets",
					value: feedbackTickets,
				},
				{ key: "notifications", label: "Notifications", value: notifications },
				{
					key: "moderation_actions",
					label: "Moderation actions",
					value: moderationActions,
				},
			],
		});
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return internalErrorResponse(error, {
				context: {
					area: "admin",
					operation: "load_data_inventory",
					route: "GET /api/admin/data",
				},
				publicMessage: "Admin data inventory could not be loaded.",
			});
		}

		return adminErrorResponse(error);
	}
}
