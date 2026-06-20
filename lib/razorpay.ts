import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";

export const PREMIUM_AMOUNT_PAISE = 39900;
export const PREMIUM_CURRENCY = "INR";

function safeCompareHex(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "hex");
    const bufB = Buffer.from(b, "hex");
    if (bufA.length === 0 || bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export function getRazorpayClient(): Razorpay {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials not configured.");
  }

  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export function verifyRazorpayPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) return false;

  const expected = createHmac("sha256", keySecret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest("hex");

  return safeCompareHex(expected, params.signature);
}

export function verifyRazorpayWebhookSignature(params: {
  rawBody: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;

  const expected = createHmac("sha256", secret)
    .update(params.rawBody)
    .digest("hex");

  return safeCompareHex(expected, params.signature);
}

export async function issueRazorpayRefund(
  paymentId: string,
  amountPaise: number,
): Promise<{ refundId: string }> {
  const razorpay = getRazorpayClient();
  const refund = await razorpay.payments.refund(paymentId, {
    amount: amountPaise,
  });
  return { refundId: refund.id };
}
