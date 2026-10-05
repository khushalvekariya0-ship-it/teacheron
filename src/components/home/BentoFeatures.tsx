"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { ArrowRight, CalendarDays, Eraser, Highlighter, Mic, Moon, Pause, Pencil, PhoneOff, Play, Sparkles, Square, Sun, Video, Wallet, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_WEIGHTS } from "@/lib/matching";
import { setTheme, useTheme } from "@/lib/theme";
import { EASE, Stagger, StaggerItem } from "@/components/motion";
import { Section, SectionHeading } from "@/components/marketing/Section";
import { Button } from "@/components/ui/Button";
import { useMediaQuery } from "@/components/booking/useMediaQuery";
import { OnlineNow } from "@/components/domain/TutorIntro";
import { WalletDrawer } from "@/components/wallet/WalletDrawer";
import { SmartMatchQuiz } from "./SmartMatchQuiz";

/* ═══ 2 · Everything in one place — a bento of what happens between search and lesson ═══
   Every tile's picture plays by itself once it scrolls into view, and rests when it leaves. */

/**
 * True while the element is on screen and the visitor hasn't asked for reduced motion.
 * The preference is read through `useMediaQuery`, which reports "no" while the page hydrates, so the
 * first client render always matches the server's HTML.
 */
function usePlaying(amount = 0.45) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount });
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  return { ref, playing: inView && !reduced, reduced };
}

/**
 * A step counter that ticks only while its element is on screen.
 * With reduced motion it rests on the last step, so the picture shows its finished state.
 */
function useLoop(steps: number, ms: number) {
  const { ref, playing, reduced } = usePlaying();
  const [step, setStep] = React.useState(0);
  React.useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setStep((s) => (s + 1) % steps), ms);
    return () => clearInterval(id);
  }, [playing, steps, ms]);
  return { ref, playing, step: reduced ? steps - 1 : step };
}

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

