import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import type { ContentReportStatus } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPORT_STATUSES: ContentReportStatus[] = [
	"pending",
	"reviewing",
	"dismissed",
	"actioned",
];

function uniqueIds(values: Array<string | null | undefined>) {
	return Array.from(new Set(values.filter(Boolean) as string[]));
}

export async function GET(request: Request) {
	try {
		const { admin } = await requireAdmin(request);
		const url = new URL(request.url);
		const status = url.searchParams.get("status");
		const limit = Math.min(Number(url.searchParams.get("limit") ?? 80) || 80, 120);

		let query = admin
			.from("content_reports")
			.select(
				"id,reporter_id,reported_user_id,resume_id,roast_id,profile_id,target_type,reason,details,status,moderator_note,reviewed_by,reviewed_at,report_count,last_reported_at,created_at,updated_at",
			)
			.order("status", { ascending: true })
			.order("report_count", { ascending: false })
			.order("last_reported_at", { ascending: false })
			.limit(limit);

		if (status && REPORT_STATUSES.includes(status as ContentReportStatus)) {
			query = query.eq("status", status);
		}

		const { data: reports, error } = await query;
		if (error) throw new Error(error.message);

		const reportRows = reports ?? [];
		const profileIds = uniqueIds(
			reportRows.flatMap((report) => [
				report.reporter_id,
				report.reported_user_id,
				report.profile_id,
				report.reviewed_by,
			]),
		);
		const resumeIds = uniqueIds(reportRows.map((report) => report.resume_id));
		const reviewIds = uniqueIds(reportRows.map((report) => report.roast_id));

		const [profilesResult, resumesResult, reviewsResult] = await Promise.all([
			profileIds.length
				? admin
						.from("profiles")
						.select(
							"id,username,full_name,avatar_url,current_position,community_role,reviewer_type,reviewer_headline,reviewer_verification_status,roast_count,helpful_votes",
						)
						.in("id", profileIds)
				: Promise.resolve({ data: [], error: null }),
			resumeIds.length
				? admin
						.from("resumes")
						.select("id,user_id,title,status,created_at")
						.in("id", resumeIds)
				: Promise.resolve({ data: [], error: null }),
			reviewIds.length
				? admin
						.from("roasts")
						.select("id,resume_id,parent_id,author_id,content,attachment_id,content_format,is_deleted,created_at")
						.in("id", reviewIds)
				: Promise.resolve({ data: [], error: null }),
		]);

		if (profilesResult.error) throw new Error(profilesResult.error.message);
		if (resumesResult.error) throw new Error(resumesResult.error.message);
		if (reviewsResult.error) throw new Error(reviewsResult.error.message);

		const profilesById = new Map(
			(profilesResult.data ?? []).map((profile) => [profile.id, profile]),
		);
		const resumesById = new Map(
			(resumesResult.data ?? []).map((resume) => [resume.id, resume]),
		);
		const reviewsById = new Map(
			(reviewsResult.data ?? []).map((review) => [review.id, review]),
		);

		return Response.json({
			reports: reportRows.map((report) => ({
				...report,
				reportedUser: report.reported_user_id
					? profilesById.get(report.reported_user_id) ?? null
					: null,
				reporter: profilesById.get(report.reporter_id) ?? null,
				profile: report.profile_id
					? profilesById.get(report.profile_id) ?? null
					: null,
				resume: report.resume_id ? resumesById.get(report.resume_id) ?? null : null,
				reviewedBy: report.reviewed_by
					? profilesById.get(report.reviewed_by) ?? null
					: null,
				review: report.roast_id ? reviewsById.get(report.roast_id) ?? null : null,
				roast: report.roast_id ? reviewsById.get(report.roast_id) ?? null : null,
			})),
		});
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return Response.json({ message: error.message }, { status: 500 });
		}
		return adminErrorResponse(error);
	}
}
