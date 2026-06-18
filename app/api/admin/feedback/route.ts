import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import { internalErrorResponse } from "@/lib/api-errors";
import type {
	UserFeedbackCategory,
	UserFeedbackPriority,
	UserFeedbackStatus,
} from "@/lib/supabase/types";
import {
	isUserFeedbackCategory,
	isUserFeedbackPriority,
	isUserFeedbackStatus,
	USER_FEEDBACK_STATUSES,
} from "@/lib/user-feedback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FeedbackRow = {
	admin_note: string | null;
	admin_reply: string | null;
	assigned_admin_id: string | null;
	body: string;
	category: UserFeedbackCategory;
	created_at: string;
	id: string;
	metadata: Record<string, string> | null;
	priority: UserFeedbackPriority;
	resolved_at: string | null;
	reviewed_at: string | null;
	reviewed_by: string | null;
	source_path: string | null;
	status: UserFeedbackStatus;
	title: string;
	updated_at: string;
	user_agent: string | null;
	user_id: string | null;
	viewport: string | null;
};

function uniqueIds(values: Array<string | null | undefined>) {
	return Array.from(new Set(values.filter(Boolean) as string[]));
}

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
		const url = new URL(request.url);
		const statusParam = url.searchParams.get("status") ?? "open";
		const categoryParam = url.searchParams.get("category") ?? "all";
		const priorityParam = url.searchParams.get("priority") ?? "all";
		const limit = Math.min(Number(url.searchParams.get("limit") ?? 80) || 80, 120);

		let query = admin
			.from("user_feedback")
			.select(
				"id,user_id,category,priority,status,title,body,source_path,user_agent,viewport,metadata,assigned_admin_id,admin_note,admin_reply,reviewed_by,reviewed_at,resolved_at,created_at,updated_at",
			)
			.order("created_at", { ascending: false })
			.limit(limit);

		if (statusParam === "open") {
			query = query.in("status", [
				"new",
				"reviewing",
				"needs_user_reply",
				"planned",
			]);
		} else if (isUserFeedbackStatus(statusParam)) {
			query = query.eq("status", statusParam);
		}

		if (isUserFeedbackCategory(categoryParam)) {
			query = query.eq("category", categoryParam);
		}

		if (isUserFeedbackPriority(priorityParam)) {
			query = query.eq("priority", priorityParam);
		}

		const [feedbackResult, statusCounts] = await Promise.all([
			query.returns<FeedbackRow[]>(),
			Promise.all(
				USER_FEEDBACK_STATUSES.map(async (status) => [
					status,
					await getCount(
						admin
							.from("user_feedback")
							.select("id", { count: "exact", head: true })
							.eq("status", status),
					),
				]),
			),
		]);

		if (feedbackResult.error) throw new Error(feedbackResult.error.message);

		const priorityRank: Record<UserFeedbackPriority, number> = {
			high: 2,
			low: 0,
			normal: 1,
			urgent: 3,
		};
		const feedbackRows = (feedbackResult.data ?? []).sort((left, right) => {
			const rankDiff = priorityRank[right.priority] - priorityRank[left.priority];
			if (rankDiff) return rankDiff;
			return (
				new Date(right.created_at).getTime() -
				new Date(left.created_at).getTime()
			);
		});
		const profileIds = uniqueIds(
			feedbackRows.flatMap((ticket) => [
				ticket.user_id,
				ticket.assigned_admin_id,
				ticket.reviewed_by,
			]),
		);
		const profilesResult = profileIds.length
			? await admin
					.from("profiles")
					.select(
						"id,username,full_name,avatar_url,current_position,community_role,reviewer_type,reviewer_headline,reviewer_verification_status,roast_count,helpful_votes",
					)
					.in("id", profileIds)
			: { data: [], error: null };

		if (profilesResult.error) throw new Error(profilesResult.error.message);

		const profilesById = new Map(
			(profilesResult.data ?? []).map((profile) => [profile.id, profile]),
		);

		return Response.json({
			feedback: feedbackRows.map((ticket) => ({
				...ticket,
				assignedAdmin: ticket.assigned_admin_id
					? profilesById.get(ticket.assigned_admin_id) ?? null
					: null,
				reviewedBy: ticket.reviewed_by
					? profilesById.get(ticket.reviewed_by) ?? null
					: null,
				userAgent: ticket.user_agent,
				userProfile: ticket.user_id
					? profilesById.get(ticket.user_id) ?? null
					: null,
			})),
			statusCounts: Object.fromEntries(statusCounts),
		});
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return internalErrorResponse(error, {
				context: {
					area: "admin",
					operation: "list_feedback",
					route: "GET /api/admin/feedback",
				},
				publicMessage: "Admin feedback inbox could not be loaded.",
			});
		}

		return adminErrorResponse(error);
	}
}
