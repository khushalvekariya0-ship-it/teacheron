"use client";

import * as React from "react";
import { CheckCircle2, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Controls";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { InlineAlert } from "@/components/ui/States";
import { SAFETY_CATEGORIES, safetySchema } from "./safety-schema";

type Kind = "report" | "appeal";
type Errors = Partial<Record<"email" | "category" | "who" | "what" | "form", string>>;

/** The page's hash, so a link to /trust-safety#appeal opens the appeal form. */
const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

/**
 * Report a concern or appeal a suspension, without logging in (suspended accounts can't log in). Both reach
 * Trust & Safety in Admin → Reports; see POST /api/safety.
 */
export function SafetyForm() {
  const hash = React.useSyncExternalStore(subscribeHash, () => window.location.hash, () => "");
  const [picked, setPicked] = React.useState<Kind | null>(null);
  const kind: Kind = picked ?? (hash === "#appeal" ? "appeal" : "report");
  const [email, setEmail] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [who, setWho] = React.useState("");
  const [what, setWhat] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [errors, setErrors] = React.useState<Errors>({});
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState<Kind | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = kind === "report" ? { kind, email, category, who, what, website } : { kind, email, what, website };
    const parsed = safetySchema.safeParse(body);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Errors;
        if (key && !next[key]) next[key] = issue.message;
      }
      return setErrors(next);
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await fetch("/api/safety", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.status === 429) return setErrors({ form: "You've sent a few already. Please wait a while before sending another." });
      if (!data.ok) return setErrors({ form: data.error ?? "We couldn't send it just now. Please try again." });
      setSent(kind);
    } catch {
      setErrors({ form: "You seem to be offline. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div role="status" className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <CheckCircle2 className="size-8 text-success" aria-hidden />
        <h3 className="mt-3 text-[19px] font-bold text-ink">{sent === "report" ? "Thank you for telling us" : "Your appeal was sent"}</h3>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-2">
          {sent === "report"
            ? "A person on our Trust & Safety team will read it, and we'll reply by email if we need more details. For privacy, we can't share what happens to another person's account."
            : "If this email belongs to a suspended TutorLink account, a person on our team will look at your appeal. If the account is restored, you'll be able to log in again with the same details."}
        </p>
        <Button
          variant="secondary"
          className="mt-5"
          onClick={() => {
            setSent(null);
            setWhat("");
            setWho("");
            setCategory("");
          }}
        >
          Send another
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-2xl border border-line bg-surface p-6 sm:p-8" aria-label={kind === "report" ? "Report a concern" : "Appeal a suspension"}>
      {/* The anchor a suspended account's "Appeal" link lands on. */}
      <span id="appeal" className="block scroll-mt-28" aria-hidden />
      <Segmented
        label="What do you want to do?"
        className="flex w-full [&>button]:flex-1 [&>button]:justify-center sm:w-auto"
        value={kind}
        onChange={(v) => {
          setPicked(v as Kind);
          setErrors({});
        }}
        options={[
          { value: "report", label: "Report a concern" },
          { value: "appeal", label: "Appeal a suspension" },
        ]}
      />
      <p className="mt-4 text-[14.5px] leading-relaxed text-ink-2">
        {kind === "report"
          ? "No login needed. Tell us what happened; every report is read by a person. If you have an account, reporting from the conversation, profile or lesson page is fastest."
          : "Suspended accounts can't log in, so appeal here. Use the email of the suspended account and tell us why we should look again. Each decision can be appealed once."}
      </p>

      <div className="mt-6 space-y-5">
        {errors.form && <InlineAlert tone="danger" title={errors.form} />}
        <Field label={kind === "report" ? "Your email" : "Email of the suspended account"} error={errors.email} hint={kind === "report" ? "Only our team sees it, to reply to you." : undefined}>
          <Input type="email" inputMode="email" autoComplete="email" icon={<Mail />} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        {kind === "report" && (
          <>
            <Field label="What is it about?" error={errors.category}>
              <Select value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Choose one" options={SAFETY_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} />
            </Field>
            {category === "child" && (
              <InlineAlert tone="warning" title="If a child is in danger right now">
                Call 112 (India) or your local emergency number first, then tell us here.
              </InlineAlert>
            )}
            <Field label="Who is it about?" optional error={errors.who} hint="A name, or a link to their TutorLink profile, if you have one.">
              <Input value={who} onChange={(e) => setWho(e.target.value)} maxLength={200} placeholder="e.g. https://…/tutors/name" />
            </Field>
          </>
        )}
        <Field label={kind === "report" ? "What happened?" : "Why should we look again?"} error={errors.what} hint={kind === "report" ? "When and where it happened (chat, lesson, profile), and what was said or done." : "What happened, and anything we may have missed."}>
          <Textarea value={what} onChange={(e) => setWhat(e.target.value)} rows={5} maxLength={kind === "report" ? 2000 : 1000} />
        </Field>
        {/* Hidden from people: bots fill every field. */}
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Website
            <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>
        <Button type="submit" size="lg" loading={busy}>
          <Send /> {kind === "report" ? "Send report" : "Send appeal"}
        </Button>
      </div>
    </form>
  );
}
