import { NextResponse } from "next/server";
import { capturePrivateError } from "@/lib/monitoring/capture-errors";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay";
import { createServiceSupabaseClient } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RazorpayPaymentEntity = {
	id: string;
	order_id: string;
	status: string;
};

type RazorpayWebhookPayload = {
	event: string;
	payload: {
		payment: {
			entity: RazorpayPaymentEntity;
		};
	};
};

function isValidWebhookPayload(value: unknown): value is RazorpayWebhookPayload {
	if (typeof value !== "object" || value === null) return false;
	const obj = value as Record<string, unknown>;
	const payment = (obj.payload as Record<string, unknown> | undefined)?.payment;
	const entity = (payment as Record<string, unknown> | undefined)?.entity;
	return typeof obj.event === "string" && typeof (entity as Record<string, unknown>)?.order_id === "string";
}

export async function POST(request: Request) {
	const signature = request.headers.get("x-razorpay-signature");
	if (!signature) {
		return NextResponse.json({ message: "Missing signature." }, { status: 400 });
	}

	// Read raw body before parsing — HMAC is computed over the raw bytes.
	let rawBody: string;
	try {
		rawBody = await request.text();
	} catch {
		return NextResponse.json({ message: "Could not read request body." }, { status: 400 });
	}

	if (!verifyRazorpayWebhookSignature({ rawBody, signature })) {
		capturePrivateError(new Error("Razorpay webhook signature mismatch"), {
			area: "payments",
			operation: "webhook_signature_verify",
		});
		return NextResponse.json({ message: "Invalid signature." }, { status: 400 });
	}

	let webhook: unknown;
	try {
		webhook = JSON.parse(rawBody);
	} catch {
		return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
	}

	if (!isValidWebhookPayload(webhook)) {
		// Not a payment event we care about — acknowledge without erroring.
		return NextResponse.json({ ok: true });
	}

	const { event, payload } = webhook;
	const payment = payload.payment.entity;

	let admin: ReturnType<typeof createServiceSupabaseClient>;
	try {
		admin = createServiceSupabaseClient("Webhook DB client setup is missing.");
	} catch (error) {
		capturePrivateError(error, { area: "payments", operation: "webhook_create_admin_client" });
		return NextResponse.json({ message: "Server configuration error." }, { status: 503 });
	}

	if (event === "payment.captured") {
		const update = await admin
			.from("resumes")
			.update({ payment_status: "paid" })
			.eq("razorpay_order_id", payment.order_id)
			.eq("payment_status", "pending");

		if (update.error) {
			capturePrivateError(update.error, {
				area: "payments",
				operation: "webhook_mark_paid",
				orderId: payment.order_id,
				paymentId: payment.id,
			});
			// Return 500 so Razorpay retries — this is intentional.
			return NextResponse.json({ message: "DB update failed." }, { status: 500 });
		}
	} else if (event === "payment.failed") {
		const update = await admin
			.from("resumes")
			.update({ payment_status: "failed" })
			.eq("razorpay_order_id", payment.order_id)
			.eq("payment_status", "pending");

		if (update.error) {
			capturePrivateError(update.error, {
				area: "payments",
				operation: "webhook_mark_failed",
				orderId: payment.order_id,
			});
		}
	}

	// Always return 200 for events we don't handle — prevents Razorpay retries.
	return NextResponse.json({ ok: true });
}
