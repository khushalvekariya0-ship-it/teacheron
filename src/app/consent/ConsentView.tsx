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

type Student = { firstName: string; lastInitial: string; status: "pending" | "granted" };

/**
 * Parental consent for students aged 13–17, reached from the link emailed to the parent
 * (`?token=`). The token is checked on the server; it works once and expires after 14 days.
 */
export function ConsentView() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [student, setStudent] = React.useState<Student | null | undefined>(undefined);
  const [email, setEmail] = React.useState("");
  const [agree, setAgree] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    if (!token) return;
    fetch(`/api/consent?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((b: { ok?: boolean; student?: Student }) => !cancelled && setStudent(b.ok && b.student ? b.student : null))
      .catch(() => !cancelled && setStudent(null));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree) {
      setError("Please confirm you are the student's parent or legal guardian.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, email }) });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!body?.ok) setError(body?.error ?? "We couldn't approve the account. Please try again.");
      else {
        setError(null);
        setStudent((s) => (s ? { ...s, status: "granted" } : s));
      }
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const loading = !!token && student === undefined;
  const granted = student?.status === "granted";

  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-page px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {loading ? (
            <div className="space-y-3 p-8">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !student ? (
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
                    {student.firstName} {student.lastInitial}. signed up as a student and listed you as their parent or guardian. Students under 18 need your approval before they can message tutors or book lessons.
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