/** Three chips that light up one after another: done, current, still to come. Ends on the last one, then starts over. */
function StepFlow({ labels }: { labels: [string, string, string] }) {
  // Four ticks for three chips: the last chip holds for an extra beat before the loop restarts.
  const { ref, step } = useLoop(4, 1150);
  const current = Math.min(step, 2);
  return (
    <div ref={ref} className="flex flex-wrap items-center gap-2 text-[13px] font-semibold">
      {labels.map((label, i) => (
        <React.Fragment key={label}>
          {i > 0 && <ArrowRight className={cn("size-3.5 transition-colors duration-300", i <= current ? "text-brand" : "text-subtle")} />}
          {/* Only colours change, so the row never shifts or wraps while it plays. */}
          <span
            className={cn(
              "rounded-full border px-3 py-1.5 transition-[background-color,border-color,color,box-shadow] duration-300",
              i === current
                ? "border-brand bg-brand text-white shadow-[0_6px_16px_-8px_var(--color-brand-glow)]"
                : i < current
                  ? "border-transparent bg-brand-soft text-brand"
                  : "border-line bg-canvas text-ink-2",
            )}
          >
            {label}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

const INTRO_SLIDES = [
  { label: "Meet your tutor", text: "A short hello before you send a message" },
  { label: "Experience", text: "Years of teaching and lessons completed" },
  { label: "Teaches", text: "The subjects and levels they cover" },
  { label: "How I teach", text: "Their approach, in their own words" },
];
const INTRO_SLIDE_MS = 2600;

/** A tutor intro, playing: story bars fill one by one and the slides change with them. */
function IntroPreview() {
  const { ref, step, playing } = useLoop(INTRO_SLIDES.length, INTRO_SLIDE_MS);
  const slide = INTRO_SLIDES[step];
  return (
    <div ref={ref} className="relative flex h-44 flex-col overflow-hidden rounded-2xl bg-brand-deep p-3.5 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_100%_0%,rgb(99_102_241/0.6),transparent_70%),radial-gradient(ellipse_70%_70%_at_0%_100%,rgb(255_77_94/0.3),transparent_70%)]" />
      <div className="relative flex gap-1">
        {INTRO_SLIDES.map((s, i) => (
          <span key={s.label} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
            <span
              // A new key restarts the fill each time this bar becomes the current one.
              key={i === step && playing ? `fill-${step}` : "rest"}
              className="block h-full origin-left rounded-full bg-white"
              style={i < step || (i === step && !playing) ? undefined : i === step ? { animation: `reel-fill ${INTRO_SLIDE_MS}ms linear forwards` } : { transform: "scaleX(0)" }}
            />
          </span>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.28, ease: EASE }} className="relative mt-auto">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-white/65">{slide.label}</p>
          <p className="mt-0.5 font-heading text-[15px] font-semibold leading-snug tracking-[-0.01em]">{slide.text}</p>
        </motion.div>
      </AnimatePresence>
      <div className="relative mt-3 flex items-center justify-between">
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white/15 pl-2 pr-2.5 text-[12px] font-semibold backdrop-blur">
          {playing ? <Pause className="size-3 fill-current" /> : <Play className="size-3 fill-current" />} Intro · 15s
        </span>
        <OnlineNow className="bg-white text-[#15803d]" />
      </div>
    </div>
  );
}

const OPEN_DAYS = new Set([1, 2, 3, 5, 8, 9, 10, 11, 12, 15, 16, 17, 19]);
/** The days the picture "taps", in order. */
const PICKED_DAYS = [10, 16, 3, 12, 19];

/** Open days as dots: a day gets picked, then the lesson length, over and over. */
function CalendarPreview() {
  const { ref, step } = useLoop(PICKED_DAYS.length * 2, 1100);
  const picked = PICKED_DAYS[Math.floor(step / 2)];
  const long = step % 2 === 1;
  return (
    <div ref={ref} className="flex items-center gap-4">
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 21 }, (_, i) => (
          <span
            key={i}
            className={cn(
              "size-[18px] rounded-full transition-[background-color,transform,box-shadow] duration-300",
              i === picked ? "scale-110 bg-brand shadow-[0_4px_10px_-4px_var(--color-brand-glow)]" : OPEN_DAYS.has(i) ? "bg-brand-soft" : "bg-sunken",
            )}
          />
        ))}
      </div>
      <div className="flex flex-col gap-1.5 text-[12.5px] font-semibold">
        {[false, true].map((isLong) => (
          <span
            key={String(isLong)}
            className={cn("rounded-full border px-2.5 py-1 text-center transition-[background-color,border-color,color] duration-300", isLong === long ? "border-brand bg-brand text-white" : "border-line text-ink-2")}
          >
            {isLong ? "60 min" : "30 min"}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Seconds for one run of the classroom picture: the graph is worked out, two messages arrive, it clears. */
const ROOM_CYCLE = 11;
/** Fixed colours: the board in this picture is always a white board, in both themes. */
const BOARD = { ink: "#0b1033", grey: "#666c8c", coral: "#ff4d5e", indigo: "#4338ca" };
const MATH_FONT = { fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic" as const };

/**
 * The classroom as it looks in a lesson, playing: the tutor on video with your own picture in the
 * corner, a quadratic being worked out on the whiteboard, and the chat underneath.
 * Photos are general imagery; the maths is real (y = x² − 4x + 3 does cross at 1 and 3).
 */
function ClassroomPreview() {
  const { ref, playing } = usePlaying(0.3);
  const [seconds, setSeconds] = React.useState(0);
  React.useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setSeconds((s) => (s + 1) % 3600), 1000);
    return () => clearInterval(id);
  }, [playing]);
  const clock = `${String(12 + Math.floor((4 + seconds) / 60)).padStart(2, "0")}:${String((4 + seconds) % 60).padStart(2, "0")}`;

  // A stroke is drawn between `from` and `to` (fractions of the cycle), stays, then fades for the next run.
  const draw = (from: number, to: number) =>
    playing
      ? {
          pathLength: [0, 0, 1, 1],
          // Hidden until its turn, so an undrawn stroke doesn't show as a dot.
          opacity: [0, 0, 1, 1, 0],
          transition: {
            pathLength: { duration: ROOM_CYCLE, times: [0, from, to, 1], repeat: Infinity, ease: "easeInOut" as const },
            opacity: { duration: ROOM_CYCLE, times: [0, from, from + 0.01, 0.93, 1], repeat: Infinity, ease: "linear" as const },
          },
        }
      : { pathLength: 1, opacity: 1 };
  // Labels, points and messages simply appear at their moment.
  const appear = (at: number) =>
    playing ? { opacity: [0, 0, 1, 1, 0], transition: { duration: ROOM_CYCLE, times: [0, at, at + 0.03, 0.93, 1], repeat: Infinity, ease: "easeOut" as const } } : { opacity: 1 };

  return (
    <div ref={ref} className="grid min-h-72 flex-1 grid-cols-1 gap-2.5 rounded-2xl bg-white/[0.06] p-2.5 ring-1 ring-white/10 sm:grid-cols-[5fr_7fr]" aria-hidden>
      {/* The call: the tutor's video, your own picture, and the call controls */}
      <div className="relative min-h-48 overflow-hidden rounded-xl bg-[#1c2038]">
        {/* Loaded with the page (it sits just below the hero), so the video tile is never an empty box. */}
        <Image src="/images/tutor-at-laptop.jpg" alt="" fill loading="eager" sizes="(min-width: 1024px) 320px, (min-width: 640px) 40vw, 90vw" className="object-cover object-[42%_26%]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/30" />
        <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-1 text-[11px] font-semibold tabular-nums text-white backdrop-blur">
          <span className={cn("size-1.5 rounded-full bg-[#ff5c6c]", playing && "animate-pulse")} /> Live · {clock}
        </span>
        <span className="absolute right-2 top-2 block h-14 w-[4.75rem] overflow-hidden rounded-lg bg-[#2a2f4a] shadow-lg ring-2 ring-white/80">
          <Image src="/images/lesson-online.jpg" alt="" fill loading="eager" sizes="80px" className="object-cover object-[28%_32%]" />
          <span className="absolute bottom-0.5 left-1 text-[9.5px] font-semibold text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.8)]">You</span>
        </span>
        <span className="absolute bottom-12 left-2 inline-flex items-center gap-2 rounded-full bg-black/55 px-2.5 py-1 text-[11.5px] font-semibold text-white backdrop-blur">
          Your tutor
          {/* Voice level: bars that move while the tutor talks */}
          <span className="flex h-3 items-center gap-[2px]">
            {[0.5, 1, 0.7, 0.9].map((peak, i) => (
              <motion.span
                key={i}
                className="w-[2.5px] origin-center rounded-full bg-[#4ade80]"
                style={{ height: 12 }}
                animate={playing ? { scaleY: [0.25, peak, 0.4, peak * 0.7, 0.25] } : { scaleY: 0.35 }}
                transition={playing ? { duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: i * 0.13 } : { duration: 0.2 }}
              />
            ))}
          </span>
        </span>
        <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
          <span className="grid size-8 place-items-center rounded-full bg-white text-[#0b1033]">
            <Mic className="size-4" />
          </span>
          <span className="grid size-8 place-items-center rounded-full bg-white text-[#0b1033]">
            <Video className="size-4" />
          </span>
          <span className="grid h-8 w-11 place-items-center rounded-full bg-[#f0525f] text-white">
            <PhoneOff className="size-4" />
          </span>
        </div>
      </div>

      <div className="grid grid-rows-[minmax(0,1fr)_auto] gap-2.5">
        {/* The whiteboard: its toolbar, and a quadratic worked out step by step */}
        <div className="flex min-h-44 flex-col overflow-hidden rounded-xl bg-white">
          <div className="flex shrink-0 items-center gap-1 border-b border-[#e2e5ef] px-2 py-1.5 text-[#343a5e]">
            <span className="grid size-6 place-items-center rounded-md bg-[#4338ca] text-white">
              <Pencil className="size-3.5" />
            </span>
            {[Highlighter, Eraser, Square].map((Icon, i) => (
              <span key={i} className="grid size-6 place-items-center rounded-md">
                <Icon className="size-3.5" />
              </span>
            ))}
            <span className="mx-1 h-4 w-px bg-[#e2e5ef]" />
            {[BOARD.ink, BOARD.coral, BOARD.indigo, "#0d9488"].map((c) => (
              <span key={c} className={cn("size-3.5 rounded-full", c === BOARD.coral && "ring-2 ring-[#0b1033] ring-offset-1 ring-offset-white")} style={{ backgroundColor: c }} />
            ))}
          </div>
          <div className="relative min-h-0 flex-1 [background-image:radial-gradient(circle_at_1px_1px,rgb(11_16_51/0.13)_1px,transparent_0)] [background-size:14px_14px]">
            <svg viewBox="22 4 288 164" className="absolute inset-0 size-full" preserveAspectRatio="xMidYMid meet" fill="none" strokeLinecap="round" strokeLinejoin="round">
              {/* Axes: each line is drawn, then its arrowhead appears at the tip */}
              <motion.path d="M28 110H252" stroke={BOARD.ink} strokeWidth="1.8" initial={false} animate={draw(0.02, 0.1)} />
              <motion.path d="M246 106.5l6 3.5-6 3.5" stroke={BOARD.ink} strokeWidth="1.8" initial={false} animate={appear(0.1)} />
              <motion.path d="M70 160V12" stroke={BOARD.ink} strokeWidth="1.8" initial={false} animate={draw(0.08, 0.16)} />
              <motion.path d="M66.5 18l3.5-6 3.5 6" stroke={BOARD.ink} strokeWidth="1.8" initial={false} animate={appear(0.16)} />
              {/* Unit marks and numbers */}
              <motion.g initial={false} animate={appear(0.16)}>
                <path d="M100 107v6M130 107v6M160 107v6M190 107v6M220 107v6M67 80h6M67 50h6M67 20h6M67 140h6" stroke={BOARD.ink} strokeWidth="1.2" />
                <g fill={BOARD.grey} fontSize="8" fontFamily="ui-sans-serif, system-ui, sans-serif" textAnchor="middle">
                  <text x="100" y="124">1</text>
                  <text x="130" y="103">2</text>
                  <text x="160" y="124">3</text>
                  <text x="190" y="124">4</text>
                  <text x="220" y="124">5</text>
                  <text x="60" y="83">1</text>
                  <text x="60" y="53">2</text>
                  <text x="60" y="23">3</text>
                </g>
              </motion.g>
              {/* y = x² − 4x + 3, drawn exactly */}
              <motion.path d="M70 20Q130 260 190 20" stroke={BOARD.coral} strokeWidth="3" initial={false} animate={draw(0.19, 0.4)} />
              <motion.text x="204" y="38" fill={BOARD.coral} fontSize="12.5" {...MATH_FONT} initial={false} animate={appear(0.4)}>
                y = x² − 4x + 3
              </motion.text>
              {/* Where it crosses the x-axis, and its lowest point */}
              <motion.g initial={false} animate={appear(0.5)}>
                <circle cx="100" cy="110" r="4" fill={BOARD.indigo} stroke="#fff" strokeWidth="1.5" />
                <circle cx="160" cy="110" r="4" fill={BOARD.indigo} stroke="#fff" strokeWidth="1.5" />
              </motion.g>
              <motion.text x="204" y="62" fill={BOARD.indigo} fontSize="12.5" {...MATH_FONT} initial={false} animate={appear(0.52)}>
                = (x − 1)(x − 3)
              </motion.text>
              <motion.g initial={false} animate={appear(0.6)}>
                <text x="204" y="88" fill={BOARD.ink} fontSize="12.5" {...MATH_FONT}>
                  x = 1,  x = 3
                </text>
                <path d="M203 94q34 5 70 0" stroke={BOARD.ink} strokeWidth="1.5" />
              </motion.g>
              <motion.g initial={false} animate={appear(0.66)}>
                <circle cx="130" cy="140" r="4" fill={BOARD.coral} stroke="#fff" strokeWidth="1.5" />
                <text x="138" y="153" fill={BOARD.ink} fontSize="9.5" {...MATH_FONT}>
                  (2, −1)
                </text>
              </motion.g>
            </svg>
          </div>
        </div>

        {/* The chat: a question from the tutor, and the answer */}
        <div className="space-y-1.5 rounded-xl bg-white/10 p-2.5 text-[11.5px] leading-snug">
          <motion.p className="w-fit max-w-[88%] rounded-2xl rounded-bl-md bg-white/15 px-2.5 py-1.5 text-white" initial={false} animate={appear(0.72)}>
            Where does the curve cross the x-axis?
          </motion.p>
          <motion.p className="ml-auto w-fit max-w-[88%] rounded-2xl rounded-br-md bg-cta px-2.5 py-1.5 font-semibold text-on-cta" initial={false} animate={appear(0.82)}>
            At x = 1 and x = 3
          </motion.p>
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
          visual={<StepFlow labels={["Subject", "Level", "3 best matches"]} />}
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
          visual={<StepFlow labels={["Add credits", "One tap", "Booked"]} />}
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
