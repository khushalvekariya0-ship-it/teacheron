"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CircleCheck, Eye, MessagesSquare, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Controls";
import { EmptyState } from "@/components/ui/States";
import { Skeleton } from "@/components/ui/Skeleton";
import { useApp } from "@/lib/store";
import { useHydrated } from "@/lib/store/hooks";

/**
 * Parental consent for students aged 13–17. In production this page is reached from a signed,
 * expiring link emailed to the parent; here the student's pending request is looked up locally.
 */
export function ConsentView() {
  const params = useSearchParams();
  const userId = params.get("user") ?? "";
  const hydrated = useHydrated();
  const users = useApp((s) => s.users);
  const confirm = useApp((s) => s.confirmParentalConsent);
  const student = React.useMemo(() => users.find((u) => u.id === userId), [users, userId]);
  const [email, setEmail] = React.useState("");
  const [agree, setAgree] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const granted = student?.parentalConsent?.status === "granted";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree) {
      setError("Please confirm you are the student's parent or legal guardian.");
      return;
    }
    setSubmitting(true);
    const res = confirm(userId, email);
    setSubmitting(false);
    if (!res.ok) setError(res.error);
    else setError(null);
  };

  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-surface px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {!hydrated ? (
            <div className="space-y-3 p-8">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !student?.parentalConsent ? (
            <EmptyState icon={<ShieldCheck />} title="This approval link isn't valid" description="It may have expired or already been used. Ask your student to send a new request from their account." action={<Button asChild variant="secondary"><Link href="/">Go to TutorLink</Link></Button>} />
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              {granted ? (
                <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-8 text-center">
                  <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", bounce: 0.4 }} className="mx-auto grid size-12 place-items-center rounded-xl bg-teal-soft text-ink">
                    <CircleCheck className="size-6" />
                  </motion.div>
                  <h1 className="mt-5 font-heading text-2xl font-bold tracking-[-0.025em]">Account approved</h1>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {student.firstName} can now message tutors, book lessons and post requirements. Create a parent account any time to see their lessons and messages in one place.
                  </p>
                  <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
                    <Button asChild><Link href="/register?role=parent">Create a parent account</Link></Button>
                    <Button asChild variant="secondary"><Link href="/safety">Read our safety guidelines</Link></Button>
                  </div>
                </motion.div>
              ) : (
                <motion.form key="form" onSubmit={submit} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6 sm:p-8" noValidate>
                  <p className="eyebrow">Parental consent</p>
                  <h1 className="mt-2 font-heading text-2xl font-bold tracking-[-0.025em]">Approve {student.firstName}&rsquo;s TutorLink account</h1>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {student.firstName} {student.lastName.charAt(0)}. signed up as a student and listed you as their parent or guardian. Students under 18 need your approval before they can message tutors or book lessons.
                  </p>
                  <ul className="mt-5 space-y-2.5 rounded-xl bg-canvas p-4 text-[13.5px] text-ink-2">
                    <li className="flex gap-2.5"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink" /> Phone numbers and emails are hidden automatically in messages.</li>
                    <li className="flex gap-2.5"><MessagesSquare className="mt-0.5 size-4 shrink-0 text-ink" /> Conversations involving minors can be reviewed by our Trust &amp; Safety team if reported.</li>
                    <li className="flex gap-2.5"><Eye className="mt-0.5 size-4 shrink-0 text-ink" /> A parent account can see lessons, homework and progress.</li>
                  </ul>
                  <Field label="Your email address" hint="Must match the email the student entered." error={error ?? undefined} className="mt-5">
                    <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
                  </Field>
                  <Checkbox className="mt-4" checked={agree} onCheckedChange={(v) => setAgree(v === true)} label={`I am ${student.firstName}'s parent or legal guardian and I consent to them using TutorLink.`} />
                  <Button type="submit" className="mt-6 w-full" size="lg" loading={submitting} disabled={!email}>
                    Approve account
                  </Button>
                  <p className="mt-3 text-center text-xs text-muted">Don&rsquo;t recognize this request? You can safely ignore it — the account stays restricted.</p>
                </motion.form>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </main>
  );
}
