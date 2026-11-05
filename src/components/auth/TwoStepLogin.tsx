"use client";

import * as React from "react";
import { Copy, Download, KeyRound, ShieldAlert, ShieldCheck } from "lucide-react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/Overlay";
import { Field, Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

type Step = null | { kind: "setup"; factorId: string; qrCode: string; secret: string } | { kind: "off" } | { kind: "new-codes" } | { kind: "codes"; codes: string[] };

/**
 * Two-step login for any account: turn it on (scan a QR code, confirm a code, save the backup codes),
 * make new backup codes, or turn it off (confirm a code). `codesLeft` is how many backup codes are unused.
 */
export function TwoStepLogin({ on, staff = false, codesLeft, onChange }: { on: boolean; staff?: boolean; codesLeft?: number; onChange?: () => void }) {
  const enroll = useApp((s) => s.enrollMfa);
  const verify = useApp((s) => s.verifyMfa);
  const disable = useApp((s) => s.disableMfa);
  const newCodes = useApp((s) => s.newRecoveryCodes);
  const [step, setStep] = React.useState<Step>(null);
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const close = () => {
    setStep(null);
    setCode("");
    setError(null);
  };
  const start = async () => {
    setBusy(true);
    const r = await enroll();
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    setStep({ kind: "setup", ...r.data });
  };
  const confirm = async () => {
    if (!step || step.kind === "codes") return;
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code from your authenticator app.");
    setBusy(true);
    try {
      if (step.kind === "setup") {
        const r = await verify(code, step.factorId);
        if (!r.ok) return fail(r.error);
        toast.success("Two-step login is on");
        onChange?.();
        setCode("");
        // Shown once: the server keeps only fingerprints.
        return r.data.recoveryCodes?.length ? setStep({ kind: "codes", codes: r.data.recoveryCodes }) : close();
      }
      if (step.kind === "new-codes") {
        const r = await newCodes(code);
        if (!r.ok) return fail(r.error);
        onChange?.();
        setCode("");
        return setStep({ kind: "codes", codes: r.data.recoveryCodes });
      }
      const r = await disable(code);
      if (!r.ok) return fail(r.error);
      toast.success("Two-step login is off");
      onChange?.();
      close();
    } finally {
      setBusy(false);
    }
  };
  const fail = (message: string) => {
    setCode("");
    setError(message);
  };

  const title = !step ? "" : step.kind === "setup" ? "Set up two-step login" : step.kind === "off" ? "Turn off two-step login?" : step.kind === "new-codes" ? "Get new backup codes" : "Save your backup codes";
  const description = !step
    ? ""
    : step.kind === "setup"
      ? "Scan the QR code with your authenticator app, then enter the code it shows."
      : step.kind === "codes"
        ? "If you lose your phone, sign in with your password and one of these codes. Each code works once."
        : step.kind === "new-codes"
          ? "Enter a code from your authenticator app. Your old backup codes will stop working."
          : "Enter a code from your authenticator app to confirm.";

  return (
    <>
      <div className={cn("flex items-start gap-3 rounded-lg border px-3.5 py-3", on ? "border-success-200 bg-success-50" : "border-warning-200 bg-warning-50")}>
        {on ? <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden /> : <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />}
        <div className="min-w-0">
          <p className={cn("text-[13.5px] font-semibold", on ? "text-success" : "text-warning")}>{on ? "Two-step login is on" : "Two-step login is off"}</p>
          <p className="mt-0.5 text-[12.5px] text-ink-2">
            {on
              ? `Each sign-in asks for a code from your authenticator app.${codesLeft !== undefined ? ` ${codesLeft === 1 ? "1 backup code" : `${codesLeft} backup codes`} left.` : ""}`
              : staff
                ? "Staff accounts should turn this on before handling member data. You'll need an authenticator app such as Google Authenticator or 1Password."
                : "Protect your account even if someone learns your password: each sign-in also asks for a code from an app on your phone, such as Google Authenticator or Microsoft Authenticator."}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button variant={on ? "secondary" : "brand"} size="sm" loading={busy && !step} onClick={on ? () => setStep({ kind: "off" }) : start}>
              {on ? "Turn off" : "Turn on two-step login"}
            </Button>
            {on && (
              <Button variant="ghost" size="sm" onClick={() => setStep({ kind: "new-codes" })}>
                <KeyRound /> New backup codes
              </Button>
            )}
          </div>
        </div>
      </div>

      <Dialog open={!!step} onOpenChange={(o) => !o && close()}>
        <DialogContent size="sm" title={title} description={description}>
          {step?.kind === "codes" ? (
            <BackupCodes codes={step.codes} onDone={close} />
          ) : (
            <>
              <DialogBody className="space-y-4">
                {step?.kind === "setup" && (
                  <>
                    {/* The QR code is an SVG data URL from Supabase Auth. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={step.qrCode} alt="QR code for your authenticator app" className="mx-auto size-44 rounded-lg border border-line bg-white p-2" />
                    <div className="text-[12.5px] text-muted">
                      Can&apos;t scan? Enter this key in the app instead:
                      <code className="mt-1 block break-all rounded-md bg-sunken px-2.5 py-1.5 font-mono text-[12.5px] text-ink">{step.secret}</code>
                    </div>
                  </>
                )}
                <Field label="6-digit code" error={error ?? undefined}>
                  <Input
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                      setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void confirm();
                    }}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    className="font-mono tracking-[0.3em]"
                  />
                </Field>
              </DialogBody>
              <DialogFooter>
                <Button variant="secondary" onClick={close}>
                  Cancel
                </Button>
                <Button variant={step?.kind === "off" ? "danger" : "brand"} loading={busy} onClick={confirm}>
                  {step?.kind === "setup" ? "Turn on" : step?.kind === "new-codes" ? "Get new codes" : "Turn off"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** The backup codes, shown once, with copy and download. */
function BackupCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const text = `TutorLink backup codes for two-step login\nEach code works once. Keep them somewhere safe.\n\n${codes.join("\n")}\n`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      toast.success("Backup codes copied");
    } catch {
      toast.error("Couldn't copy. Select the codes and copy them, or download them.");
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "tutorlink-backup-codes.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <DialogBody className="space-y-3">
        <ul aria-label="Backup codes" className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg border border-line bg-sunken px-4 py-3 font-mono text-[14px] text-ink" data-testid="backup-codes">
          {codes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <p className="text-[12.5px] text-muted">You won&apos;t see these again. Save them in a password manager, or print them and keep them somewhere safe.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => void copy()}>
            <Copy /> Copy
          </Button>
          <Button variant="secondary" size="sm" onClick={download}>
            <Download /> Download
          </Button>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="brand" onClick={onDone}>
          I&apos;ve saved them
        </Button>
      </DialogFooter>
    </>
  );
}
