import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import { internalErrorResponse } from "@/lib/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	try {
		const { admin } = await requireAdmin(request);

		const { data, error } = await admin
			.from("moderation_actions")
			.select("id,target_id,metadata,reason,created_at")
			.eq("action", "premium_refund_failed")
			.order("created_at", { ascending: false })
			.limit(100);

		if (error) throw new Error(error.message);

		return Response.json({ failed: data ?? [] });
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return internalErrorResponse(error, {
				context: { area: "admin", operation: "list_failed_refunds", route: "GET /api/admin/failed-refunds" },
				publicMessage: "Failed to load failed refunds.",
			});
		}
		return adminErrorResponse(error);
	}
}
