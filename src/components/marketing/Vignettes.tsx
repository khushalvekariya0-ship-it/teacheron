"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Bell, Briefcase, CalendarClock, CalendarDays, Check, CreditCard, Gift, LineChart, MessageSquareLock, Search, ShieldCheck, Star, UserRound,
  Users, Wallet, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE } from "@/components/motion";
import { CREDITS_PER_APPLICATION, DEFAULT_POLICY } from "@/lib/data/platform";

/*
 * Feature visuals for marketing pages. They describe what the product does — no example people,
 * prices, times or messages — so nothing on the page can be mistaken for real listings.
 */

const TONE = {
  brand: "bg-brand-soft",
  sky: "bg-sky-soft",
  teal: "bg-teal-soft",
  violet: "bg-violet-soft",
  canvas: "bg-canvas",
} as const;

export function FeatureVisual({
  icon: Icon,
  title,
  points,
  tone = "brand",
  className,
}: {
  icon: LucideIcon;
  title: string;
  points: string[];
  tone?: keyof typeof TONE;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div className={cn("relative overflow-hidden rounded-2xl p-5 sm:p-8", TONE[tone], className)}>
      <div className="rounded-xl bg-surface p-5 shadow-sm ring-1 ring-line sm:p-6">
        <div className="flex items-center gap-3.5">
          <motion.span
            initial={reduce ? false : { scale: 0.7, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand text-on-brand"
          >
            <Icon className="size-6" aria-hidden />
          </motion.span>
          <p className="text-[17px] font-semibold text-ink">{title}</p>
        </div>
        <ul className="mt-5 space-y-3">
          {points.map((p, i) => (
            <motion.li
              key={p}
              initial={reduce ? false : { opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.4, ease: EASE, delay: 0.15 + i * 0.08 }}
              className="flex items-start gap-3 text-[15px] leading-snug text-ink-2"
            >
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                <Check className="size-3.5" strokeWidth={3} aria-hidden />
              </span>
              {p}
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ─── Families ───────────────────────────────────────────────────────────── */

export function SearchVignette() {
  return <FeatureVisual icon={Search} title="Search that fits your needs" points={["Subject, grade and level", "Schedule, budget and ZIP code", "Online or in-person lessons"]} />;
}

export function MessageVignette({ variant = "masked" }: { variant?: "masked" | "parent" }) {
  return variant === "parent" ? (
    <FeatureVisual icon={MessageSquareLock} tone="sky" title="You see every conversation" points={["Messages about your child are visible to you", "Contact details stay private", "Report or block in one tap"]} />
  ) : (
    <FeatureVisual icon={MessageSquareLock} tone="sky" title="Safe, private messaging" points={["Phone numbers and emails are hidden automatically", "Every message can be reported", "Conversations stay on TutorLink"]} />
  );
}

export function SlotVignette() {
  return <FeatureVisual icon={CalendarClock} tone="teal" title="Book a real opening" points={["Times shown in your own time zone", "Trial and regular lessons", "Cancellation policy shown before you pay"]} />;
}

export function CheckoutVignette() {
  return <FeatureVisual icon={CreditCard} title="Clear, secure checkout" points={["Payments processed by Stripe", "Price and policy shown before you confirm", "No subscription or booking fee for families"]} />;
}

export function TrialVignette() {
  return (
    <FeatureVisual
      icon={Gift}
      tone="teal"
      title="Try before you commit"
      points={["Free or low-cost trials, set by each tutor", `Cancel a trial free up to ${DEFAULT_POLICY.trialFreeCancellationHours} hours before`, "No obligation to book more lessons"]}
    />
  );
}

export function ProgressVignette() {
  return <FeatureVisual icon={LineChart} tone="violet" title="Progress you can follow" points={["Lesson notes after every session", "Homework with due dates", "Goals and topics mastered"]} />;
}

export function FamilyVignette() {
  return <FeatureVisual icon={Users} title="One account for the family" points={["A profile for each child", "Book and pay for every child in one place", "Attendance, homework and progress together"]} />;
}

export function NotificationsVignette() {
  return <FeatureVisual icon={Bell} tone="sky" title="Always in the loop" points={["Booking confirmations and reminders", "New messages and homework", "Choose which updates you receive"]} />;
}

/* ─── Tutors ─────────────────────────────────────────────────────────────── */

export function ProfileBuilderVignette() {
  return <FeatureVisual icon={UserRound} title="A profile that works for you" points={["Subjects, levels and the rate you set", "Availability and service area", "Verification badges once checks are complete"]} />;
}

export function CalendarVignette() {
  return <FeatureVisual icon={CalendarDays} tone="teal" title="Your calendar, your rules" points={["Weekly hours and buffers between lessons", "Minimum notice and booking limits", "Manual approval or instant booking"]} />;
}

export function JobVignette() {
  return <FeatureVisual icon={Briefcase} tone="sky" title="Student jobs" points={["Requirements posted by families", "Apply with a short personal note", `Each application uses ${CREDITS_PER_APPLICATION} lead credit`]} />;
}

export function GetPaidVignette() {
  return <FeatureVisual icon={Wallet} tone="teal" title="Get paid securely" points={["Payouts to your bank through Stripe Connect", "Commission shown before you pick a plan", `Earnings released after the ${DEFAULT_POLICY.disputeWindowDays}-day dispute window`]} />;
}

/* ─── Trust & safety ─────────────────────────────────────────────────────── */

export function VerificationVignette() {
  return <FeatureVisual icon={ShieldCheck} title="Verified, step by step" points={["Identity check", "Education and teaching certificates", "Background screening where applicable"]} />;
}

export function ReviewVignette() {
  return <FeatureVisual icon={Star} tone="violet" title="Reviews you can trust" points={["Only from completed lessons", "Tutors can reply publicly", "Moderated for safety and accuracy"]} />;
}
