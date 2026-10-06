"use client";

import * as React from "react";
import type { Tutor } from "@/lib/types";
import { cn } from "@/lib/utils";
import { subjectName } from "@/lib/data/catalog";
import { useHydrated, useNow } from "@/lib/store/hooks";
import { zonedParts } from "@/lib/time";
import { AnimatePresence, EASE, motion } from "@/components/motion";

/** How long an intro plays on a card before it starts again. */
export const INTRO_SECONDS = 15;

const minutesOf = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
};

/**
 * "Online now": the tutor teaches online and it is inside their own teaching hours right now
 * (their weekly availability and date exceptions, in their time zone).
 * Preview build only — production reads live presence from the API instead of this hook.
 */
/** True when `now` falls inside the tutor's published teaching hours (their time zone) and they teach online. */
export function isOnlineNow(tutor: Pick<Tutor, "modes" | "availability" | "exceptions" | "timezone">, now: number): boolean {
  if (!tutor.modes.includes("online")) return false;
  const p = zonedParts(new Date(now), tutor.timezone);
  const key = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  const exception = tutor.exceptions.find((e) => e.date === key);
  if (exception?.type === "blocked") return false;
  const windows = exception?.type === "custom" ? (exception.windows ?? []) : tutor.availability.filter((w) => w.day === p.weekday);
  const minute = p.hour * 60 + p.minute;
  return windows.some((w) => minute >= minutesOf(w.start) && minute < minutesOf(w.end));
}

export function useOnlineNow(tutor: Pick<Tutor, "modes" | "availability" | "exceptions" | "timezone">): boolean {
  const hydrated = useHydrated();
  const now = useNow(60_000);
  return React.useMemo(() => hydrated && isOnlineNow(tutor, now), [hydrated, now, tutor]);
}

/** Pulsing green dot with the "Online now" label. */
export function OnlineNow({ className, short }: { className?: string; short?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 bg-live-soft px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-live-ink", className)}>
      <span className="live-dot" aria-hidden />
      {short ? "Online" : "Online now"}
    </span>
  );
}

/** First sentence of a paragraph, kept short enough for one slide. */
function firstSentence(text: string, max = 120): string {
  const s = text.split(/(?<=[.!?])\s/)[0] ?? text;
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

function introSlides(tutor: Tutor): { label: string; text: string; sub?: string }[] {
  return [
    { label: `Meet ${tutor.firstName}`, text: tutor.headline },
    {
      label: "Experience",
      text: `${tutor.experienceYears} ${tutor.experienceYears === 1 ? "year" : "years"} teaching`,
      sub: tutor.lessonsCompleted > 0 ? `${tutor.lessonsCompleted} lessons on TutorLink` : undefined,
    },
    { label: "Teaches", text: tutor.subjects.slice(0, 3).map(subjectName).join(" · ") },
    { label: "How I teach", text: firstSentence(tutor.approach || tutor.bio) },
  ];
}

/**
 * The intro that plays over a tutor's photo while the card is hovered (or its play button is tapped).
 * With an uploaded clip it plays the first 15 seconds, muted. Tutors without a clip get a 15-second
 * reel made from their own profile — headline, experience, subjects and teaching approach.
 */
export function IntroReel({ tutor, playing, compact }: { tutor: Tutor; playing: boolean; /** Smaller type for small photos (list rows). */ compact?: boolean }) {
  return (
    <AnimatePresence>
      {playing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="absolute inset-0 z-[5] overflow-hidden bg-night"
          aria-hidden
        >
          {tutor.introVideoUrl ? <IntroVideo src={tutor.introVideoUrl} /> : <ProfileReel tutor={tutor} compact={compact} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function IntroVideo({ src }: { src: string }) {
  return (
    <video
      src={src}
      autoPlay
      muted
      playsInline
      preload="metadata"
      className="size-full object-cover"
      // Loop the first 15 seconds only.
      onTimeUpdate={(e) => {
        if (e.currentTarget.currentTime >= INTRO_SECONDS) e.currentTarget.currentTime = 0;
      }}
      onEnded={(e) => {
        e.currentTarget.currentTime = 0;
        void e.currentTarget.play();
      }}
    />
  );
}

function ProfileReel({ tutor, compact }: { tutor: Tutor; compact?: boolean }) {
  const slides = React.useMemo(() => introSlides(tutor), [tutor]);
  const each = INTRO_SECONDS / slides.length;
  const [index, setIndex] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), each * 1000);
    return () => clearInterval(id);
  }, [slides.length, each]);
  const slide = slides[index];

  return (
    <div className={cn("relative flex size-full flex-col bg-brand-deep text-white", compact ? "px-2.5 pb-10 pt-2.5" : "px-4 pb-12 pt-4")}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_100%_0%,rgb(75_107_99/0.38),transparent_70%),radial-gradient(ellipse_70%_70%_at_0%_100%,rgb(217_80_43/0.28),transparent_70%)]" />
      {/* Story-style progress: one bar per slide */}
      <div className="relative flex gap-1">
        {slides.map((s, i) => (
          <span key={s.label} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
            <span
              key={i === index ? `on-${index}` : "off"}
              className="block h-full origin-left rounded-full bg-white"
              style={i < index ? undefined : i === index ? { animation: `reel-fill ${each}s linear forwards` } : { transform: "scaleX(0)" }}
            />
          </span>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="relative mt-auto"
        >
          <p className={cn("font-semibold uppercase tracking-[0.1em] text-white/65", compact ? "text-[9.5px]" : "text-[11.5px]")}>{slide.label}</p>
          <p className={cn("mt-1 line-clamp-3 font-heading font-semibold tracking-[-0.015em]", compact ? "text-[12.5px] leading-tight" : "text-[17px] leading-snug")}>{slide.text}</p>
          {slide.sub && !compact && <p className="mt-1 text-[12.5px] text-white/70">{slide.sub}</p>}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
