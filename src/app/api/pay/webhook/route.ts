import { after } from "next/server";
import { finishCheckout } from "@/server/checkout";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { json } from "@/server/http";
import { emailNotifications } from "@/server/notify-email";
import { validWebhookSignature } from "@/server/razorpay";

/*
 * POST /api/pay/webhook: Razorpay's webhook (Razorpay Dashboard → Webhooks, with RAZORPAY_WEBHOOK_SECRET).
 * Only requests signed with the webhook secret are accepted (X-Razorpay-Signature over the raw body).
 *   payment.authorized / payment.captured → finishes an order whose browser closed before confirming it
 *   refund.processed                      → records Razorpay's refund id on the matching refund row
 * Every other event is acknowledged and ignored. Answers 200 quickly so Razorpay doesn't retry needlessly.
 */
export const dynamic = "force-dynamic";

interface WebhookEvent {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string } };
    refund?: { entity?: { id?: string; notes?: Record<string, string> } };
  };
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!env.razorpayWebhookSecret) return json({ ok: false, error: "Webhooks aren't set up." }, { status: 503 });
  if (!validWebhookSignature(raw, request.headers.get("x-razorpay-signature") ?? "")) return json({ ok: false, error: "Bad signature." }, { status: 400 });
  let evt: WebhookEvent;
  try {
    evt = JSON.parse(raw) as WebhookEvent;
  } catch {
    return json({ ok: false, error: "Bad body." }, { status: 400 });
  }
  try {
    const payment = evt.payload?.payment?.entity;
    if ((evt.event === "payment.authorized" || evt.event === "payment.captured") && payment?.id && payment.order_id) {
      const [row] = await db()`select status from public.payment_orders where id = ${payment.order_id}`;
      if (row?.status === "created") {
        const origin = env.siteUrl || new URL(request.url).origin;
        const r = await finishCheckout(payment.order_id, payment.id, { onNotified: (created) => after(() => emailNotifications(created, origin)) });
        console.info("[pay/webhook]", evt.event, "finished an order:", r.ok ? "done" : r.error);
      }
    } else if (evt.event === "refund.processed") {
      const refund = evt.payload?.refund?.entity;
      const rowId = refund?.notes?.row;
      if (refund?.id && rowId) await db()`update public.payments set provider_refund_id = ${refund.id} where id = ${rowId} and provider_refund_id is null`;
    }
    return json({ ok: true });
  } catch (e) {
    console.error("[pay/webhook]", evt.event, (e as Error).message);
    // A 500 makes Razorpay try again later.
    return json({ ok: false }, { status: 500 });
  }
}
