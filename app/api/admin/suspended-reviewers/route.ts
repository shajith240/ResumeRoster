import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import { internalErrorResponse } from "@/lib/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	try {
		const { admin } = await requireAdmin(request);

		const { data, error } = await admin
			.from("profiles")
			.select("id,username,full_name,avatar_url,reviewer_missed_count,reviewer_verified_at")
			.eq("reviewer_claim_suspended", true)
			.eq("reviewer_verification_status", "verified")
			.order("reviewer_missed_count", { ascending: false })
			.limit(100);

		if (error) throw new Error(error.message);

		return Response.json({ reviewers: data ?? [] });
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return internalErrorResponse(error, {
				context: { area: "admin", operation: "list_suspended_reviewers", route: "GET /api/admin/suspended-reviewers" },
				publicMessage: "Failed to load suspended reviewers.",
			});
		}
		return adminErrorResponse(error);
	}
}
