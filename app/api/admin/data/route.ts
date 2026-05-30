import { adminErrorResponse, requireAdmin } from "@/lib/admin";

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
			notifications,
			moderationActions,
			resumeFiles,
			avatarFiles,
			commentMediaFiles,
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
					detail: "Resume, avatar, and comment upload objects are removed first.",
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
			return Response.json({ message: error.message }, { status: 500 });
		}

		return adminErrorResponse(error);
	}
}
