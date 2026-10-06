"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, CreditCard, Lock, Plus, Smartphone, Wallet, Zap } from "lucide-react";
import type { PayMethod, WalletTransaction } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useHydrated, useSession, useWalletBalance } from "@/lib/store/hooks";
import { STUDY_CREDIT_PACKS } from "@/lib/data/platform";
import { formatCents, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { RadioCards } from "@/components/ui/Controls";
import { Sheet, SheetContent } from "@/components/ui/Overlay";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";

type TopUpMethod = Exclude<PayMethod, "wallet">;

/** Whole dollars read as "$50"; anything else keeps its cents. */
export function formatCredits(cents: number): string {
  return formatCents(cents, { exact: cents % 100 !== 0 });
}

/**
 * The learner's Study Credits: balance, a top-up in two taps, and recent activity.
 * Slides out from the right; opened from the navbar, the checkout and the payments page.
 */
export function WalletDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" title="Study wallet" description="Prepaid credits. Pay for a lesson in one tap." data-lenis-prevent>
        {/* Mounted only while open, so the form starts fresh every time. */}
        <WalletBody onClose={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function WalletBody({ onClose }: { onClose: () => void }) {
  const hydrated = useHydrated();
  const me = useSession();
  const pathname = usePathname();
  const balance = useWalletBalance();
  const allTx = useApp((s) => s.walletTransactions);
  const topUpWallet = useApp((s) => s.topUpWallet);
  const [packId, setPackId] = React.useState(STUDY_CREDIT_PACKS[1].id);
  const [method, setMethod] = React.useState<TopUpMethod>("card");
  const [paying, setPaying] = React.useState(false);

  const recent = React.useMemo(() => (me ? allTx.filter((t) => t.userId === me.id).slice(0, 6) : []), [allTx, me]);
  const pack = STUDY_CREDIT_PACKS.find((p) => p.id === packId) ?? STUDY_CREDIT_PACKS[0];

  if (!hydrated) {
    return (
      <div className="space-y-4 p-5" role="status" aria-label="Loading wallet">
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-12 rounded-full" />
      </div>
    );
  }

  if (!me || (me.role !== "student" && me.role !== "parent")) {
    return (
      <div className="flex flex-col items-center px-6 py-14 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">
          <Wallet className="size-6" aria-hidden />
        </span>
        <h3 className="mt-5 text-lg font-semibold tracking-tight text-ink">{me ? "Wallets are for students and parents" : "Sign in to use your wallet"}</h3>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">
          {me ? "Study Credits pay for lessons, so they live on student and parent accounts." : "Add Study Credits once, then book any lesson in one tap. No card details each time."}
        </p>
        {!me && (
          <div className="mt-6 flex w-full flex-col gap-2">
            <Button asChild variant="cta" size="lg">
              <Link href={`/login?next=${encodeURIComponent(pathname)}`}>Sign in</Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/register">Create a free account</Link>
            </Button>
          </div>
        )}
      </div>
    );
  }

  const pay = async () => {
    if (paying) return;
    setPaying(true);
    // Stand-in for the payment round trip (test mode in the preview build).
    await new Promise((r) => setTimeout(r, 700));
    const res = topUpWallet(pack.id, method);
    setPaying(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`${formatCredits(pack.amountCents)} added to your wallet`, { description: "You can now book a lesson in one tap." });
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className="space-y-6 p-5">
        {/* Balance */}
        <div className="relative isolate overflow-hidden rounded-2xl bg-brand-deep p-5 text-white">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_90%_at_100%_0%,rgb(75_107_99/0.38),transparent_70%),radial-gradient(ellipse_60%_80%_at_0%_100%,rgb(217_80_43/0.28),transparent_70%)]" aria-hidden />
          <p className="flex items-center gap-2 text-[13px] font-medium text-white/70">
            <Wallet className="size-4" aria-hidden /> Study Credits
          </p>
          <p className="mt-2 font-heading text-[2.6rem] font-bold leading-none tracking-[-0.04em] tabular-nums" aria-live="polite">
            {formatCredits(balance)}
          </p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-[13px] font-medium">
            <Zap className="size-3.5 fill-current" aria-hidden />
            {balance > 0 ? "Ready for one-tap booking" : "Add credits to book in one tap"}
          </p>
        </div>

        {/* Top up */}
        <section aria-labelledby="wallet-add">
          <h3 id="wallet-add" className="text-sm font-semibold text-ink">
            Add credits
          </h3>
          <div role="radiogroup" aria-label="Amount" className="mt-3 grid grid-cols-4 gap-2">
            {STUDY_CREDIT_PACKS.map((p) => {
              const on = p.id === packId;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPackId(p.id)}
                  className={cn(
                    "h-12 rounded-xl border text-[15px] font-semibold tabular-nums transition-colors",
                    on ? "border-brand bg-brand-50 text-brand shadow-[0_0_0_1px_var(--color-brand)]" : "border-line bg-surface text-ink hover:border-line-strong",
                  )}
                >
                  {formatCredits(p.amountCents)}
                </button>
              );
            })}
          </div>

          <p className="mb-2 mt-5 text-sm font-medium text-ink">Pay with</p>
          <RadioCards<TopUpMethod>
            name="wallet-method"
            columns={1}
            value={method}
            onValueChange={setMethod}
            options={[
              { value: "card", label: "Card", icon: <CreditCard />, description: "Test card •••• 4242" },
              { value: "upi", label: "UPI", icon: <Smartphone />, description: "Approve in your UPI app" },
            ]}
          />
        </section>

        {/* Activity */}
        <section aria-labelledby="wallet-activity">
          <h3 id="wallet-activity" className="text-sm font-semibold text-ink">
            Recent activity
          </h3>
          {recent.length === 0 ? (
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">Nothing yet. Top-ups, lesson payments and refunds will show here.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {recent.map((t) => (
                <ActivityRow key={t.id} tx={t} onNavigate={onClose} />
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="sticky bottom-0 mt-auto border-t border-line bg-surface/95 px-5 py-4 backdrop-blur">
        <Button variant="cta" size="lg" className="w-full" onClick={pay} loading={paying}>
          {paying ? (
            "Processing…"
          ) : (
            <>
              <Plus /> Add {formatCredits(pack.amountCents)}
            </>
          )}
        </Button>
        <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-[12.5px] text-muted">
          <Lock className="size-3.5" aria-hidden /> Test mode — no real charge. Credits are worth their full value.
        </p>
      </div>
    </div>
  );
}

