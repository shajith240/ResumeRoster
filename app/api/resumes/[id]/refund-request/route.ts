import { NextResponse } from "next/server";
import { capturePrivateError } from "@/lib/monitoring/capture-errors";
import { issueRazorpayRefund, PREMIUM_AMOUNT_PAISE } from "@/lib/razorpay";
import { requireSignedInUser, serverAuthErrorResponse } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
	params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
	let signedIn: Awaited<ReturnType<typeof requireSignedInUser>>;
	try {
		signedIn = await requireSignedInUser(request, {
			missingTokenMessage: "Sign in to request a refund.",
			setupMessage: "Server setup is missing.",
		});
	} catch (error) {
		return serverAuthErrorResponse(error);
	}
	const { admin, user } = signedIn;
	const { id: resumeId } = await context.params;

	// Atomically flip payment_status only if all refund conditions hold.
	// Returns the payment_id needed for Razorpay — null if conditions weren't met.
	const update = await admin
		.from("resumes")
		.update({ payment_status: "refunded" })
		.eq("id", resumeId)
		.eq("user_id", user.id)
		.eq("is_premium", true)
		.eq("payment_status", "paid")
		.is("assigned_reviewer_id", null)
		.eq("status", "open")
		.select("id,payment_id")
		.maybeSingle();

	if (update.error) {
		capturePrivateError(update.error, {
			area: "payments",
			operation: "refund_request_db_update",
			resumeId,
			userId: user.id,
		});
		return NextResponse.json(
			{ message: "Could not process refund. Please try again." },
			{ status: 500 },
		);
	}

	if (!update.data) {
		// Either already claimed, already refunded, or not owner. Safe to surface.
		return NextResponse.json(
			{
				message:
					"This resume is no longer eligible for a refund. It may have been claimed by a reviewer or already refunded.",
			},
			{ status: 409 },
		);
	}

	const paymentId = update.data.payment_id;

	if (!paymentId) {
		// No payment_id means no real payment was taken — treat as refunded already.
		return NextResponse.json({ refunded: true });
	}

	// Issue Razorpay refund. DB is already set to 'refunded' so the reviewer slot
	// is unblocked regardless of whether this API call succeeds.
	let refundId: string | null = null;
	try {
		const result = await issueRazorpayRefund(paymentId, PREMIUM_AMOUNT_PAISE);
		refundId = result.refundId;
	} catch (error) {
		capturePrivateError(error, {
			area: "payments",
			operation: "refund_request_razorpay",
			resumeId,
			paymentId,
			userId: user.id,
		});

		// Log for manual recovery — admin will see this in moderation_actions.
		await admin.from("moderation_actions").insert({
			action: "premium_refund_failed",
			admin_user_id: null,
			target_type: "resume",
			target_id: resumeId,
			metadata: {
				payment_id: paymentId,
				candidate_id: user.id,
				trigger: "user_refund_request",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			reason: "User-requested refund — Razorpay API call failed, manual recovery required",
		});

		return NextResponse.json(
			{
				message:
					"Your refund is being processed. If you don't receive it within 5–7 days, contact support.",
			},
			{ status: 500 },
		);
	}

	// Log successful refund.
	await admin.from("moderation_actions").insert({
		action: "premium_refund_issued",
		admin_user_id: null,
		target_type: "resume",
		target_id: resumeId,
		metadata: {
			refund_id: refundId,
			payment_id: paymentId,
			candidate_id: user.id,
			trigger: "user_refund_request",
			amount_paise: PREMIUM_AMOUNT_PAISE,
		},
		reason: "User-requested refund — reviewer not yet assigned",
	});

	return NextResponse.json({ refunded: true });
}
