/**
 * Tests for Razorpay crypto utilities.
 *
 * These are the most security-critical functions in the codebase — they guard
 * real money. A bug here means either (a) fraudulent payments are accepted, or
 * (b) legitimate payments are rejected. Every edge case must be covered.
 */
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	verifyRazorpayPaymentSignature,
	verifyRazorpayWebhookSignature,
} from "@/lib/razorpay";

const TEST_KEY_SECRET = "test_key_secret_abc123";
const TEST_WEBHOOK_SECRET = "test_webhook_secret_xyz789";

function makePaymentSignature(orderId: string, paymentId: string, secret = TEST_KEY_SECRET) {
	return createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
}

function makeWebhookSignature(rawBody: string, secret = TEST_WEBHOOK_SECRET) {
	return createHmac("sha256", secret).update(rawBody).digest("hex");
}

describe("verifyRazorpayPaymentSignature", () => {
	beforeEach(() => {
		process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET;
	});

	afterEach(() => {
		delete process.env.RAZORPAY_KEY_SECRET;
	});

	it("accepts a correctly signed payment", () => {
		const orderId = "order_testABC123";
		const paymentId = "pay_testDEF456";
		const signature = makePaymentSignature(orderId, paymentId);

		expect(
			verifyRazorpayPaymentSignature({ orderId, paymentId, signature }),
		).toBe(true);
	});

	it("rejects a payment with a tampered order ID", () => {
		const orderId = "order_testABC123";
		const paymentId = "pay_testDEF456";
		const signature = makePaymentSignature(orderId, paymentId);

		expect(
			verifyRazorpayPaymentSignature({
				orderId: "order_TAMPERED999",
				paymentId,
				signature,
			}),
		).toBe(false);
	});

	it("rejects a payment with a tampered payment ID", () => {
		const orderId = "order_testABC123";
		const paymentId = "pay_testDEF456";
		const signature = makePaymentSignature(orderId, paymentId);

		expect(
			verifyRazorpayPaymentSignature({
				orderId,
				paymentId: "pay_TAMPERED999",
				signature,
			}),
		).toBe(false);
	});

	it("rejects a payment with a forged signature", () => {
		expect(
			verifyRazorpayPaymentSignature({
				orderId: "order_testABC123",
				paymentId: "pay_testDEF456",
				signature: "a".repeat(64), // looks like a hex digest but is wrong
			}),
		).toBe(false);
	});

	it("rejects an empty signature string", () => {
		expect(
			verifyRazorpayPaymentSignature({
				orderId: "order_testABC123",
				paymentId: "pay_testDEF456",
				signature: "",
			}),
		).toBe(false);
	});

	it("rejects when RAZORPAY_KEY_SECRET is not configured", () => {
		delete process.env.RAZORPAY_KEY_SECRET;

		expect(
			verifyRazorpayPaymentSignature({
				orderId: "order_testABC123",
				paymentId: "pay_testDEF456",
				signature: makePaymentSignature("order_testABC123", "pay_testDEF456"),
			}),
		).toBe(false);
	});

	it("rejects a signature computed with a different secret", () => {
		const signature = makePaymentSignature("order_test", "pay_test", "wrong_secret");

		expect(
			verifyRazorpayPaymentSignature({
				orderId: "order_test",
				paymentId: "pay_test",
				signature,
			}),
		).toBe(false);
	});

	it("is case-sensitive on order and payment IDs", () => {
		const orderId = "order_abc";
		const paymentId = "pay_ABC"; // uppercase
		const signature = makePaymentSignature(orderId, paymentId);

		expect(
			verifyRazorpayPaymentSignature({
				orderId: "order_abc",
				paymentId: "pay_abc", // lowercase — should not match
				signature,
			}),
		).toBe(false);
	});
});

describe("verifyRazorpayWebhookSignature", () => {
	beforeEach(() => {
		process.env.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
	});

	afterEach(() => {
		delete process.env.RAZORPAY_WEBHOOK_SECRET;
	});

	it("accepts a correctly signed webhook body", () => {
		const rawBody = JSON.stringify({ event: "payment.captured", payload: {} });
		const signature = makeWebhookSignature(rawBody);

		expect(verifyRazorpayWebhookSignature({ rawBody, signature })).toBe(true);
	});

	it("rejects a webhook with a tampered body", () => {
		const rawBody = JSON.stringify({ event: "payment.captured", payload: {} });
		const signature = makeWebhookSignature(rawBody);

		expect(
			verifyRazorpayWebhookSignature({
				rawBody: JSON.stringify({ event: "payment.captured", payload: { tampered: true } }),
				signature,
			}),
		).toBe(false);
	});

	it("rejects a webhook with a forged signature", () => {
		const rawBody = JSON.stringify({ event: "payment.captured" });

		expect(
			verifyRazorpayWebhookSignature({
				rawBody,
				signature: "0".repeat(64),
			}),
		).toBe(false);
	});

	it("rejects when RAZORPAY_WEBHOOK_SECRET is not configured", () => {
		delete process.env.RAZORPAY_WEBHOOK_SECRET;
		const rawBody = JSON.stringify({ event: "payment.captured" });

		expect(
			verifyRazorpayWebhookSignature({
				rawBody,
				signature: makeWebhookSignature(rawBody),
			}),
		).toBe(false);
	});

	it("rejects a signature computed against a different body encoding", () => {
		// Even a trailing space makes the body different — real webhooks are byte-exact
		const rawBody = '{"event":"payment.captured"}';
		const signatureForBodyWithSpace = makeWebhookSignature(rawBody + " ");

		expect(
			verifyRazorpayWebhookSignature({ rawBody, signature: signatureForBodyWithSpace }),
		).toBe(false);
	});
});
