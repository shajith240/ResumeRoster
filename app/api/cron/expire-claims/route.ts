import { NextResponse } from "next/server";
import { capturePrivateError } from "@/lib/monitoring/capture-errors";
import { createServiceSupabaseClient } from "@/lib/server-auth";
import { issueRazorpayRefund, PREMIUM_AMOUNT_PAISE } from "@/lib/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vercel Cron calls this route with Authorization: Bearer <CRON_SECRET>.
// Any other caller gets 401.
function isAuthorizedCronRequest(request: Request): boolean {
	const cronSecret = process.env.CRON_SECRET;
	if (!cronSecret) return false;
	const auth = request.headers.get("authorization");
	return auth === `Bearer ${cronSecret}`;
}

type ExpiredClaim = {
	resume_id: string;
	payment_id: string | null;
	old_reviewer_id: string | null;
	candidate_id: string;
};

export async function GET(request: Request) {
	if (!isAuthorizedCronRequest(request)) {
		return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
	}

	let admin: ReturnType<typeof createServiceSupabaseClient>;
	try {
		admin = createServiceSupabaseClient("Cron DB client setup is missing.");
	} catch (error) {
		capturePrivateError(error, { area: "cron", operation: "expire_claims_client_init" });
		return NextResponse.json({ message: "Server configuration error." }, { status: 503 });
	}

	// Atomically find expired claims, un-assign reviewers, set payment_status='refunded'.
	// FOR UPDATE SKIP LOCKED inside the RPC means parallel cron fires can't double-process.
	const { data, error: rpcError } = await admin.rpc("expire_claimed_premium_resumes");

	if (rpcError) {
		capturePrivateError(rpcError, { area: "cron", operation: "expire_claims_rpc" });
		return NextResponse.json({ message: "Expiry query failed." }, { status: 500 });
	}

	const expired = (data ?? []) as ExpiredClaim[];

	if (expired.length === 0) {
		return NextResponse.json({ processed: 0, refunded: 0, failed: 0 });
	}

	// Issue Razorpay refunds in parallel. DB is already updated — if a refund
	// fails here, log it for manual recovery but don't roll back (the reviewer
	// is already unblocked and the candidate will be re-refunded manually).
	const refundResults = await Promise.allSettled(
		expired.map(async (claim) => {
			if (!claim.payment_id) {
				throw new Error(`No payment_id on resume ${claim.resume_id}`);
			}
			return issueRazorpayRefund(claim.payment_id, PREMIUM_AMOUNT_PAISE);
		}),
	);

	let refunded = 0;
	let failed = 0;

	refundResults.forEach((result, i) => {
		if (result.status === "fulfilled") {
			refunded++;
		} else {
			failed++;
			capturePrivateError(result.reason, {
				area: "cron",
				operation: "razorpay_refund",
				resumeId: expired[i].resume_id,
				paymentId: expired[i].payment_id ?? "missing",
				candidateId: expired[i].candidate_id,
				reviewerId: expired[i].old_reviewer_id ?? "unknown",
			});
		}
	});

	return NextResponse.json({
		processed: expired.length,
		refunded,
		failed,
	});
}
