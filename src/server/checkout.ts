import "server-only";
import { CREDIT_PACKS, packPrice, planPrice, studyPackAmount, TUTOR_PLANS } from "@/lib/data/platform";
import { fail, ok, type CreateBookingInput, type Result } from "@/lib/domain/data";
import type { VerifiedPayment } from "@/lib/domain/actions";
import { asCurrency, currencyForCountry, type Currency } from "@/lib/money";
import type { AppNotification, User } from "@/lib/types";
import { db } from "./db";
import { runAction } from "./engine";
import { checkoutScriptUrl, createOrder, fetchPayment, methodLabel, razorpayKeyId, razorpayReady, refundPayment, validPaymentSignature } from "./razorpay";

/*
 * Paying on the site through Razorpay Checkout (see ./razorpay.ts):
 *
 *   startCheckout  the server works out the exact amount itself (a lesson: every booking check and the price,
 *                  in the tutor's currency; credits and plans: the listed price) and creates a Razorpay order for
 *                  it. Lesson requests hold the money (manual capture) until the tutor accepts. The order and
 *                  what it pays for are kept in payment_orders.
 *   finishCheckout runs once per order, from the browser (with Checkout's signature) or Razorpay's webhook,
 *                  whichever comes first. It checks the payment with Razorpay (right order, amount, currency;
 *                  held or taken), then does what was paid for with that checked payment. If that fails (the
 *                  time was just taken…), a taken payment is refunded at once and a held one is released.
 */

export type CheckoutKind = "booking" | "booking_retry" | "study_credits" | "lead_credits" | "plan";
export const CHECKOUT_KINDS: CheckoutKind[] = ["booking", "booking_retry", "study_credits", "lead_credits", "plan"];

export interface CheckoutOrder {
  orderId: string;
  keyId: string;
  amount: number;
  currency: Currency;
  description: string;
  checkoutUrl: string;
  /** Checkout's prefill (the person can change it there). */
  name: string;
  email: string;
  method?: "upi" | "card";
}

type Plan = { amount: number; currency: Currency; hold: boolean; description: string; payload: Record<string, unknown> };

async function planFor(me: User, kind: CheckoutKind, payload: Record<string, unknown>): Promise<Result<Plan | null>> {
  if (kind === "booking") {
    const q = await runAction("quoteBooking", [payload], { userId: me.id });
    if (!q.ok) return q;
    const { charge, currency, instant, description } = q.data as { charge: number; currency: Currency; instant: boolean; description: string };
    if (charge <= 0) return ok(null);
    return ok({ amount: charge, currency, hold: !instant, description, payload });
  }
  if (kind === "booking_retry") {
    const [b] = await db()`select id, price_cents, discount_cents, currency from public.bookings where id = ${String(payload.bookingId ?? "")} and booker_id = ${me.id} and status = 'payment_failed'`;
    if (!b) return fail("This lesson isn't waiting for a payment.");
    const amount = Number(b.price_cents) - Number(b.discount_cents);
    if (amount <= 0) return ok(null);
    return ok({ amount, currency: asCurrency(b.currency), hold: true, description: "Payment for your lesson", payload: { bookingId: String(b.id) } });
  }
  if (kind === "study_credits") {
    if (me.parentalConsent?.status === "pending") return fail("A parent or guardian needs to approve your account before you can add credits.");
    const currency = currencyForCountry(me.country);
    const amount = studyPackAmount(String(payload.packId ?? ""), currency);
    if (!amount) return fail("Choose an amount to add.");
    const method = payload.method === "upi" ? "upi" : "card";
    return ok({ amount, currency, hold: false, description: "Study Credits", payload: { packId: String(payload.packId), method } });
  }
  if (!me.tutorId) return fail("Tutor profile not found.");
  const [t] = await db()`select currency from public.tutors where id = ${me.tutorId}`;
  if (kind === "lead_credits") {
    const pack = CREDIT_PACKS.find((p) => p.id === payload.packId);
    if (!pack) return fail("Choose a credit pack.");
    const price = packPrice(pack.id, t?.currency as string);
    return ok({ amount: price.amount, currency: price.currency, hold: false, description: `${pack.credits} lead credits`, payload: { packId: pack.id } });
  }
  const plan = TUTOR_PLANS.find((p) => p.id === payload.plan);
  if (!plan) return fail("Choose a plan.");
  const price = planPrice(plan.id, t?.currency as string);
  if (price.amount <= 0) return ok(null);
  return ok({ amount: price.amount, currency: price.currency, hold: false, description: `${plan.name} plan, one month`, payload: { plan: plan.id } });
}

/** Creates the Razorpay order for something the person wants to pay for; `free` when nothing is owed. */
export async function startCheckout(me: User, kind: CheckoutKind, payload: Record<string, unknown>): Promise<Result<CheckoutOrder | { free: true }>> {
  if (!razorpayReady()) return fail("Card and UPI payments aren't switched on yet.");
  const plan = await planFor(me, kind, payload);
  if (!plan.ok) return plan;
  if (!plan.data) return ok({ free: true });
  const p = plan.data;
  if (p.amount < 100) return fail("This amount is too small to pay online.");
  const order = await createOrder({ amount: p.amount, currency: p.currency, receipt: `${kind}-${Date.now().toString(36)}`, notes: { kind, account: me.id }, hold: p.hold });
  await db()`insert into public.payment_orders (id, user_id, kind, amount, currency, payload) values (${order.id}, ${me.id}, ${kind}, ${p.amount}, ${p.currency}, ${db().json(p.payload as never)})`;
  console.info("[checkout] order", order.id.slice(0, 12), kind, p.amount, p.currency, p.hold ? "held" : "taken at payment");
  const method = payload.payWith === "upi" || payload.method === "upi" ? "upi" : payload.payWith === "card" || payload.method === "card" ? "card" : undefined;
  return ok({ orderId: order.id, keyId: razorpayKeyId(), amount: p.amount, currency: p.currency, description: p.description, checkoutUrl: checkoutScriptUrl(), name: `${me.firstName} ${me.lastName}`.trim(), email: me.email, method });
}

