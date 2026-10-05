"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Moon, Play, Sparkles, Sun, Video, Wallet, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_WEIGHTS } from "@/lib/matching";
import { setTheme, useTheme } from "@/lib/theme";
import { Stagger, StaggerItem } from "@/components/motion";
import { Section, SectionHeading } from "@/components/marketing/Section";
import { Button } from "@/components/ui/Button";
import { OnlineNow } from "@/components/domain/TutorIntro";
import { WalletDrawer } from "@/components/wallet/WalletDrawer";
import { SmartMatchQuiz } from "./SmartMatchQuiz";

/* ═══ 2 · Everything in one place — a bento of what happens between search and lesson ═══ */

function Tile({ icon: Icon, title, children, action, visual, className }: { icon: LucideIcon; title: string; children: React.ReactNode; action?: React.ReactNode; visual?: React.ReactNode; className?: string }) {
  return (
    <StaggerItem className={cn("h-full", className)}>
      <div data-spotlight className="flex h-full flex-col rounded-3xl border border-line bg-surface p-6 sm:p-7">
        <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
          <Icon className="size-5" aria-hidden />
        </span>
        <h3 className="mt-5 font-heading text-[1.3rem] font-bold leading-tight tracking-[-0.03em] text-ink">{title}</h3>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{children}</p>
        {visual && (
          <div className="mt-5" aria-hidden>
            {visual}
          </div>
        )}
        {action && <div className="mt-auto pt-5">{action}</div>}
      </div>
    </StaggerItem>
  );
}

/** Subject → level → three matches: the whole quiz as three chips. */
function MatchFlow() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold">
      <span className="rounded-full border border-line bg-canvas px-3 py-1.5 text-ink-2">Subject</span>
      <ArrowRight className="size-3.5 text-subtle" />
      <span className="rounded-full border border-line bg-canvas px-3 py-1.5 text-ink-2">Level</span>
      <ArrowRight className="size-3.5 text-subtle" />
      <span className="rounded-full bg-brand px-3 py-1.5 text-white">3 best matches</span>
    </div>
  );
}

/** A tutor photo turning into an intro: story bars, a play pill and the online dot. */
function IntroPreview() {
  return (
    <div className="relative flex h-28 flex-col overflow-hidden rounded-2xl bg-brand-deep p-3 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_100%_0%,rgb(99_102_241/0.6),transparent_70%),radial-gradient(ellipse_70%_70%_at_0%_100%,rgb(255_77_94/0.3),transparent_70%)]" />
      <div className="relative flex gap-1">
        <span className="h-[3px] flex-1 rounded-full bg-white" />
        <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
          <span className="block h-full w-1/2 rounded-full bg-white" />
        </span>
        <span className="h-[3px] flex-1 rounded-full bg-white/25" />
        <span className="h-[3px] flex-1 rounded-full bg-white/25" />
      </div>
      <div className="relative mt-auto flex items-end justify-between">
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white/15 pl-2 pr-2.5 text-[12px] font-semibold backdrop-blur">
          <Play className="size-3 fill-current" /> Intro · 15s
        </span>
        <OnlineNow className="bg-white text-[#15803d]" />
      </div>
    </div>
  );
}

const MONTH_DOTS = [0, 1, 1, 1, 0, 1, 0, 0, 1, 1, 2, 1, 1, 0, 0, 1, 1, 1, 0, 1, 0];

/** Open days as dots, one picked, and the lengths you can choose. */
function CalendarPreview() {
  return (
    <div className="flex items-center gap-4">
      <div className="grid grid-cols-7 gap-1.5">
        {MONTH_DOTS.map((d, i) => (
          <span key={i} className={cn("size-[18px] rounded-full", d === 2 ? "bg-brand shadow-[0_4px_10px_-4px_var(--color-brand-glow)]" : d === 1 ? "bg-brand-soft" : "bg-sunken")} />
        ))}
      </div>
      <div className="flex flex-col gap-1.5 text-[12.5px] font-semibold">
        <span className="rounded-full border border-line px-2.5 py-1 text-center text-ink-2">30 min</span>
        <span className="rounded-full bg-brand px-2.5 py-1 text-center text-white">60 min</span>
      </div>
    </div>
  );
}

