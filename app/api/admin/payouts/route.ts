import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import { internalErrorResponse } from "@/lib/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	try {
		const { admin } = await requireAdmin(request);
		const url = new URL(request.url);
		const status = url.searchParams.get("status") ?? "pending";
		const limit = Math.min(Number(url.searchParams.get("limit") ?? 200) || 200, 500);

		const { data, error } = await admin
			.from("reviewer_payouts")
			.select(
				"id,reviewer_id,resume_id,amount_paise,status,payout_ref,paid_by,paid_at,created_at",
			)
			.eq("status", status)
			.order("created_at", { ascending: false })
			.limit(limit);

		if (error) throw new Error(error.message);

		const rows = data ?? [];

		// Fetch reviewer profiles in one query.
		const reviewerIds = Array.from(new Set(rows.map((r) => r.reviewer_id)));
		const profilesResult = reviewerIds.length
			? await admin
					.from("profiles")
					.select("id,username,full_name,avatar_url")
					.in("id", reviewerIds)
			: { data: [], error: null };

		if (profilesResult.error) throw new Error(profilesResult.error.message);

		const profilesById = new Map(
			(profilesResult.data ?? []).map((p) => [p.id, p]),
		);

		// Group into per-reviewer summaries.
		type PayoutRow = {
			id: string;
			reviewer_id: string;
			resume_id: string | null;
			amount_paise: number;
			status: string;
			payout_ref: string | null;
			paid_at: string | null;
			created_at: string;
		};

		type ReviewerGroup = {
			reviewer_id: string;
			profile: { id: string; username: string | null; full_name: string | null; avatar_url: string | null } | null;
			total_paise: number;
			payout_count: number;
			payouts: PayoutRow[];
		};

		const grouped = new Map<string, ReviewerGroup>();
		for (const row of rows as PayoutRow[]) {
			const existing = grouped.get(row.reviewer_id);
			if (existing) {
				existing.total_paise += row.amount_paise;
				existing.payout_count++;
				existing.payouts.push(row);
			} else {
				grouped.set(row.reviewer_id, {
					reviewer_id: row.reviewer_id,
					profile: profilesById.get(row.reviewer_id) ?? null,
					total_paise: row.amount_paise,
					payout_count: 1,
					payouts: [row],
				});
			}
		}

		return Response.json({
			reviewers: Array.from(grouped.values()).sort(
				(a, b) => b.total_paise - a.total_paise,
			),
			total_paise: rows.reduce((sum, r) => sum + (r as PayoutRow).amount_paise, 0),
			status,
		});
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return internalErrorResponse(error, {
				context: { area: "admin", operation: "list_payouts", route: "GET /api/admin/payouts" },
				publicMessage: "Payouts could not be loaded.",
			});
		}
		return adminErrorResponse(error);
	}
}
