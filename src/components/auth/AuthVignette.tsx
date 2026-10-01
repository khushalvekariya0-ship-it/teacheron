"use client";

import * as React from "react";
import { BadgeCheck, CalendarCheck2, Check, CircleDot, Circle, CreditCard, Lock, Monitor, Star } from "lucide-react";
import { motion } from "@/components/motion";
import { Avatar } from "@/components/ui/Avatar";
import { TUTOR_BY_ID } from "@/lib/data/tutors";
import { subjectName } from "@/lib/data/catalog";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

/* Illustrative product vignette built from the sample catalog — decorative, hidden from assistive tech. */
const TUTOR = TUTOR_BY_ID["tut_priya_raman"];
const TOPICS: { name: string; status: "completed" | "in_progress" | "not_started" }[] = [
  { name: "Equilibrium constant (K)", status: "completed" },
  { name: "ICE tables", status: "in_progress" },
  { name: "Le Chatelier's principle", status: "in_progress" },
  { name: "Acids & bases, pH", status: "not_started" },
];

function TopicIcon({ status }: { status: (typeof TOPICS)[number]["status"] }) {
  if (status === "completed")
    return (
      <span className="grid size-4 place-items-center rounded-full bg-ink text-on-ink">
        <Check className="size-2.5" strokeWidth={3} />
      </span>
    );
  if (status === "in_progress") return <CircleDot className="size-4 text-ink" />;
  return <Circle className="size-4 text-line-strong" />;
}

export function AuthVignette() {
  const name = TUTOR ? `${TUTOR.firstName} ${TUTOR.lastName}` : "Your tutor";
  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden px-10 py-12 text-ink xl:px-16">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }} className="relative max-w-md">
        <p className="text-[13px] font-semibold text-ink">For students, parents and tutors</p>
        <h2 className="mt-3 font-heading text-[2.5rem] font-bold leading-[1.02] tracking-[-0.025em] text-ink xl:text-[2.85rem]">
          Every lesson, message and milestone in one calm place.
        </h2>
        <p className="mt-4 text-[16px] leading-relaxed text-ink/80">Book lessons, keep in touch with your tutor and see progress after every session.</p>
      </motion.div>

      <div className="relative mx-auto my-10 w-full max-w-[440px]" aria-hidden>
        {/* Next lesson */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          className="relative z-10 rounded-2xl bg-surface p-5 shadow-[0_2px_0_rgb(18_17_23/0.08)]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Next lesson</span>
            <span className="inline-flex items-center gap-1 rounded-md bg-teal-soft px-2 py-0.5 text-[11px] font-semibold text-ink">
              <span className="size-1.5 rounded-full bg-current" /> Confirmed
            </span>
          </div>
          <div className="mt-3.5 flex items-center gap-3">
            <Avatar name={name} tone={TUTOR?.tone} size="md" verified={TUTOR?.verification.identity === "verified"} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold tracking-tight text-ink">{subjectName("chemistry")}</p>
              <p className="truncate text-[12.5px] text-muted">with {name}</p>
            </div>
            <div className="text-right">
              <p className="text-[13px] font-semibold tabular-nums text-ink">Thu · 7:00 PM</p>
              <p className="inline-flex items-center gap-1 text-[11.5px] text-muted">
                <Monitor className="size-3" /> Online · 60 min
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-dashed border-line-strong bg-canvas px-3 py-2">
            <span className="text-[12px] text-muted">Join link appears 15 minutes before</span>
            <span className="rounded-md bg-sunken px-2.5 py-1 text-[11.5px] font-semibold text-muted">Join</span>
          </div>
        </motion.div>

        {/* Learning goal */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.38 }}
          className="relative -mt-3 ml-8 mr-[-8px] rounded-2xl bg-surface p-5 pt-7 shadow-[0_2px_0_rgb(18_17_23/0.08)]"
        >
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold text-ink">AP Chemistry — Units 7 &amp; 8</p>
            <span className="text-[12px] font-medium tabular-nums text-muted">1 of 4 topics</span>
          </div>
          <div className="mt-2.5 h-2 overflow-hidden rounded-sm bg-canvas">
            <motion.div className="h-full rounded-sm bg-brand" initial={{ width: 0 }} animate={{ width: "38%" }} transition={{ duration: 1.1, ease: EASE, delay: 0.9 }} />
          </div>
          <ul className="mt-3.5 space-y-2">
            {TOPICS.map((t, i) => (
              <motion.li
                key={t.name}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, ease: EASE, delay: 0.8 + i * 0.07 }}
                className={cn("flex items-center gap-2.5 text-[12.5px]", t.status === "not_started" ? "text-muted" : "text-ink-2")}
              >
                <TopicIcon status={t.status} />
                {t.name}
              </motion.li>
            ))}
          </ul>
        </motion.div>

        {/* Floating confirmation */}
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 1.2 }}
          className="absolute -bottom-7 -right-4 z-20 flex items-center gap-2.5 rounded-xl bg-ink px-3.5 py-2.5 xl:-right-10"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-brand text-white">
            <CalendarCheck2 className="size-4" />
          </span>
          <span>
            <span className="block text-[12.5px] font-semibold text-on-ink">Homework reviewed</span>
            <span className="block text-[11.5px] text-on-ink/70">ICE table problem set</span>
          </span>
        </motion.div>
      </div>

      <motion.ul
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.6 } } }}
        className="relative grid gap-3 text-[13.5px] font-medium text-ink xl:grid-cols-2"
      >
        {[
          { icon: BadgeCheck, text: "Badges only after verification" },
          { icon: Star, text: "Reviews only from completed lessons" },
          { icon: CreditCard, text: "Payments processed by Stripe" },
          { icon: Lock, text: "Contact details stay private" },
        ].map((t) => (
          <motion.li key={t.text} variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }} className="flex items-center gap-2">
            <t.icon className="size-4 shrink-0 text-ink" strokeWidth={2.25} aria-hidden /> {t.text}
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}