function ActivityRow({ tx, onNavigate }: { tx: WalletTransaction; onNavigate: () => void }) {
  const incoming = tx.deltaCents > 0;
  const label = tx.kind === "top_up" ? "Credits added" : tx.description;
  return (
    <li className="flex items-center gap-3 py-3">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", incoming ? "bg-success-50 text-success" : "bg-sunken text-ink-2")}>
        {incoming ? <ArrowDownLeft className="size-4" aria-hidden /> : <ArrowUpRight className="size-4" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        {tx.bookingId ? (
          <Link href={`/dashboard/bookings/${tx.bookingId}`} onClick={onNavigate} className="block truncate text-sm font-medium text-ink underline-offset-4 hover:underline">
            {label}
          </Link>
        ) : (
          <p className="truncate text-sm font-medium text-ink">{label}</p>
        )}
        <p className="text-[12.5px] text-muted">
          {formatDate(tx.createdAt)}
          {tx.kind === "top_up" && ` · ${tx.description}`}
        </p>
      </div>
      <span className={cn("shrink-0 text-sm font-semibold tabular-nums", incoming ? "text-success" : "text-ink")}>
        {incoming ? "+" : "−"}
        {formatCredits(Math.abs(tx.deltaCents))}
      </span>
    </li>
  );
}
