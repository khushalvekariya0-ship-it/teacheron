"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowRight, BadgeCheck, GraduationCap, ScrollText, ShieldCheck } from "lucide-react";
import type { VerificationKind, VerificationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EASE, Stagger, StaggerItem } from "@/components/motion";
import { VERIFICATION_LABEL, VerificationStatusBadge } from "@/components/domain/Badges";

export const VERIFICATION_STATES: { status: VerificationStatus; body: string }[] = [
  { status: "not_started", body: "Nothing has been submitted for this check yet. No badge is shown." },
  { status: "submitted", body: "Documents have been received and are waiting for a reviewer." },
  { status: "under_review", body: "A member of our team is reviewing the documents. Still no badge — nothing is implied while a check is in progress." },
  { status: "verified", body: "The check is complete. Only now does the matching badge appear on the tutor's profile." },
  { status: "rejected", body: "We couldn't verify what was submitted. No badge is shown, and the tutor can submit updated documents." },
  { status: "expired", body: "A credential or screening has passed its validity date. The badge is removed until the check is renewed." },
];

export const VERIFICATION_CHECKS: { kind: VerificationKind; icon: React.ReactNode; body: string }[] = [
  { kind: "identity", icon: <BadgeCheck />, body: "A government-issued photo ID matched to the person creating the profile. This powers the “ID verified” badge on cards and profiles." },
  { kind: "education", icon: <GraduationCap />, body: "Degrees and institutions listed on the profile, checked against diplomas, transcripts or registrar confirmation." },
  { kind: "certification", icon: <ScrollText />, body: "Teaching licenses and professional certifications, checked against the issuing body where possible." },
  { kind: "background", icon: <ShieldCheck />, body: "A background screening workflow, run through a third-party screening provider with the tutor's consent, where applicable." },
];

function Node({ status, delay, className }: { status: VerificationStatus; delay: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.5, ease: EASE, delay }}
      className={cn("relative z-10 flex items-center justify-center rounded-xl border border-line bg-surface px-3 py-3", className)}
    >
      <VerificationStatusBadge status={status} />
    </motion.div>
  );
}

function Connector({ delay, vertical }: { delay: number; vertical?: boolean }) {
  return (
    <div className={cn("relative flex items-center justify-center", vertical ? "h-6 w-full" : "h-full w-6 sm:w-10")} aria-hidden>
      <div className={cn("bg-line", vertical ? "h-full w-px" : "h-px w-full")}>
        <motion.div
          className={cn("bg-ink", vertical ? "h-full w-px origin-top" : "h-px w-full origin-left")}
          initial={vertical ? { scaleY: 0 } : { scaleX: 0 }}
          whileInView={vertical ? { scaleY: 1 } : { scaleX: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.5, ease: EASE, delay }}
        />
      </div>
    </div>
  );
}

/** The verification state machine as a small diagram, plus a plain-language list of every state. */
export function VerificationFlow() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 sm:p-8">
      <div
        className="relative mx-auto max-w-3xl"
        role="img"
        aria-label="Verification states: Not started, then Submitted, then Under review, which ends as Verified or Rejected. A verified check can later become Expired."
      >
        {/* Large screens: horizontal pipeline with a fork */}
        <div className="relative hidden items-stretch justify-center lg:flex">
          <Node status="not_started" delay={0} className="self-center" />
          <Connector delay={0.2} />
          <Node status="submitted" delay={0.3} className="self-center" />
          <Connector delay={0.5} />
          <Node status="under_review" delay={0.6} className="self-center" />
          <div className="flex items-center" aria-hidden>
            <Connector delay={0.8} />
            <ArrowRight className="-ml-1.5 size-3.5 text-ink" />
          </div>
          <div className="flex flex-col justify-center gap-3">
            <div className="flex items-center">
              <Node status="verified" delay={0.9} />
              <Connector delay={1.1} />
              <Node status="expired" delay={1.2} className="border-dashed" />
            </div>
            <Node status="rejected" delay={1} className="self-start" />
          </div>
        </div>
        {/* Smaller screens: vertical */}
        <div className="relative flex flex-col items-center lg:hidden">
          <Node status="not_started" delay={0} />
          <Connector vertical delay={0.15} />
          <Node status="submitted" delay={0.25} />
          <Connector vertical delay={0.4} />
          <Node status="under_review" delay={0.5} />
          <Connector vertical delay={0.65} />
          <div className="flex gap-3">
            <Node status="verified" delay={0.75} />
            <Node status="rejected" delay={0.85} />
          </div>
          <Connector vertical delay={0.95} />
          <Node status="expired" delay={1.05} className="border-dashed" />
        </div>
      </div>

      <Stagger className="mt-10 grid gap-x-8 gap-y-5 border-t border-line pt-8 sm:grid-cols-2 lg:grid-cols-3" stagger={0.06}>
        {VERIFICATION_STATES.map((s) => (
          <StaggerItem key={s.status}>
            <VerificationStatusBadge status={s.status} />
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{s.body}</p>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}

export function VerificationChecksGrid() {
  return (
    <Stagger className="grid gap-4 sm:grid-cols-2" stagger={0.07}>
      {VERIFICATION_CHECKS.map((c) => (
        <StaggerItem key={c.kind} className="h-full">
          <div className="flex h-full gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-sky-soft text-ink [&_svg]:size-5">{c.icon}</span>
            <div>
              <h3 className="text-[17px] font-bold tracking-[-0.01em] text-ink">{VERIFICATION_LABEL[c.kind]}</h3>
              <p className="mt-1 text-[14.5px] leading-relaxed text-ink-2">{c.body}</p>
            </div>
          </div>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
