"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { EASE, Reveal } from "@/components/motion";
import { Segmented } from "@/components/ui/Controls";
import { TUTOR_PLANS } from "@/lib/data/platform";
import { medianRate } from "@/components/content/insights";
import {
  CalendarVignette, CheckoutVignette, JobVignette, MessageVignette, PayoutVignette, ProfileBuilderVignette, ProgressVignette, SearchVignette,
  SlotVignette, VerificationVignette,
} from "./Vignettes";
import { ArrowLink, Eyebrow } from "./Section";

type Audience = "families" | "tutors";

interface Step {
  title: string;
  body: string;
  points: string[];
  visual: React.ReactNode;
  link?: { href: string; label: string };
}

function buildSteps(): Record<Audience, Step[]> {
  const pro = TUTOR_PLANS.find((p) => p.highlighted) ?? TUTOR_PLANS[0];
  const rate = medianRate();
  const commissions = TUTOR_PLANS.map((p) => p.commissionBps / 100);
  const maxCommission = Math.max(...commissions);
  const minCommission = Math.min(...commissions);
  return {
    families: [
      {
        title: "Tell us what you need",
        body: "Search by subject, grade, schedule, budget and ZIP code — or describe the situation in your own words and let Help Me Find a Tutor build a shortlist.",
        points: ["Filters for online or in-person lessons", "Every recommendation explains why it matches", "Prefer tutors to come to you? Post a requirement"],
        visual: <SearchVignette />,
        link: { href: "/concierge", label: "Try Help Me Find a Tutor" },
      },
      {
        title: "Compare and message",
        body: "Put up to three tutors side by side, then ask questions before you commit. Messaging is free and stays on the platform.",
        points: ["Compare rates, experience, verification and availability", "Phone numbers and emails are masked in messages", "Parents see conversations about their children"],
        visual: <MessageVignette />,
      },
      {
        title: "Pick a time that works",
        body: "Open times come straight from each tutor's calendar and are shown in your time zone. Many tutors offer a free or low-cost trial.",
        points: ["Real availability — no back-and-forth", "Trial terms shown on the profile", "Instant booking where the tutor allows it"],
        visual: <SlotVignette />,
      },
      {
        title: "Confirm and pay securely",
        body: "You see the full price and the cancellation policy before you pay. Payments are processed by Stripe; we never store full card numbers.",
        points: ["No subscription and no booking fee", "Charged when the tutor confirms your request", "Free cancellation windows shown up front"],
        visual: <CheckoutVignette />,
      },
      {
        title: "Learn and track progress",
        body: "Each lesson has its own page with notes, homework and attendance. After a completed lesson, you can leave a review.",
        points: ["Lesson notes and homework in one place", "Attendance for every booking", "Reviews only from completed lessons"],
        visual: <ProgressVignette />,
      },
    ],
    tutors: [
      {
        title: "Build your profile",
        body: "Guided onboarding walks you through subjects, experience, education, pricing and availability. Save your progress and come back whenever you like.",
        points: ["Set your own hourly rate and trial terms", "Choose online, in person, or both", "Share an approximate service area — never your address"],
        visual: <ProfileBuilderVignette />,
        link: { href: "/become-a-tutor", label: "What you'll need" },
      },
      {
        title: "Get verified",
        body: "Submit identity, education and certification documents, plus background screening where applicable. Each check shows its own status.",
        points: ["Badges appear only after a check is completed", "Each check moves from Submitted to Under review to Verified", "Checks that lapse are marked Expired and lose their badge"],
        visual: <VerificationVignette />,
        link: { href: "/trust-safety#verification", label: "How verification works" },
      },
      {
        title: "Set your schedule",
        body: "Publish weekly availability with buffers, minimum notice and lesson lengths. Accept requests manually or turn on instant booking.",
        points: ["Families only see times you're actually free", "Time zones are handled for you", "Reschedule rules protect your calendar"],
        visual: <CalendarVignette />,
      },
      {
        title: "Find students",
        body: "Families can find you in search and message you directly at no cost to you. You can also apply to requirements families post, using lead credits.",
        points: ["Being contacted directly never costs credits", "Applying to a student job uses 1 credit", "Each plan includes monthly credits"],
        visual: <JobVignette />,
        link: { href: "/tutor-jobs", label: "Browse student jobs" },
      },
      {
        title: "Teach and get paid",
        body: "Run lessons, post notes and homework, and get paid through Stripe Connect. Commission depends on your plan and is shown before you choose one.",
        points: ["Earnings available after the dispute window", `Commission from ${maxCommission}% down to ${minCommission}% by plan`, "Reviews from completed lessons build your reputation"],
        visual: <PayoutVignette rateCents={rate} commissionBps={pro.commissionBps} planName={pro.name} />,
        link: { href: "/pricing#tutors", label: "Compare plans" },
      },
    ],
  };
}

export function HowItWorksView() {
  const [audience, setAudience] = React.useState<Audience>("families");
  const steps = buildSteps()[audience];
  return (
    <div>
      <Reveal className="mb-12 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between lg:mb-16">
        <div>
          <Eyebrow className="mb-4 text-ink">Step by step</Eyebrow>
          <h2 className="font-heading text-[2.1rem] font-bold leading-[1.02] tracking-[-0.025em] text-ink sm:text-[2.75rem]">{audience === "families" ? "For families and students" : "For tutors"}</h2>
        </div>
        <Segmented
          label="Show steps for"
          value={audience}
          onChange={setAudience}
          options={[
            { value: "families", label: "Families" },
            { value: "tutors", label: "Tutors" },
          ]}
        />
      </Reveal>

      <AnimatePresence mode="wait" initial={false}>
        <motion.ol
          key={audience}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="relative space-y-16 lg:space-y-24"
        >
          {steps.map((s, i) => (
            <li key={s.title} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
              <Reveal className={i % 2 === 1 ? "lg:order-2" : undefined}>
                <span className="grid size-10 place-items-center rounded-lg bg-ink font-heading text-[15px] font-bold tabular-nums text-on-ink">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-5 font-heading text-[1.75rem] font-bold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[2.1rem]">{s.title}</h3>
                <p className="mt-3 max-w-lg text-[15.5px] leading-relaxed text-ink-2 sm:text-[17px]">{s.body}</p>
                <ul className="mt-6 space-y-2.5">
                  {s.points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-[15px] text-ink">
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand text-white">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
                {s.link && (
                  <ArrowLink href={s.link.href} className="mt-6">
                    {s.link.label}
                  </ArrowLink>
                )}
              </Reveal>
              <Reveal delay={0.1} className={i % 2 === 1 ? "lg:order-1" : undefined}>
                <div className="mx-auto max-w-md lg:max-w-none">{s.visual}</div>
              </Reveal>
            </li>
          ))}
        </motion.ol>
      </AnimatePresence>
    </div>
  );
}
