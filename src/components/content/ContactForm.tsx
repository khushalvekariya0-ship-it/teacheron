"use client";

import * as React from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { CircleCheck, Copy, Send } from "lucide-react";
import { EASE } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { InlineAlert } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { SITE } from "@/lib/site";
import { CONTACT_ROLES, CONTACT_TOPICS, MESSAGE_MAX, MESSAGE_MIN, contactSchema, type ContactInput, type ContactResponse } from "./contact-schema";

type Status = { kind: "idle" } | { kind: "success"; ticketId: string; email: string } | { kind: "error"; message: string };

const FIELDS = ["name", "email", "role", "topic", "message"] as const;

export function ContactForm() {
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });
  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    mode: "onTouched",
    defaultValues: { name: "", email: "", message: "", website: "" },
  });

  const message = useWatch({ control, name: "message" }) ?? "";
  const role = useWatch({ control, name: "role" });
  const topic = useWatch({ control, name: "topic" });

  const onSubmit = handleSubmit(async (values) => {
    setStatus({ kind: "idle" });
    try {
      const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const data = (await res.json().catch(() => null)) as ContactResponse | null;
      if (res.ok && data?.ok) {
        setStatus({ kind: "success", ticketId: data.ticketId, email: values.email });
        reset();
        return;
      }
      if (res.status === 400 && data && !data.ok && data.fieldErrors) {
        for (const key of FIELDS) {
          const msg = data.fieldErrors[key]?.[0];
          if (msg) setError(key, { type: "server", message: msg });
        }
      }
      setStatus({
        kind: "error",
        message:
          res.status === 429
            ? "You've sent several messages in a short time. Please wait a few minutes and try again, or email us directly."
            : data && !data.ok
              ? data.error
              : "We couldn't send your message. Please try again, or email us directly.",
      });
    } catch {
      setStatus({ kind: "error", message: "We couldn't reach our servers. Check your connection and try again." });
    }
  });

  const copyTicket = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      toast.success("Reference copied");
    } catch {
      toast.error("Couldn't copy — please note the reference manually.");
    }
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {status.kind === "success" ? (
        <motion.div
          key="success"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="flex flex-col items-center px-2 py-10 text-center"
          role="status"
        >
          <span className="relative grid size-14 place-items-center rounded-full bg-success-50 text-success">
            <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", bounce: 0.45, duration: 0.6, delay: 0.1 }}>
              <CircleCheck className="size-7" />
            </motion.span>
          </span>
          <h2 className="mt-5 text-xl font-semibold tracking-tight text-ink">Message received</h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
            Thanks for reaching out. We&rsquo;ll reply to <span className="font-medium text-ink-2">{status.email}</span>. Mention your reference if you write to us again about this.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-lg border border-line bg-canvas py-1.5 pl-4 pr-1.5">
            <span className="text-[13px] text-muted">Reference</span>
            <span className="font-mono text-sm font-semibold tracking-wide text-ink">{status.ticketId}</span>
            <Button variant="ghost" size="icon-sm" onClick={() => copyTicket(status.ticketId)} aria-label="Copy reference">
              <Copy />
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button variant="secondary" onClick={() => setStatus({ kind: "idle" })}>
              Send another message
            </Button>
            <Button asChild variant="ghost">
              <Link href="/faq">Browse the FAQ</Link>
            </Button>
          </div>
        </motion.div>
      ) : (
        <motion.form key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={onSubmit} noValidate className="space-y-5" aria-describedby="contact-required-note">
          <p id="contact-required-note" className="text-[13px] text-muted">
            All fields are required.
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Your name" required error={errors.name?.message}>
              <Input autoComplete="name" {...register("name")} />
            </Field>
            <Field label="Email address" required error={errors.email?.message} hint="We'll only use this to reply.">
              <Input type="email" autoComplete="email" inputMode="email" {...register("email")} />
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="I am" required error={errors.role?.message}>
              <Select placeholder="Choose one" options={CONTACT_ROLES.map((r) => ({ value: r.value, label: r.label }))} value={role ?? ""} {...register("role")} />
            </Field>
            <Field label="Topic" required error={errors.topic?.message}>
              <Select placeholder="Choose a topic" options={CONTACT_TOPICS.map((t) => ({ value: t.value, label: t.label }))} value={topic ?? ""} {...register("topic")} />
            </Field>
          </div>
          {topic === "safety" && (
            <InlineAlert tone="warning" title="If someone is in immediate danger, call 911.">
              For concerns about a lesson or a member, you can also report directly from the conversation or lesson page. Safety reports are reviewed before other messages.
            </InlineAlert>
          )}
          <Field
            label="How can we help?"
            required
            error={errors.message?.message}
            hint={`At least ${MESSAGE_MIN} characters. Include booking dates or tutor names if relevant — never card numbers or passwords.`}
          >
            <Textarea rows={6} maxLength={MESSAGE_MAX} showCount value={message} {...register("message")} />
          </Field>
          {/* Honeypot: visually hidden and skipped by keyboard and screen readers. */}
          <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden>
            <label htmlFor="contact-website">Website</label>
            <input id="contact-website" type="text" tabIndex={-1} autoComplete="off" {...register("website")} />
          </div>
          {status.kind === "error" && (
            <InlineAlert tone="danger" title="Your message wasn't sent">
              {status.message} You can also email{" "}
              <a href={`mailto:${SITE.supportEmail}`} className="font-medium text-navy underline underline-offset-2">
                {SITE.supportEmail}
              </a>
              .
            </InlineAlert>
          )}
          <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12.5px] text-muted">
              By sending, you agree to our{" "}
              <Link href="/privacy" className="text-ink-2 underline underline-offset-2 hover:text-ink">
                Privacy Policy
              </Link>
              .
            </p>
            <Button type="submit" size="lg" loading={isSubmitting}>
              {isSubmitting ? "Sending…" : (
                <>
                  Send message <Send />
                </>
              )}
            </Button>
          </div>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
