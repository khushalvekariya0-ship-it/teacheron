"use client";

import * as React from "react";
import { Banknote, Globe, Landmark, Pencil, Smartphone } from "lucide-react";
import type { PayoutAccount, PayoutMethod } from "@/lib/types";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { RadioCards } from "@/components/ui/Controls";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter } from "@/components/ui/Overlay";
import { toast } from "@/components/ui/Toast";

/*
 * Where the tutor wants their earnings sent. TutorLink sends payouts by hand (UPI or bank transfer) and
 * records each one; the tutor gets an email with the reference. Only the tutor and staff who handle
 * payments see these details.
 */

export const PAYOUT_METHOD_NAME: Record<PayoutMethod, string> = { upi: "UPI", bank: "Bank account", other: "Other" };

/** One line about where payouts go: "UPI · name@okhdfcbank", "Bank account · •••• 1234 · HDFC0001234". */
export function payoutSummary(a: PayoutAccount): string {
  if (a.method === "upi") return `UPI · ${a.upiId}`;
  if (a.method === "bank") return `Bank account · •••• ${(a.accountNumber ?? "").slice(-4)} · ${a.ifsc}${a.bankName ? ` · ${a.bankName}` : ""}`;
  return `Other · ${a.details}`;
}

export function PayoutDetailsCard({ tutorId, disputeDays }: { tutorId: string; disputeDays: number }) {
  const account = useApp((s) => s.payoutAccounts.find((a) => a.tutorId === tutorId));
  const [open, setOpen] = React.useState(false);
  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Landmark className="size-4 text-ink" aria-hidden /> How you get paid
          </span>
        }
        action={
          account ? (
            <Badge tone="success" size="sm" dot>
              Added
            </Badge>
          ) : (
            <Badge tone="warning" size="sm" dot>
              Needed
            </Badge>
          )
        }
      />
      <CardContent className="space-y-4 pt-4 text-[13.5px] leading-relaxed text-muted">
        {account ? (
          <div className="rounded-lg border border-line bg-canvas px-3 py-2.5">
            <p className="font-medium text-ink">{account.accountHolder}</p>
            <p className="break-words font-mono text-[12.5px]" data-payout-summary>
              {payoutSummary(account)}
            </p>
          </div>
        ) : (
          <p>Add your UPI ID or bank account so TutorLink can send you what you&apos;re owed.</p>
        )}
        <Button variant={account ? "secondary" : "primary"} size="sm" onClick={() => setOpen(true)}>
          {account ? <Pencil /> : <Banknote />} {account ? "Change payout details" : "Add payout details"}
        </Button>
        <p className="text-[12.5px]">
          Each lesson&apos;s earnings (minus TutorLink&apos;s fee) can be paid {disputeDays} days after it ends. TutorLink sends payouts to these details and emails you the reference each time.
        </p>
      </CardContent>
      <PayoutDetailsDialog account={account} open={open} onOpenChange={setOpen} />
    </Card>
  );
}

function PayoutDetailsDialog({ account, open, onOpenChange }: { account?: PayoutAccount; open: boolean; onOpenChange: (o: boolean) => void }) {
  const save = useApp((s) => s.savePayoutAccount);
  const [method, setMethod] = React.useState<PayoutMethod>(account?.method ?? "upi");
  const [holder, setHolder] = React.useState(account?.accountHolder ?? "");
  const [upiId, setUpiId] = React.useState(account?.upiId ?? "");
  const [accountNumber, setAccountNumber] = React.useState(account?.accountNumber ?? "");
  const [ifsc, setIfsc] = React.useState(account?.ifsc ?? "");
  const [bankName, setBankName] = React.useState(account?.bankName ?? "");
  const [details, setDetails] = React.useState(account?.details ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setMethod(account?.method ?? "upi");
      setHolder(account?.accountHolder ?? "");
      setUpiId(account?.upiId ?? "");
      setAccountNumber(account?.accountNumber ?? "");
      setIfsc(account?.ifsc ?? "");
      setBankName(account?.bankName ?? "");
      setDetails(account?.details ?? "");
      setError(null);
    }
  }
  const edit = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setter(e.target.value);
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await save(
      method === "upi"
        ? { method, accountHolder: holder, upiId }
        : method === "bank"
          ? { method, accountHolder: holder, accountNumber, ifsc, bankName }
          : { method, accountHolder: holder, details },
    );
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success("Payout details saved");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={account ? "Change payout details" : "Add payout details"} description="Where TutorLink sends what you're owed. Only you and TutorLink's payments team can see this.">
        <form onSubmit={submit} noValidate>
          <DialogBody className="space-y-5">
            <RadioCards<PayoutMethod>
              name="payout-method"
              value={method}
              onValueChange={(v) => {
                setMethod(v);
                setError(null);
              }}
              columns={3}
              options={[
                { value: "upi", label: "UPI", description: "India", icon: <Smartphone /> },
                { value: "bank", label: "Bank account", description: "India (IFSC)", icon: <Landmark /> },
                { value: "other", label: "Other", description: "Outside India", icon: <Globe /> },
              ]}
            />
            <Field label="Name on the account" required>
              <Input value={holder} onChange={edit(setHolder)} autoComplete="name" maxLength={100} />
            </Field>
            {method === "upi" && (
              <Field label="UPI ID" required hint="Like yourname@okhdfcbank or 98xxxxxx10@ybl. Check it in your UPI app.">
                <Input value={upiId} onChange={edit(setUpiId)} autoComplete="off" autoCapitalize="none" spellCheck={false} className="font-mono" maxLength={320} />
              </Field>
            )}
            {method === "bank" && (
              <>
                <Field label="Account number" required>
                  <Input value={accountNumber} onChange={edit(setAccountNumber)} inputMode="numeric" autoComplete="off" className="font-mono" maxLength={24} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="IFSC code" required hint="11 characters, on your cheque book or bank app.">
                    <Input value={ifsc} onChange={edit(setIfsc)} autoComplete="off" autoCapitalize="characters" spellCheck={false} className="font-mono uppercase" maxLength={11} />
                  </Field>
                  <Field label="Bank name" optional>
                    <Input value={bankName} onChange={edit(setBankName)} autoComplete="off" maxLength={100} />
                  </Field>
                </div>
              </>
            )}
            {method === "other" && (
              <Field label="How to pay you" required hint="For example your PayPal email, or your bank's IBAN and SWIFT code and the bank's name and country.">
                <Textarea value={details} onChange={edit(setDetails)} maxLength={500} showCount rows={4} />
              </Field>
            )}
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
              Save details
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
