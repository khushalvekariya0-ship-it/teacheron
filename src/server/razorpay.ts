import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Currency } from "@/lib/money";
import { env } from "./env";

/*
 * Razorpay (https://razorpay.com/docs/api/): the site takes card, UPI, netbanking and wallet payments
 * through Razorpay Checkout. The key secret and webhook secret stay on this server; the browser only
 * ever gets the public key id and an order id.
 *
 *   1. The server creates an Order for the exact amount (createOrder). Lesson requests use manual
 *      capture: the money is only held until the tutor accepts.
 *   2. The browser opens Razorpay Checkout with that order; the person pays.
 *   3. Checkout hands back payment id + order id + signature; the server checks the signature
 *      (HMAC-SHA256 with the key secret) and the payment itself (fetchPayment) before acting on it.
 *   4. Accept → capturePayment. Cancel / no-show / dispute refunds → refundPayment. A held payment that
 *      is never captured is released by Razorpay automatically.
 *   5. Webhooks (payment.authorized, payment.captured, payment.failed, refund.processed) are checked with
 *      the webhook secret, so a payment still counts if the browser closed before step 3 finished.
 */

export const razorpayReady = () => env.paymentsEnabled;
export const razorpayKeyId = () => env.razorpayKeyId;
export const checkoutScriptUrl = () => env.razorpayCheckoutUrl;

export class RazorpayError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "RazorpayError";
  }
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  if (!razorpayReady()) throw new RazorpayError("Payments aren't connected yet.", 503, "not_configured");
  const res = await fetch(`${env.razorpayApiUrl}${path}`, {
    method,
    headers: {
      authorization: `Basic ${Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString("base64")}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => null)) as (T & { error?: { code?: string; description?: string } }) | null;
  if (!res.ok || !json) {
    const err = json?.error;
    // Razorpay's message is logged, never shown to people (it can mention account settings).
    console.error("[razorpay]", method, path.replace(/\/(pay|order|rfnd)_[A-Za-z0-9]+/g, "/$1_…"), res.status, err?.code ?? "", err?.description ?? "");
    throw new RazorpayError(err?.description ?? "Razorpay request failed", res.status, err?.code);
  }
  return json;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status: "created" | "attempted" | "paid";
  notes?: Record<string, string>;
}

/** An order for an exact amount. `hold`: manual capture (lesson requests wait for the tutor). */
export function createOrder(input: { amount: number; currency: Currency; receipt: string; notes: Record<string, string>; hold: boolean }): Promise<RazorpayOrder> {
  return call<RazorpayOrder>("POST", "/v1/orders", {
    amount: input.amount,
    currency: input.currency,
    receipt: input.receipt.slice(0, 40),
    notes: input.notes,
    payment: {
      capture: input.hold ? "manual" : "automatic",
      capture_options: { automatic_expiry_period: 12, manual_expiry_period: 7200, refund_speed: "normal" },
    },
  });
}

export interface RazorpayPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method?: string;
  captured?: boolean;
  amount_refunded?: number;
  card?: { network?: string; last4?: string };
  bank?: string;
  wallet?: string;
  vpa?: string;
  error_description?: string;
}

export const fetchPayment = (paymentId: string) => call<RazorpayPayment>("GET", `/v1/payments/${encodeURIComponent(paymentId)}`);

export const capturePayment = (paymentId: string, amount: number, currency: Currency) =>
  call<RazorpayPayment>("POST", `/v1/payments/${encodeURIComponent(paymentId)}/capture`, { amount, currency });

export interface RazorpayRefund {
  id: string;
  payment_id: string;
  amount: number;
  currency: string;
  status: "pending" | "processed" | "failed";
  notes?: Record<string, string>;
}

/** A payment's refunds so far (to avoid sending one twice). */
export const listRefunds = async (paymentId: string) => (await call<{ items: RazorpayRefund[] }>("GET", `/v1/payments/${encodeURIComponent(paymentId)}/refunds?count=100`)).items ?? [];

export const refundPayment = (paymentId: string, amount: number, notes: Record<string, string> = {}) =>
  call<RazorpayRefund>("POST", `/v1/payments/${encodeURIComponent(paymentId)}/refund`, { amount, speed: "normal", notes });

const sameHex = (a: string, b: string) => a.length === b.length && /^[0-9a-f]+$/i.test(a) && timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));

/** Checkout's signature: HMAC-SHA256 of "order_id|payment_id" with the key secret. */
export function validPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  if (!env.razorpayKeySecret || !orderId || !paymentId || !signature) return false;
  const expected = createHmac("sha256", env.razorpayKeySecret).update(`${orderId}|${paymentId}`).digest("hex");
  return sameHex(expected, signature);
}

/** A webhook's X-Razorpay-Signature: HMAC-SHA256 of the raw body with the webhook secret. */
export function validWebhookSignature(rawBody: string, signature: string): boolean {
  if (!env.razorpayWebhookSecret || !signature) return false;
  const expected = createHmac("sha256", env.razorpayWebhookSecret).update(rawBody).digest("hex");
  return sameHex(expected, signature);
}

/** "Visa •••• 4242", "UPI", "Netbanking (HDFC)", "Wallet (paytm)". */
export function methodLabel(p: Pick<RazorpayPayment, "method" | "card" | "bank" | "wallet">): string {
  if (p.method === "card") return [p.card?.network, p.card?.last4 ? `•••• ${p.card.last4}` : ""].filter(Boolean).join(" ") || "Card";
  if (p.method === "upi") return "UPI";
  if (p.method === "netbanking") return p.bank ? `Netbanking (${p.bank})` : "Netbanking";
  if (p.method === "wallet") return p.wallet ? `Wallet (${p.wallet})` : "Wallet";
  if (p.method === "emi") return "Card EMI";
  return p.method ? p.method[0].toUpperCase() + p.method.slice(1) : "Razorpay";
}
