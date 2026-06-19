import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import { internalErrorResponse } from "@/lib/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { admin, user } = await requireAdmin(request);
		const { id: payoutId } = await params;

		if (!UUID_PATTERN.test(payoutId)) {
			return Response.json({ message: "Payout not found." }, { status: 404 });
		}

		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return Response.json({ message: "Invalid request body." }, { status: 400 });
		}

		const payoutRef =
			body && typeof body === "object" && "payoutRef" in body && typeof (body as { payoutRef: unknown }).payoutRef === "string"
				? ((body as { payoutRef: string }).payoutRef).trim()
				: "";

		// Atomically mark as paid — only if still pending.
		const { data, error } = await admin
			.from("reviewer_payouts")
			.update({
				status: "paid",
				payout_ref: payoutRef || null,
				paid_by: user.id,
				paid_at: new Date().toISOString(),
			})
			.eq("id", payoutId)
			.eq("status", "pending")
			.select("id,reviewer_id,resume_id,amount_paise,status,payout_ref,paid_at")
			.maybeSingle();

		if (error) throw new Error(error.message);

		if (!data) {
			return Response.json(
				{ message: "Payout not found or already marked paid." },
				{ status: 409 },
			);
		}

		return Response.json({ payout: data });
	} catch (error) {
		if (error instanceof Error && !(error as { status?: number }).status) {
			return internalErrorResponse(error, {
				context: { area: "admin", operation: "mark_payout_paid", route: "POST /api/admin/payouts/[id]" },
				publicMessage: "Could not mark payout as paid.",
			});
		}
		return adminErrorResponse(error);
	}
}
