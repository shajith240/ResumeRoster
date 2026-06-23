import { NextResponse } from "next/server";
import { capturePrivateError } from "@/lib/monitoring/capture-errors";
import { getRazorpayClient, PREMIUM_AMOUNT_PAISE, PREMIUM_CURRENCY } from "@/lib/razorpay";
import { PREMIUM_REVIEW_ENABLED } from "@/lib/premium-payments";
import { enforceApiRateLimit } from "@/lib/server/rate-limit";
import { requireSignedInUser, serverAuthErrorResponse } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
	if (!PREMIUM_REVIEW_ENABLED) {
		return NextResponse.json(
			{ message: "Priority reviews are not available yet. Stay tuned!" },
			{ status: 503 },
		);
	}

	let signedIn: Awaited<ReturnType<typeof requireSignedInUser>>;
	try {
		signedIn = await requireSignedInUser(request, {
			missingTokenMessage: "Sign in to purchase a priority review.",
			setupMessage: "Server payment setup is missing.",
		});
	} catch (error) {
		return serverAuthErrorResponse(error);
	}
	const { admin, user } = signedIn;

	const rateLimitResponse = await enforceApiRateLimit(admin, user.id, "paymentCreateOrder");
	if (rateLimitResponse) return rateLimitResponse;

	// Block if user already has an active priority review in flight.
	const existing = await admin
		.from("resumes")
		.select("id")
		.eq("user_id", user.id)
		.eq("is_premium", true)
		.eq("status", "open")
		.in("payment_status", ["pending", "paid"])
		.maybeSingle();

	if (existing.error) {
		capturePrivateError(existing.error, {
			area: "payments",
			operation: "check_active_premium",
			userId: user.id,
		});
		return NextResponse.json(
			{ message: "Could not verify existing orders. Please try again." },
			{ status: 500 },
		);
	}

	if (existing.data) {
		return NextResponse.json(
			{ message: "You already have an active priority review in progress." },
			{ status: 409 },
		);
	}

	let razorpay: ReturnType<typeof getRazorpayClient>;
	try {
		razorpay = getRazorpayClient();
	} catch {
		return NextResponse.json(
			{ message: "Payment service is temporarily unavailable. Please try again later." },
			{ status: 503 },
		);
	}

	try {
		const order = await razorpay.orders.create({
			amount: PREMIUM_AMOUNT_PAISE,
			currency: PREMIUM_CURRENCY,
			notes: { user_id: user.id },
		});

		return NextResponse.json({
			orderId: order.id,
			amount: PREMIUM_AMOUNT_PAISE,
			currency: PREMIUM_CURRENCY,
			keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
		});
	} catch (error) {
		capturePrivateError(error, {
			area: "payments",
			operation: "razorpay_create_order",
			userId: user.id,
		});
		return NextResponse.json(
			{ message: "Could not create payment order. Please try again." },
			{ status: 502 },
		);
	}
}
