import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import { internalErrorResponse } from "@/lib/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAYMENT_STATUSES = new Set(["all", "paid", "pending", "refunded"]);

export async function GET(request: Request) {
	try {
		const { admin } = await requireAdmin(request);
		const url = new URL(request.url);
		const paymentStatus = url.searchParams.get("payment_status") ?? "all";
		const limit = Math.min(Number(url.searchParams.get("limit") ?? 100) || 100, 200);

		let query = admin
			.from("resumes")
			.select(
				"id,title,user_id,status,payment_status,payment_id,is_premium,assigned_reviewer_id,review_deadline,premium_claimed_at,created_at",
			)
			.eq("is_premium", true)
			.order("created_at", { ascending: false })
			.limit(limit);

		if (PAYMENT_STATUSES.has(paymentStatus) && paymentStatus !== "all") {
			query = query.eq("payment_status", paymentStatus);
		}

		const { data, error } = await query;
		if (error) throw new Error(error.message);

		const rows = data ?? [];

		// Fetch candidate + reviewer profiles in one batch.
		const candidateIds = Array.from(new Set(rows.map((r) => r.user_id)));
		const reviewerIds = Array.from(
			new Set(rows.map((r) => r.assigned_reviewer_id).filter(Boolean) as string[]),
		);
		const allProfileIds = Array.from(new Set([...candidateIds, ...reviewerIds]));

		const profilesResult = allProfileIds.length
			? await admin
					.from("profiles")
					.select("id,username,full_name,avatar_url")
					.in("id", allProfileIds)
			: { data: [], error: null };

		if (profilesResult.error) throw new Error(profilesResult.error.message);

		const profilesById = new Map(
			(profilesResult.data ?? []).map((p) => [p.id, p]),
		);

		return Response.json({
			resumes: rows.map((r) => ({
				...r,
				candidate: profilesById.get(r.user_id) ?? null,
				reviewer: r.assigned_reviewer_id ? (profilesById.get(r.assigned_reviewer_id) ?? null) : null,
			})),
		});
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return internalErrorResponse(error, {
				context: { area: "admin", operation: "list_premium_resumes", route: "GET /api/admin/premium-resumes" },
				publicMessage: "Premium resumes could not be loaded.",
			});
		}
		return adminErrorResponse(error);
	}
}
