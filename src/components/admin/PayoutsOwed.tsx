"use client";

import * as React from "react";
import { Check, Copy, HandCoins, Landmark } from "lucide-react";
import type { Payout, PayoutAccount, PayoutMethod } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useNow, useTutors } from "@/lib/store/hooks";
import { payoutBalances } from "@/lib/earnings";
import { formatMoney, type Currency } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { RadioCards } from "@/components/ui/Controls";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter } from "@/components/ui/Overlay";
import { EmptyState } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { PAYOUT_METHOD_NAME } from "@/components/dashboard/tutor/PayoutDetails";
import { Mono, PermissionNotice, useDirectory, useStaff } from "./kit";
import { moneyInputProps, parseAmount } from "./money";

/*
 * Admin → Payments → Payouts: what each tutor is owed and where to send it. Staff send the money
 * themselves (UPI or bank transfer), then record it here with the bank / UPI reference; the tutor is
 * emailed. The server checks the amount against the same figures (src/lib/earnings.ts).
 */

interface OwedRow {
  tutorId: string;
  currency: Currency;
  available: number;
  clearing: number;
  account?: PayoutAccount;
}

/** Today's date (YYYY-MM-DD) where the viewer is. */
const localDay = (now: number) => {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function OwedToTutors() {
  const bookings = useApp((s) => s.bookings);
  const payments = useApp((s) => s.payments);
  const payouts = useApp((s) => s.payouts);
  const policy = useApp((s) => s.policy);
  const accounts = useApp((s) => s.payoutAccounts);
  const tutors = useTutors();
  const dir = useDirectory();
  const { can } = useStaff();
  const now = useNow(60_000);
  const [paying, setPaying] = React.useState<OwedRow | null>(null);

  const rows = React.useMemo(() => {
    const tutorIds = new Set([...tutors.map((t) => t.id), ...bookings.map((b) => b.tutorId)]);
    const out: OwedRow[] = [];
    for (const tutorId of tutorIds) {
      for (const b of payoutBalances(tutorId, bookings, payments, payouts, now, policy)) {
        if (b.available > 0 || b.clearing > 0) out.push({ tutorId, currency: b.currency, available: Math.max(0, b.available), clearing: b.clearing, account: accounts.find((a) => a.tutorId === tutorId) });
      }
    }
    return out.sort((a, b) => b.available - a.available || b.clearing - a.clearing);
  }, [tutors, bookings, payments, payouts, now, policy, accounts]);

  const canPay = can("payments.refund");
  return (
    <section aria-labelledby="owed-h" className="mb-6 space-y-3">
      <div>
        <h2 id="owed-h" className="text-[15px] font-semibold tracking-tight text-ink">
          Owed to tutors
        </h2>
        <p className="text-[13px] text-muted">
          Paid lessons minus TutorLink&apos;s fee and refunds. &ldquo;Ready&rdquo; is past the {policy.disputeWindowDays}-day dispute window. Send it by UPI or bank transfer, then record it here.
        </p>
      </div>
      {!canPay && <PermissionNotice permission="payments.refund">Recording payouts needs</PermissionNotice>}
      {rows.length === 0 ? (
        <EmptyState compact icon={<HandCoins />} title="Nothing owed right now" description="Tutors appear here after their paid lessons are completed." />
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface" data-owed-list>
          {rows.map((r) => (
            <li key={`${r.tutorId}-${r.currency}`} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between" data-owed-tutor={r.tutorId}>
              <div className="min-w-0">
                <p className="font-medium text-ink">{dir.name(r.tutorId)}</p>
                <PayoutTarget account={r.account} />
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <div className="text-right">
                  <p className="font-semibold tabular-nums text-ink">{formatMoney(r.available, r.currency)} ready</p>
                  {r.clearing > 0 && <p className="text-[12px] tabular-nums text-muted">{formatMoney(r.clearing, r.currency)} still clearing</p>}
                </div>
                {canPay && (
                  <Button size="sm" disabled={r.available <= 0} onClick={() => setPaying(r)}>
                    Record payout
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <RecordPayoutDialog row={paying} onClose={() => setPaying(null)} today={localDay(now)} />
    </section>
  );
}

/** Where to send the money, with copy buttons for the parts staff type into their banking app. */
function PayoutTarget({ account: a }: { account?: PayoutAccount }) {
  if (!a) return <p className="text-[12.5px] text-warning">No payout details yet: ask the tutor to add them under Earnings.</p>;
  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
      <span>
        {PAYOUT_METHOD_NAME[a.method]} · {a.accountHolder}
      </span>
      {a.method === "upi" && a.upiId && <CopyValue label="UPI ID" value={a.upiId} />}
      {a.method === "bank" && a.accountNumber && <CopyValue label="Account" value={a.accountNumber} />}
      {a.method === "bank" && a.ifsc && <CopyValue label="IFSC" value={a.ifsc} />}
      {a.method === "bank" && a.bankName && <span>{a.bankName}</span>}
      {a.method === "other" && a.details && <span className="basis-full whitespace-pre-line text-ink-2">{a.details}</span>}
    </div>
  );
}

function CopyValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = React.useState(false);
  const masked = value.startsWith("••••");
  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}:</span>
      <Mono className="text-ink">{value}</Mono>
      {!masked && (
        <button
          type="button"
          aria-label={`Copy ${label}`}
          className="rounded p-0.5 text-muted hover:bg-sunken hover:text-ink"
          onClick={() =>
            void navigator.clipboard.writeText(value).then(
              () => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              },
              () => toast.error("Couldn't copy. Select the text and copy it instead."),
            )
          }
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      )}
    </span>
  );
}

function RecordPayoutDialog({ row, onClose, today }: { row: OwedRow | null; onClose: () => void; today: string }) {
  const record = useApp((s) => s.recordPayout);
  const dir = useDirectory();
  // The row last opened (kept while the dialog animates closed); the form resets each time it opens.
  const [prev, setPrev] = React.useState<OwedRow | null>(null);
  const [shown, setShown] = React.useState<OwedRow | null>(null);
  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState<PayoutMethod>("upi");
  const [reference, setReference] = React.useState("");
  const [sentOn, setSentOn] = React.useState(today);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  if (row !== prev) {
    setPrev(row);
    if (row) {
      setShown(row);
      setAmount((row.available / 100).toFixed(2));
      setMethod(row.account?.method ?? "upi");
      setReference("");
      setSentOn(today);
      setNote("");
      setError(null);
    }
  }
  const r = row ?? shown;
  if (!r) return null;
  const change = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setter(e.target.value);
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseAmount(amount, r.currency);
    if (!parsed.ok) return setError(parsed.error);
    if (parsed.cents <= 0) return setError("Enter the amount you sent.");
    if (parsed.cents > r.available) return setError(`That's more than is ready to pay: at most ${formatMoney(r.available, r.currency)}.`);
    if (reference.trim().length < 4) return setError("Enter the payment reference (the UPI or bank transaction ID).");
    setBusy(true);
    const res = await record({ tutorId: r.tutorId, amountCents: parsed.cents, currency: r.currency, method, reference: reference.trim(), sentOn, note: note.trim() || undefined });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    toast.success(`Payout recorded: ${formatMoney(parsed.cents, r.currency)}`, { description: `${dir.name(r.tutorId)} was emailed the reference.` });
    onClose();
  };

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Record a payout to ${dir.name(r.tutorId)}`} description={`Send the money first (UPI or bank transfer), then record it here. Ready to pay: ${formatMoney(r.available, r.currency)}.`}>
        <form onSubmit={submit} noValidate>
          <DialogBody className="space-y-5">
            <div className="rounded-lg border border-line bg-canvas px-3 py-2.5">
              <PayoutTarget account={r.account} />
            </div>
            <Field label={`Amount sent (${r.currency})`} required>
              <Input value={amount} onChange={change(setAmount)} inputMode="decimal" autoComplete="off" className="tabular-nums" {...moneyInputProps(r.currency)} />
            </Field>
            <RadioCards<PayoutMethod>
              name="sent-by"
              value={method}
              onValueChange={(v) => {
                setMethod(v);
                setError(null);
              }}
              columns={3}
              options={[
                { value: "upi", label: "UPI" },
                { value: "bank", label: "Bank transfer" },
                { value: "other", label: "Other" },
              ]}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Reference" required hint="UPI transaction ID or bank UTR number.">
                <Input value={reference} onChange={change(setReference)} autoComplete="off" spellCheck={false} className="font-mono" maxLength={100} />
              </Field>
              <Field label="Sent on" required>
                <Input type="date" value={sentOn} max={today} onChange={change(setSentOn)} />
              </Field>
            </div>
            <Field label="Note" optional hint="Only staff see this.">
              <Textarea value={note} onChange={change(setNote)} maxLength={500} rows={2} />
            </Field>
            {error && (
              <p role="alert" className="text-[13px] text-danger">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" loading={busy}>
              <Landmark /> Record payout
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** "The money didn't arrive": the amount is owed again and the tutor is told. */
export function PayoutFailedButton({ payout }: { payout: Payout }) {
  const markFailed = useApp((s) => s.markPayoutFailed);
  const { can } = useStaff();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  if (payout.status === "failed") return null;
  if (!can("payments.refund")) return <PermissionNotice permission="payments.refund">Changing a payout needs</PermissionNotice>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 5) return setError("Say what happened (5+ characters).");
    setBusy(true);
    const res = await markFailed(payout.id, reason.trim());
    setBusy(false);
    if (!res.ok) return setError(res.error);
    toast.success("Marked as not received", { description: "The amount is owed to the tutor again, and they were told." });
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setReason("");
          setError(null);
          setOpen(true);
        }}
      >
        Mark as not received
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm" title="The tutor didn't get this payout?" description={`${formatMoney(payout.amountCents, payout.currency)} will be owed to them again, and they'll be asked to check their payout details.`}>
          <form onSubmit={submit} noValidate>
            <DialogBody>
              <Field label="What happened" required error={error ?? undefined}>
                <Textarea
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setError(null);
                  }}
                  placeholder="The bank returned the transfer: wrong account number."
                  maxLength={500}
                  rows={3}
                />
              </Field>
            </DialogBody>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" variant="danger" loading={busy}>
                Mark as not received
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
