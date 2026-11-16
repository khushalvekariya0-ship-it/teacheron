"use client";

import * as React from "react";
import type { CreditPack, Plan } from "@/lib/data/platform";
import { FREE_PLAN_ID } from "@/lib/data/platform";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Controls";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter } from "@/components/ui/Overlay";
import { toast } from "@/components/ui/Toast";
import { bpsToPercent, parsePercentToBps } from "./PlatformFeeCard";
import { moneyInputProps, parseAmount } from "./money";

/*
 * Admin → Plans & credits: the forms for adding and editing tutor plans and lead-credit packs. Prices are
 * set in both price lists (US dollars for tutors outside India, rupees for tutors who charge in ₹); a
 * change applies to the next purchase or renewal, never to months already paid.
 */

/** 99900 → "999", 2950 → "29.50" (for an amount input). */
const toInput = (minor: number) => (minor % 100 ? (minor / 100).toFixed(2) : String(minor / 100));

/** Add a plan (`plan` null) or edit one. */
export function PlanDialog({ plan, open, onOpenChange }: { plan: Plan | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const savePlan = useApp((s) => s.savePlan);
  const starter = plan?.id === FREE_PLAN_ID;
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [usd, setUsd] = React.useState("");
  const [inr, setInr] = React.useState("");
  const [commission, setCommission] = React.useState("");
  const [credits, setCredits] = React.useState("");
  const [features, setFeatures] = React.useState("");
  const [highlighted, setHighlighted] = React.useState(false);
  const [hidden, setHidden] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [prevOpen, setPrevOpen] = React.useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setName(plan?.name ?? "");
      setDescription(plan?.description ?? "");
      setUsd(plan && !starter ? toInput(plan.prices.USD) : "");
      setInr(plan && !starter ? toInput(plan.prices.INR) : "");
      setCommission(plan ? bpsToPercent(plan.commissionBps) : "");
      setCredits(plan ? String(plan.monthlyLeadCredits) : "");
      setFeatures(plan?.features.join("\n") ?? "");
      setHighlighted(!!plan?.highlighted);
      setHidden(!!plan?.hidden);
      setError(null);
    }
  }
  const change = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setter(e.target.value);
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pct = parsePercentToBps(commission);
    if (!pct.ok) return setError(pct.error);
    const monthly = credits.trim();
    if (!/^\d{1,4}$/.test(monthly)) return setError("Enter the monthly job credits as a whole number, like 20.");
    let prices = { USD: 0, INR: 0 };
    if (!starter) {
      const d = parseAmount(usd, "USD");
      if (!d.ok) return setError(`US dollar price: ${d.error}`);
      const r = parseAmount(inr, "INR");
      if (!r.ok) return setError(`Rupee price: ${r.error}`);
      prices = { USD: d.cents, INR: r.cents };
    }
    setBusy(true);
    const res = await savePlan({
      ...(plan ? { id: plan.id } : {}),
      name,
      description,
      features: features.split("\n").map((f) => f.trim()).filter(Boolean),
      commissionBps: pct.bps,
      monthlyLeadCredits: Number(monthly),
      prices,
      highlighted,
      hidden: starter ? false : hidden,
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    toast.success(plan ? `${res.data.name} saved` : `${res.data.name} added`, { description: "The pricing page and tutors' plan choices show it now." });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" title={plan ? `Edit ${plan.name}` : "Add a plan"} description="Changes apply to new subscriptions and renewals. Months tutors already paid for don't change.">
        <form onSubmit={submit} noValidate>
          <DialogBody className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Plan name" required>
                <Input id="plan-name" value={name} onChange={change(setName)} maxLength={40} autoComplete="off" />
              </Field>
              <Field label="Commission per paid lesson (%)" required hint={starter ? "Starter's commission is the platform fee: changing it here changes that too." : "0 to 30."}>
                <Input id="plan-commission" value={commission} onChange={change(setCommission)} inputMode="decimal" autoComplete="off" suffix={<span className="pr-1 text-[13px] text-muted">%</span>} />
              </Field>
            </div>
            <Field label="Short description" optional>
              <Textarea id="plan-description" value={description} onChange={change(setDescription)} maxLength={200} rows={2} />
            </Field>
            {starter ? (
              <p className="rounded-lg bg-canvas px-3.5 py-2.5 text-[13px] text-muted">Starter is free: it&apos;s the plan every tutor is on until they choose another.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Monthly price in rupees" required hint="Paid by tutors who charge in ₹.">
                  <Input id="plan-inr" value={inr} onChange={change(setInr)} inputMode="decimal" autoComplete="off" className="tabular-nums" {...moneyInputProps("INR")} />
                </Field>
                <Field label="Monthly price in US dollars" required hint="Paid by every other tutor.">
                  <Input id="plan-usd" value={usd} onChange={change(setUsd)} inputMode="decimal" autoComplete="off" className="tabular-nums" {...moneyInputProps("USD")} />
                </Field>
              </div>
            )}
            <Field label="Job application credits each month" required hint="Added when the tutor pays for the month.">
              <Input id="plan-credits" value={credits} onChange={change(setCredits)} inputMode="numeric" autoComplete="off" className="tabular-nums sm:max-w-40" />
            </Field>
            <Field label="What's included" optional hint="One per line, up to 8. The commission and monthly credits are listed automatically.">
              <Textarea id="plan-features" value={features} onChange={change(setFeatures)} rows={4} placeholder={"Everything in Professional\nPriority support"} />
            </Field>
            <div className="space-y-3">
              <Checkbox id="plan-highlighted" checked={highlighted} onCheckedChange={(v) => setHighlighted(v === true)} label="Recommended" description="Highlighted on the pricing page. Only one plan can be recommended." />
              {!starter && (
                <Checkbox id="plan-hidden" checked={hidden} onCheckedChange={(v) => setHidden(v === true)} label="Hidden" description="Not offered to new tutors. Tutors already on it keep it and can renew." />
              )}
            </div>
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
              {plan ? "Save plan" : "Add plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Add a credit pack (`pack` null) or edit one. */
export function PackDialog({ pack, open, onOpenChange }: { pack: CreditPack | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const savePack = useApp((s) => s.saveCreditPack);
  const [credits, setCredits] = React.useState("");
  const [usd, setUsd] = React.useState("");
  const [inr, setInr] = React.useState("");
  const [hidden, setHidden] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [prevOpen, setPrevOpen] = React.useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setCredits(pack ? String(pack.credits) : "");
      setUsd(pack ? toInput(pack.prices.USD) : "");
      setInr(pack ? toInput(pack.prices.INR) : "");
      setHidden(!!pack?.hidden);
      setError(null);
    }
  }
  const change = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{1,4}$/.test(credits.trim())) return setError("Enter the number of credits, like 25.");
    const d = parseAmount(usd, "USD");
    if (!d.ok) return setError(`US dollar price: ${d.error}`);
    const r = parseAmount(inr, "INR");
    if (!r.ok) return setError(`Rupee price: ${r.error}`);
    setBusy(true);
    const res = await savePack({ ...(pack ? { id: pack.id } : {}), credits: Number(credits.trim()), prices: { USD: d.cents, INR: r.cents }, hidden });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    toast.success(pack ? "Credit pack saved" : "Credit pack added");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={pack ? `Edit the ${pack.credits}-credit pack` : "Add a credit pack"} description="Changes apply to the next purchase. Credits tutors already bought stay in their balance.">
        <form onSubmit={submit} noValidate>
          <DialogBody className="space-y-5">
            <Field label="Credits in the pack" required>
              <Input id="pack-credits" value={credits} onChange={change(setCredits)} inputMode="numeric" autoComplete="off" className="tabular-nums sm:max-w-40" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Price in rupees" required hint="Paid by tutors who charge in ₹.">
                <Input id="pack-inr" value={inr} onChange={change(setInr)} inputMode="decimal" autoComplete="off" className="tabular-nums" {...moneyInputProps("INR")} />
              </Field>
              <Field label="Price in US dollars" required hint="Paid by every other tutor.">
                <Input id="pack-usd" value={usd} onChange={change(setUsd)} inputMode="decimal" autoComplete="off" className="tabular-nums" {...moneyInputProps("USD")} />
              </Field>
            </div>
            <Checkbox id="pack-hidden" checked={hidden} onCheckedChange={(v) => setHidden(v === true)} label="Hidden" description="Not offered for sale. Turn it off to sell it again." />
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
              {pack ? "Save pack" : "Add pack"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
