import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import {
	isReviewerApplicationStatus,
	type ReviewerApplicationStatus,
} from "@/lib/reviewer-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProfilePreview = {
	id: string;
	username: string | null;
	full_name: string | null;
	avatar_url?: string | null;
};

function uniqueIds(values: Array<string | null | undefined>) {
	return Array.from(new Set(values.filter(Boolean) as string[]));
}

export async function GET(request: Request) {
	try {
		const { admin } = await requireAdmin(request);
		const url = new URL(request.url);
		const requestedStatus = url.searchParams.get("status");
		const status: ReviewerApplicationStatus = isReviewerApplicationStatus(
			requestedStatus,
		)
			? requestedStatus
			: "pending";
		const limit = Math.min(Number(url.searchParams.get("limit") ?? 80) || 80, 120);

		const { data: applications, error } = await admin
			.from("reviewer_applications")
			.select(
				"id,user_id,requested_type,expertise,proof_url,note,status,admin_note,reviewed_by,reviewed_at,created_at,updated_at",
			)
			.eq("status", status)
			.order("updated_at", { ascending: false })
			.limit(limit);

		if (error) throw new Error(error.message);

		const rows = applications ?? [];
		const profileIds = uniqueIds(
			rows.flatMap((application) => [
				application.user_id,
				application.reviewed_by,
			]),
		);

		const profilesResult = profileIds.length
			? await admin
					.from("profiles")
					.select(
						"id,username,full_name,avatar_url,avatar_path,college,target_role,current_position,community_role,reviewer_type,reviewer_headline,reviewer_bio,reviewer_expertise,reviewer_verification_status,roast_count,helpful_votes",
					)
					.in("id", profileIds)
			: { data: [] as ProfilePreview[], error: null };

		if (profilesResult.error) throw new Error(profilesResult.error.message);

		const profilesById = new Map(
			(profilesResult.data ?? []).map((profile) => [profile.id, profile]),
		);

		return Response.json({
			applications: rows.map((application) => ({
				...application,
				profile: profilesById.get(application.user_id) ?? null,
				reviewedBy: application.reviewed_by
					? profilesById.get(application.reviewed_by) ?? null
					: null,
			})),
		});
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			console.error("Admin reviewers request failed", error);
			return Response.json(
				{ message: "We could not load reviewer applications." },
				{ status: 500 },
			);
		}

		return adminErrorResponse(error);
	}
}
