"use client";

import * as React from "react";
import Image from "next/image";
import { BadgeCheck, CreditCard, Lock, Star } from "lucide-react";
import { motion } from "@/components/motion";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Right-hand panel on the sign-in / sign-up screens: a photo and the promises that are true of the product. */
export function AuthVignette() {
  return (
    <div className="relative flex h-full flex-col justify-between gap-10 overflow-hidden px-10 py-12 text-ink xl:px-16">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }} className="relative max-w-md">
        <p className="text-[13px] font-semibold text-ink">For students, parents and tutors</p>
        <h2 className="mt-3 font-heading text-[2.5rem] font-bold leading-[1.04] tracking-[-0.025em] text-ink xl:text-[2.85rem]">
          Every lesson, message and milestone in one calm place.
        </h2>
        <p className="mt-4 text-[16px] leading-relaxed text-ink-2">Book lessons, keep in touch with your tutor and see progress after every session.</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        className="relative mx-auto aspect-[4/3] w-full max-w-[520px] overflow-hidden rounded-2xl shadow-xl"
      >
        <Image src="/images/hero-tutoring-close.jpg" alt="" fill sizes="520px" className="object-cover" />
      </motion.div>

      <motion.ul
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.5 } } }}
        className="relative grid gap-3 text-[14px] font-medium text-ink xl:grid-cols-2"
      >
        {[
          { icon: BadgeCheck, text: "Badges only after verification" },
          { icon: Star, text: "Reviews only from completed lessons" },
          { icon: CreditCard, text: "Payments processed by Stripe" },
          { icon: Lock, text: "Contact details stay private" },
        ].map((t) => (
          <motion.li key={t.text} variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }} className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-brand shadow-sm">
              <t.icon className="size-4" strokeWidth={2.25} aria-hidden />
            </span>
            {t.text}
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}
