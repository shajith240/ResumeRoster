// Shared types and constants for the premium payment feature.
// Safe to import on both server and client — no server-only imports here.

export type PremiumPaymentStatus = "pending" | "paid" | "refunded" | "failed";

export const PREMIUM_REVIEW_ENABLED = false;

export const PREMIUM_PRICE_RUPEES = 399;
export const PREMIUM_PRICE_PAISE = 39900;
export const PREMIUM_CURRENCY = "INR";

// Razorpay checkout.js browser interface types.
// These describe the window.Razorpay constructor injected by checkout.js.

export type RazorpayCheckoutResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

export type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  prefill?: { email?: string };
  theme?: { color?: string };
  modal?: { backdrop?: boolean; ondismiss?: () => void };
  handler: (response: RazorpayCheckoutResponse) => void;
};

export type RazorpayCheckoutInstance = {
  open: () => void;
};
