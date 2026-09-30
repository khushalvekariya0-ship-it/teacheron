"use client";

import * as React from "react";
import { Info, Scale } from "lucide-react";
import { DEFAULT_WEIGHTS, type FactorKey } from "@/lib/matching";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogClose, DialogTrigger } from "@/components/ui/Overlay";
import { InlineAlert } from "@/components/ui/States";
import { motion, EASE } from "@/components/motion";
import { FACTOR_ORDER } from "./MatchVisuals";

/** How each factor earns points — mirrors the rules in lib/matching.ts exactly. */
const FACTOR_COPY: Record<FactorKey, { label: string; rule: string }> = {
  subject: { label: "Subject", rule: "Full points if they teach it; 35% for a related subject in the same area. Tutors outside the subject area are excluded." },
  grade: { label: "Grade level", rule: "Full points if they work with that level of student." },
  schedule: { label: "Schedule", rule: "The share of your preferred days on which they're regularly available at your preferred times." },
  budget: { label: "Budget", rule: "Full points at or under your maximum; half points up to 15% over it." },
  location: { label: "Location & mode", rule: "Whether they teach in your format and, for in-person lessons, whether you're inside their service area. Tutors who can't teach in the format you need are excluded." },
  experience: { label: "Experience", rule: "Full points at or above your minimum; scaled down below it." },
  language: { label: "Language", rule: "Full points if they list the language you asked for." },
  support: { label: "Learning support", rule: "The share of your listed needs they have experience with." },
};

export function ScoringDialog({ trigger }: { trigger?: React.ReactNode }) {
  const max = Math.max(...Object.values(DEFAULT_WEIGHTS));
  const total = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm">
            <Info /> How scoring works
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title="How scoring works" description="Every match is rules-based and fully explained — nothing is hidden." size="lg">
        <DialogBody className="space-y-6">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-ink">
              <Scale className="size-4 text-ink" aria-hidden /> Factor weights <span className="font-normal text-muted">({total} points in total)</span>
            </p>
            <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
              {FACTOR_ORDER.map((k, i) => (
                <li key={k} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-semibold text-ink">{FACTOR_COPY[k].label}</span>
                    <span className="text-sm tabular-nums text-ink-2">{DEFAULT_WEIGHTS[k]} pts</span>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-sunken" aria-hidden>
                    <motion.div
                      className="h-full rounded-full bg-brand"
                      initial={{ width: 0 }}
                      animate={{ width: `${(DEFAULT_WEIGHTS[k] / max) * 100}%` }}
                      transition={{ duration: 0.7, ease: EASE, delay: 0.1 + i * 0.04 }}
                    />
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">{FACTOR_COPY[k].rule}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2 text-sm leading-relaxed text-ink-2">
            <p>
              <span className="font-semibold text-ink">Your match %</span> is the points a tutor earns divided by the points available for the factors you actually set. Anything you leave blank isn&apos;t scored and never counts against anyone.
            </p>
            <p>Ties are broken by lessons completed on TutorLink, then alphabetically by last name.</p>
          </div>
          <InlineAlert tone="info" title="Placement can't be bought">
            Featured placement and subscription plans never affect match scores or ranking.
          </InlineAlert>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