/** What an action returned that identifies the result (a booking, a credit top-up…). */
const resultIdOf = (data: unknown) => (data && typeof data === "object" && "id" in data ? String((data as { id: unknown }).id) : null);

/**
 * Does what an order paid for, once. `userId` (from the browser) must own the order; the webhook passes none.
 * `signature` is Checkout's, checked here; the webhook's own signature is checked by its route.
 */
export async function finishCheckout(
  orderId: string,
  paymentId: string,
  opts: { userId?: string; signature?: string; onNotified?: (list: AppNotification[]) => void },
): Promise<Result<{ kind: CheckoutKind; resultId: string | null }>> {
  if (opts.signature !== undefined && !validPaymentSignature(orderId, paymentId, opts.signature)) return fail("We couldn't confirm that payment. If money left your account, it will be returned automatically.");
  const [claimed] = await db()`
    update public.payment_orders set status = 'processing', payment_id = ${paymentId}, updated_at = now()
    where id = ${orderId} and status = 'created' and (${opts.userId ?? null}::text is null or user_id = ${opts.userId ?? null})
    returning id, user_id, kind, amount, currency, payload`;
  if (!claimed) {
    // Already handled (Razorpay's webhook or a double click got there first), or not this person's order.
    // If the other one is still working on it, wait a little for its result rather than answering "not yet".
    for (let i = 0; i < 24; i++) {
      const [row] = await db()`select user_id, kind, status, payment_id, result_id, error from public.payment_orders where id = ${orderId}`;
      if (!row || (opts.userId && row.user_id !== opts.userId)) return fail("Payment not found.");
      if (row.status === "done" && row.payment_id === paymentId) return ok({ kind: row.kind as CheckoutKind, resultId: row.result_id ? String(row.result_id) : null });
      if (row.status === "failed") return fail(String(row.error ?? "That payment couldn't be used."));
      if (row.status !== "processing") break;
      await new Promise((r) => setTimeout(r, 500));
    }
    return fail("Still finishing your payment. Refresh in a moment.");
  }
  const kind = claimed.kind as CheckoutKind;
  const done = async (status: "done" | "failed", resultId: string | null, error?: string) =>
    db()`update public.payment_orders set status = ${status}, result_id = ${resultId}, error = ${error ?? null}, updated_at = now() where id = ${orderId}`;

  const p = await fetchPayment(paymentId).catch(() => null);
  const usable = !!p && p.order_id === orderId && p.amount === Number(claimed.amount) && p.currency === claimed.currency && (p.status === "authorized" || p.status === "captured");
  if (!p || !usable) {
    // Let a later confirmation (or the webhook) try again if Razorpay just hadn't recorded it yet.
    await db()`update public.payment_orders set status = 'created', payment_id = null, updated_at = now() where id = ${orderId} and status = 'processing'`;
    console.error("[checkout] payment didn't match its order", orderId.slice(0, 12), p?.status, p?.amount, p?.currency);
    return fail(p?.status === "failed" ? "The payment didn't go through. Nothing was charged." : "We couldn't confirm that payment yet. If money left your account, it will be returned automatically.");
  }
  const payment: VerifiedPayment = { provider: "razorpay", paymentId, orderId, amount: p.amount, currency: asCurrency(p.currency), captured: p.status === "captured", method: methodLabel(p) };
  const payload = (claimed.payload ?? {}) as Record<string, unknown>;
  const actor = { userId: String(claimed.user_id) };
  const ctx = { payment };
  const r =
    kind === "booking"
      ? await runAction("createBooking", [payload as unknown as CreateBookingInput], actor, opts.onNotified, ctx)
      : kind === "booking_retry"
        ? await runAction("transitionBooking", [String(payload.bookingId), "pending"], actor, opts.onNotified, ctx)
        : kind === "study_credits"
          ? await runAction("topUpWallet", [String(payload.packId), payload.method === "upi" ? "upi" : "card"], actor, opts.onNotified, ctx)
          : kind === "lead_credits"
            ? await runAction("buyCredits", [String(payload.packId)], actor, opts.onNotified, ctx)
            : await runAction("changePlan", [String(payload.plan)], actor, opts.onNotified, ctx);
  if (r.ok) {
    await done("done", resultIdOf(r.data));
    console.info("[checkout] paid", orderId.slice(0, 12), kind);
    return ok({ kind, resultId: resultIdOf(r.data) });
  }
  // It couldn't be used (the time was just taken, a code ran out…): give the money back straight away.
  let after = "Your payment wasn't taken: the hold is released automatically.";
  if (payment.captured) {
    try {
      await refundPayment(paymentId, p.amount, { order: orderId, reason: "could not complete" });
      after = "Your payment has been refunded.";
    } catch (e) {
      console.error("[checkout] couldn't refund an unused payment", orderId.slice(0, 12), (e as Error).message);
      after = "We'll refund your payment; if you don't see it in a few days, contact us.";
    }
  }
  const message = `${r.error} ${after}`;
  await done("failed", null, message);
  console.info("[checkout] not completed", orderId.slice(0, 12), kind, r.error);
  return fail(message);
}
