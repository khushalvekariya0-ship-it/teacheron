import * as React from "react";
import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { TUTORS } from "@/lib/data/tutors";

/** Flat pastel tiles behind initials and illustrations — no stock photography in the preview build. */
const TONES = [
  "bg-brand-soft text-ink",
  "bg-yellow-soft text-ink",
  "bg-sky-soft text-ink",
  "bg-teal-soft text-ink",
  "bg-peach-soft text-ink",
  "bg-violet-soft text-ink",
];

/** Sample tutors have illustrated portraits (CC0 "Notionists" by Zoish, generated with DiceBear). */
const ILLUSTRATION: Record<string, string> = Object.fromEntries(TUTORS.map((t) => [`${t.firstName} ${t.lastName}`, `/illustrations/tutors/${t.slug}.svg`]));

const SIZES = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-[15px]",
  xl: "size-16 text-lg",
  "2xl": "size-24 text-2xl",
  "3xl": "size-36 text-4xl",
} as const;

export function Avatar({
  name,
  src,
  tone,
  size = "md",
  verified,
  className,
  square,
}: {
  name: string;
  src?: string | null;
  tone?: number;
  size?: keyof typeof SIZES;
  verified?: boolean;
  className?: string;
  square?: boolean;
}) {
  const toneIdx = tone ?? [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length;
  const art = src ? null : ILLUSTRATION[name];
  const shape = square ? (size === "3xl" || size === "2xl" || size === "xl" ? "rounded-xl" : "rounded-lg") : "rounded-full";
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className={cn("object-cover ring-1 ring-line", shape, SIZES[size])} />
      ) : art ? (
        <span role="img" aria-label={name} className={cn("overflow-hidden", shape, SIZES[size], TONES[toneIdx % TONES.length])}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={art} alt="" className="size-full translate-y-[6%] scale-110 object-cover" loading="lazy" decoding="async" />
        </span>
      ) : (
        <span role="img" aria-label={name} className={cn("grid place-items-center font-bold tracking-tight", shape, SIZES[size], TONES[toneIdx % TONES.length])}>
          {initials(name)}
        </span>
      )}
      {verified && (
        <span className="absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full bg-surface p-px" title="Identity verified">
          <BadgeCheck className={cn("fill-ink text-surface", size === "xs" || size === "sm" ? "size-3.5" : size === "3xl" || size === "2xl" || size === "xl" ? "size-6" : "size-4")} aria-label="Identity verified" />
        </span>
      )}
    </span>
  );
}
