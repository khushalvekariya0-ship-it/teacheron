import "server-only";
import type { ProviderOp } from "@/lib/domain/actions";
import { db } from "./db";
import { capturePayment, fetchPayment, listRefunds, RazorpayError, refundPayment } from "./razorpay";

/*
 * The Razorpay calls a saved action asked for (see ProviderOp in src/lib/domain/actions.ts). They run once,
 * AFTER the change is saved, never inside the database transaction (which can be retried): so a refund is
 * never sent twice, and a slow payment service never holds database locks.
 *
 *   capture: take a held payment (the tutor accepted, or an instant booking). If Razorpay refuses (the hold
 *            ran out, the bank declined), the caller marks the lesson "payment failed".
 *   refund:  send the refund recorded in a payments row, tagged with that row's id. Before sending, the
 *            payment's existing refunds are checked for that tag, so a retry after a crash can't refund twice.
 *            A refund that can't be sent now stays pending (provider_refund_id empty) and the scheduler retries it.
 */

export interface FailedCapture {
  bookingId: string;
  reason: string;
}

export async function performProviderOps(ops: ProviderOp[]): Promise<{ failedCaptures: FailedCapture[] }> {
  const failedCaptures: FailedCapture[] = [];
  for (const op of ops) {
    if (op.kind === "capture") {
      const r = await captureOnce(op.paymentId, op.amount, op.currency);
      if (!r.ok) failedCaptures.push({ bookingId: op.bookingId, reason: r.reason });
    } else {
      await refundOnce(op.paymentRowId, op.paymentId, op.amount).catch((e) => console.error("[payments] refund will be retried for row", op.paymentRowId, (e as Error).message));
    }
  }
  return { failedCaptures };
}

async function captureOnce(paymentId: string, amount: number, currency: ProviderOp["currency"]): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    await capturePayment(paymentId, amount, currency);
    return { ok: true };
  } catch (e) {
    // Already taken (a repeated call) counts as done.
    const p = await fetchPayment(paymentId).catch(() => null);
    if (p?.status === "captured") return { ok: true };
    const status = e instanceof RazorpayError ? e.status : 0;
    console.error("[payments] capture failed", paymentId.slice(0, 8), status, (e as Error).message);
    if (status >= 500 || status === 0) return { ok: false, reason: "The payment service didn't answer, so the payment couldn't be taken" };
    return { ok: false, reason: p?.status === "failed" ? "The bank declined the payment" : "The payment hold ran out before the lesson was accepted" };
  }
}

/** Sends the refund for one payments row (idempotent: tagged with the row id). */
export async function refundOnce(rowId: string, paymentId: string, amount: number): Promise<string> {
  const existing = (await listRefunds(paymentId)).find((r) => r.notes?.row === rowId);
  const refund = existing ?? (await refundPayment(paymentId, amount, { row: rowId }));
  await db()`update public.payments set provider_refund_id = ${refund.id} where id = ${rowId} and provider_refund_id is null`;
  return refund.id;
}

/** Refunds recorded but not yet sent to Razorpay (the service was down, or the server stopped); run by the scheduler. */
export async function retryPendingRefunds(limit = 20): Promise<number> {
  const rows = await db()`
    select id, provider_payment_id, -amount_cents as amount from public.payments
    where provider = 'razorpay' and amount_cents < 0 and provider_refund_id is null and provider_payment_id is not null
      and created_at > now() - interval '60 days'
    order by created_at limit ${limit}`;
  let sent = 0;
  for (const r of rows) {
    try {
      await refundOnce(String(r.id), String(r.provider_payment_id), Number(r.amount));
      sent++;
    } catch (e) {
      console.error("[payments] refund retry failed for row", r.id, (e as Error).message);
    }
  }
  return sent;
}
