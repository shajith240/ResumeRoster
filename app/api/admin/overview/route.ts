import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import { internalErrorResponse } from "@/lib/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIVE_WINDOW_MS = 120_000;

async function getCount(
	query: PromiseLike<{ count: number | null; error: { message?: string } | null }>,
) {
	const { count, error } = await query;
	if (error) throw new Error(error.message ?? "Count query failed.");
	return count ?? 0;
}

export async function GET(request: Request) {
	try {
		const { admin } = await requireAdmin(request);
		const activeSince = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();

		const [
			userCount,
			resumeCount,
			openResumeCount,
			reviewCount,
			replyCount,
			pendingReportCount,
			pendingReviewerCount,
			recentResumes,
			recentReviews,
			activePresence,
		] = await Promise.all([
			getCount(admin.from("profiles").select("id", { count: "exact", head: true })),
			getCount(admin.from("resumes").select("id", { count: "exact", head: true })),
			getCount(
				admin
					.from("resumes")
					.select("id", { count: "exact", head: true })
					.eq("status", "open"),
			),
			getCount(
				admin
					.from("roasts")
					.select("id", { count: "exact", head: true })
					.eq("is_deleted", false),
			),
			getCount(
				admin
					.from("roasts")
					.select("id", { count: "exact", head: true })
					.not("parent_id", "is", null)
					.eq("is_deleted", false),
			),
			getCount(
				admin
					.from("content_reports")
					.select("id", { count: "exact", head: true })
					.eq("status", "pending"),
			),
			getCount(
				admin
					.from("reviewer_applications")
					.select("id", { count: "exact", head: true })
					.eq("status", "pending"),
			),
			admin
				.from("resumes")
				.select(
					"id,user_id,title,status,roast_count,read_count,privacy_mode,is_anonymous,created_at",
				)
				.order("created_at", { ascending: false })
				.limit(8),
			admin
				.from("roasts")
				.select(
					"id,resume_id,parent_id,author_id,content,attachment_id,content_format,helpful_votes,dislike_count,is_deleted,created_at",
				)
				.order("created_at", { ascending: false })
				.limit(8),
			admin
				.from("app_presence_sessions")
				.select("user_id,last_seen_at,status")
				.gte("last_seen_at", activeSince),
		]);

		if (recentResumes.error) throw new Error(recentResumes.error.message);
		if (recentReviews.error) throw new Error(recentReviews.error.message);
		if (activePresence.error) throw new Error(activePresence.error.message);

		const activeReviewerCount = new Set(
			(activePresence.data ?? []).map((row) => row.user_id).filter(Boolean),
		).size;

		return Response.json({
			activity: {
				recentResumes: recentResumes.data ?? [],
				recentReviews: recentReviews.data ?? [],
			},
			stats: {
				activeReviewers: activeReviewerCount,
				openResumes: openResumeCount,
				pendingReports: pendingReportCount,
				pendingReviewers: pendingReviewerCount,
				replies: replyCount,
				resumes: resumeCount,
				reviews: reviewCount,
				users: userCount,
			},
		});
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return internalErrorResponse(error, {
				context: {
					area: "admin",
					operation: "load_overview",
					route: "GET /api/admin/overview",
				},
				publicMessage: "Admin overview could not be loaded.",
			});
		}
		return adminErrorResponse(error);
	}
}
