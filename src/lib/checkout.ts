/*
 * Razorpay Checkout in the browser. The server makes the order (exact amount, see src/server/checkout.ts);
 * this only opens Razorpay's own payment window for it and hands back what Razorpay returns, which the
 * server then checks. No card or UPI details ever touch TutorLink.
 */

export type CheckoutKind = "booking" | "booking_retry" | "study_credits" | "lead_credits" | "plan";

export interface CheckoutOrder {
  orderId: string;
  keyId: string;
  amount: number;
  currency: string;
  description: string;
  checkoutUrl: string;
  name: string;
  email: string;
  method?: "upi" | "card";
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}
interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", cb: (r: { error?: { description?: string } }) => void): void;
}
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let loading: Promise<void> | null = null;

/*
 * Whether Razorpay's window is open. It sits on top of the page, outside any of the site's dialogs or
 * drawers, so while it's open those stop trapping clicks and keyboard focus (see Dialog in
 * src/components/ui/Overlay.tsx); otherwise the payment window couldn't be used.
 */
let windowOpen = false;
const listeners = new Set<() => void>();
export const checkoutWindowOpen = () => windowOpen;
export function subscribeCheckoutWindow(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function setWindowOpen(v: boolean) {
  windowOpen = v;
  listeners.forEach((l) => l());
}

/** Loads Razorpay's checkout.js once. */
function loadCheckout(url: string): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.onload = () => (window.Razorpay ? resolve() : reject(new Error("Checkout didn't load")));
    s.onerror = () => {
      loading = null;
      s.remove();
      reject(new Error("Checkout didn't load"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export type CheckoutOutcome = { ok: true; paymentId: string; signature: string } | { ok: false; error: string };

/** Opens Razorpay's payment window for an order and waits until it's paid or closed. */
export async function openCheckout(order: CheckoutOrder): Promise<CheckoutOutcome> {
  try {
    await loadCheckout(order.checkoutUrl);
  } catch {
    return { ok: false, error: "The payment window couldn't open. Check your connection and try again." };
  }
  const Razorpay = window.Razorpay!;
  setWindowOpen(true);
  return new Promise<CheckoutOutcome>((done) => {
    const resolve = (o: CheckoutOutcome) => {
      setWindowOpen(false);
      done(o);
    };
    let lastError: string | null = null;
    const rz = new Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: "TutorLink",
      description: order.description,
      prefill: { name: order.name, email: order.email, ...(order.method ? { method: order.method } : {}) },
      theme: { color: "#e8552b" },
      handler: (r: RazorpayResponse) => resolve({ ok: true, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }),
      // A failed try can be retried inside Razorpay's window; closing it ends the attempt.
      modal: { ondismiss: () => resolve({ ok: false, error: lastError ? `${lastError} Nothing was charged.` : "Payment cancelled. Nothing was charged." }) },
    });
    rz.on("payment.failed", (r) => {
      lastError = r?.error?.description ? `${r.error.description.replace(/\.$/, "")}.` : "The payment didn't go through.";
    });
    rz.open();
  });
}
