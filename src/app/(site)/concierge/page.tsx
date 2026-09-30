import type { Metadata } from "next";
import { Suspense } from "react";
import { EyeOff, ListChecks, Scale } from "lucide-react";
import { Reveal } from "@/components/motion";
import { ConciergeFlow } from "@/components/concierge/ConciergeFlow";
import { PageHero, Panel } from "@/components/marketing/Section";

export const metadata: Metadata = {
  title: "Help Me Find a Tutor",
  description: "Describe what you need in your own words or answer a few questions. See a transparent, factor-by-factor shortlist of tutors — no account required.",
  alternates: { canonical: "/concierge" },
};

function FlowFallback() {
  return (
    <div className="mx-auto max-w-3xl space-y-4" role="status" aria-label="Loading">
      <div className="skeleton mx-auto h-8 w-64 rounded-lg" />
      <div className="skeleton h-56 rounded-2xl" />
    </div>
  );
}

export default function ConciergePage() {
  return (
    <>
      <PageHero
        align="center"
        size="compact"
        eyebrow="Concierge matching"
        title="Help me find a tutor"
        description={<>Tell us what you need and we&apos;ll rank tutors on eight transparent factors — with every score explained.</>}
      >
        <Reveal delay={0.3}>
          <ul className="mt-7 flex flex-wrap justify-center gap-x-7 gap-y-2.5 text-[14px] font-medium text-ink/80">
            <li className="flex items-center gap-2"><ListChecks className="size-4 text-ink" aria-hidden /> Every factor shown</li>
            <li className="flex items-center gap-2"><Scale className="size-4 text-ink" aria-hidden /> Paid placement never affects scores</li>
            <li className="flex items-center gap-2"><EyeOff className="size-4 text-ink" aria-hidden /> No account needed</li>
          </ul>
        </Reveal>
      </PageHero>
      <Panel aria-label="Find a tutor">
        <div className="container-page pb-20 pt-10 sm:pt-12">
          <Suspense fallback={<FlowFallback />}>
            <ConciergeFlow />
          </Suspense>
        </div>
      </Panel>
    </>
  );
}