/** The classroom in miniature: the call on the left, the board and chat on the right. */
function ClassroomPreview() {
  return (
    <div className="grid min-h-56 flex-1 grid-cols-[5fr_7fr] gap-2.5 rounded-2xl bg-white/[0.06] p-2.5 ring-1 ring-white/10" aria-hidden>
      <div className="relative flex flex-col items-center justify-center rounded-xl bg-black/45">
        <span className="size-14 rounded-full bg-white/15 ring-1 ring-white/25" />
        <span className="mt-2.5 h-1.5 w-16 rounded-full bg-white/30" />
        <span className="absolute right-2 top-2 h-9 w-14 rounded-md bg-white/15 ring-1 ring-white/20" />
        <div className="absolute bottom-2.5 flex gap-1.5">
          <span className="size-6 rounded-full bg-white/20" />
          <span className="size-6 rounded-full bg-white/20" />
          <span className="h-6 w-8 rounded-full bg-cta" />
        </div>
      </div>
      <div className="grid grid-rows-[minmax(0,1fr)_auto] gap-2.5">
        <div className="relative overflow-hidden rounded-xl bg-white">
          <svg viewBox="0 0 240 130" className="absolute inset-0 size-full" preserveAspectRatio="xMidYMid meet">
            <path d="M24 104h192M120 14v104" stroke="#0b1033" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M58 22 Q120 186 182 22" stroke="#ff4d5e" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            <path d="M150 62l28-10" stroke="#4338ca" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <rect x="182" y="40" width="34" height="18" rx="4" stroke="#4338ca" strokeWidth="2.5" fill="none" />
          </svg>
        </div>
        <div className="space-y-1.5 rounded-xl bg-white/10 p-2.5">
          <span className="block h-2.5 w-3/5 rounded-full bg-white/30" />
          <span className="ml-auto block h-2.5 w-2/5 rounded-full bg-cta/90" />
        </div>
      </div>
    </div>
  );
}

export function BentoFeatures() {
  const theme = useTheme();
  const [quizOpen, setQuizOpen] = React.useState(false);
  const [walletOpen, setWalletOpen] = React.useState(false);
  const factors = Object.keys(DEFAULT_WEIGHTS).length;

  return (
    <Section>
      <SectionHeading
        eyebrow="Everything in one place"
        title="From first search to live lesson"
        accent={2}
        description="No extra apps and no back-and-forth. Find a tutor, book a time, pay and learn — all on one platform."
      />

      <Stagger className="bento" stagger={0.06}>
        {/* The classroom: the one large, dark tile */}
        <StaggerItem className="h-full sm:col-span-2 lg:col-span-4 lg:row-span-2">
          <div className="relative isolate flex h-full flex-col overflow-hidden rounded-3xl bg-brand-deep p-6 text-white sm:p-8">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_55%_70%_at_90%_0%,rgb(99_102_241/0.5),transparent_70%),radial-gradient(ellipse_45%_60%_at_0%_100%,rgb(255_77_94/0.2),transparent_70%)]" aria-hidden />
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-md">
                <span className="grid size-11 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Video className="size-5" aria-hidden />
                </span>
                <h3 className="mt-5 font-heading text-[1.7rem] font-bold leading-[1.08] tracking-[-0.035em] text-white sm:text-[2rem]">A classroom built in. No meeting links.</h3>
                <p className="mt-3 text-[15.5px] leading-relaxed text-white/70">Video on one side, a whiteboard with no edges and live chat on the other. It opens in your browser — nothing to install.</p>
              </div>
              <Button asChild variant="cta" size="lg" className="group shrink-0">
                <Link href="/classroom/demo">
                  Try the demo classroom <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
            </div>
            <div className="mt-7 flex flex-1">
              <ClassroomPreview />
            </div>
          </div>
        </StaggerItem>

        <Tile
          className="lg:col-span-2"
          icon={Sparkles}
          title="Two questions, three tutors"
          visual={<MatchFlow />}
          action={
            <Button variant="secondary" onClick={() => setQuizOpen(true)}>
              Start Smart Match <ArrowRight />
            </Button>
          }
        >
          Smart Match ranks every tutor on {factors} open factors and shows your three best fits, with the reasons.
        </Tile>

        <Tile className="lg:col-span-2" icon={Play} title="Meet tutors before you message" visual={<IntroPreview />}>
          Rest on a tutor&rsquo;s photo and a 15-second intro plays. A green dot marks tutors who are online now.
        </Tile>

        <Tile className="lg:col-span-2" icon={CalendarDays} title="Book on the tutor's calendar" visual={<CalendarPreview />}>
          Pick a day, a start time and a lesson length. The total updates as you choose — no surprises at checkout.
        </Tile>

        <Tile
          className="lg:col-span-2"
          icon={Wallet}
          title="One-tap booking with Study Credits"
          action={
            <Button variant="secondary" onClick={() => setWalletOpen(true)}>
              <Zap /> Open the wallet
            </Button>
          }
        >
          Add credits once by card or UPI. After that a lesson is one tap, and refunds go straight back to your wallet.
        </Tile>

        <Tile
          className="lg:col-span-2"
          icon={theme === "dark" ? Sun : Moon}
          title="Built for your phone, day or night"
          action={
            <Button variant="secondary" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <Sun /> : <Moon />} Switch to {theme === "dark" ? "light" : "dark"}
            </Button>
          }
        >
          Every screen is designed for thumbs first, with swipe rows and bottom sheets, and a true-black dark theme.
        </Tile>
      </Stagger>

      <SmartMatchQuiz open={quizOpen} onOpenChange={setQuizOpen} />
      <WalletDrawer open={walletOpen} onOpenChange={setWalletOpen} />
    </Section>
  );
}
