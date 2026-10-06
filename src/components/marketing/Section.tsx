"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal, WordReveal } from "@/components/motion";

/*
 * Page structure: full-bleed sections stacked on a white page, separated by space rather than
 * colour. Headlines are two-tone (ink + soft grey); the indigo accent is kept for actions.
 */

type Tone = "default" | "canvas" | "brand" | "dark" | "yellow";

const TONE: Record<Tone, string> = {
  default: "bg-page",
  canvas: "bg-canvas",
  brand: "bg-canvas",
  dark: "bg-night text-white",
  yellow: "bg-canvas",
};

export function Section({
  className,
  children,
  id,
  tone = "default",
  backdrop,
}: {
  className?: string;
  children: React.ReactNode;
  id?: string;
  tone?: Tone;
  /** Decorative layers painted across the whole section, behind the content. */
  backdrop?: React.ReactNode;
}) {
  return (
    // overflow-clip (not hidden) so sticky columns inside a section still stick
    <section id={id} className={cn("relative overflow-clip", TONE[tone], className)}>
      {backdrop}
      <div className="container-page relative py-16 sm:py-24 lg:py-28">{children}</div>
    </section>
  );
}

/** A full-bleed block for free-form page content (directories, forms, detail views) that manages its own inner layout. */
export function Panel({
  children,
  className,
  as: Tag = "section",
  ...rest
}: { children: React.ReactNode; className?: string; as?: "section" | "div" | "article" } & Omit<React.HTMLAttributes<HTMLElement>, "className" | "children">) {
  return (
    <Tag className={cn("relative overflow-clip bg-page", className)} {...rest}>
      {children}
    </Tag>
  );
}

/** The label above a section headline: a crisp pill with an indigo dot. Same size on every section. */
export function Eyebrow({ children, className, center }: { children: React.ReactNode; className?: string; center?: boolean }) {
  return (
    <p className={cn("kicker", center && "mx-auto", className)}>
      <span className="kicker-dot" aria-hidden />
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  action,
  className,
  dark,
  accent = 0,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "left" | "center";
  action?: React.ReactNode;
  className?: string;
  dark?: boolean;
  /** How many of the title's last words get the gradient (0 = none). */
  accent?: number;
}) {
  const titleCls = cn("font-heading text-[2.4rem] leading-[1.02] sm:text-[3rem] lg:text-[3.6rem]", dark ? "text-white" : "text-ink");
  return (
    <div className={cn("mb-10 flex flex-col gap-6 lg:mb-14", align === "center" ? "items-center text-center" : "sm:flex-row sm:items-end sm:justify-between", className)}>
      <Reveal className={cn("max-w-3xl", align === "center" && "mx-auto flex flex-col items-center")}>
        {eyebrow && (
          <Eyebrow className={cn("mb-6", dark && "text-white")} center={align === "center"}>
            {eyebrow}
          </Eyebrow>
        )}
        {typeof title === "string" ? (
          <WordReveal as="h2" inView text={title} accent={accent} delay={0.05} className={titleCls} />
        ) : (
          <h2 className={titleCls}>{title}</h2>
        )}
        {description && <p className={cn("mt-5 max-w-2xl text-[17px] leading-relaxed sm:text-[18px]", dark ? "text-white/65" : "text-muted")}>{description}</p>}
      </Reveal>
      {action && (
        <Reveal delay={0.1} className="shrink-0">
          {action}
        </Reveal>
      )}
    </div>
  );
}

/** Text link on an orange underline, with an orange arrow that slides on hover. */
export function ArrowLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2 text-[15px] font-medium text-ink transition-colors hover:text-brand", className)}>
      <span className="border-b-[1.5px] border-brand pb-px">{children}</span>
      <ArrowRight className="size-4 text-brand transition-transform duration-300 group-hover:translate-x-1" />
    </Link>
  );
}

/** Hero for inner marketing pages: white, with a faint grid fading out behind a two-tone headline and an optional photo. */
export function PageHero({
  eyebrow,
  title,
  description,
  actions,
  children,
  align = "left",
  size = "default",
  tone = "brand",
  image,
  accent = 2,
}: {
  eyebrow?: string;
  title: string;
  /** How many of the title's last words get the gradient (0 = none). */
  accent?: number;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  align?: "left" | "center";
  /** "compact" for app-like pages (directory, jobs, compare) where the content should start sooner. */
  size?: "default" | "compact";
  tone?: "brand" | "canvas" | "yellow";
  /** Optional photo shown beside the text on large screens (general imagery only). */
  image?: { src: string; alt: string };
}) {
  const compact = size === "compact";
  const center = align === "center" && !image;
  const text = (
    <div className={cn("max-w-3xl", center && "mx-auto flex flex-col items-center")}>
      {eyebrow && (
        <Reveal>
          <Eyebrow className={compact ? "mb-5" : "mb-6"} center={center}>
            {eyebrow}
          </Eyebrow>
        </Reveal>
      )}
      <WordReveal
        text={title}
        accent={accent}
        className={cn(
          "font-heading text-ink",
          compact
            ? "text-[2.5rem] leading-[1.02] sm:text-[3rem] lg:text-[3.4rem]"
            : "text-[2.9rem] leading-[1] sm:text-[3.75rem] lg:text-[4.4rem]",
        )}
      />
      {description && (
        <Reveal delay={0.2}>
          <p className={cn("max-w-2xl leading-relaxed text-muted", compact ? "mt-4 text-[17px]" : "mt-5 text-[18px]")}>{description}</p>
        </Reveal>
      )}
      {actions && (
        <Reveal delay={0.3} className={cn("mt-8 flex flex-wrap gap-3", center && "justify-center")}>
          {actions}
        </Reveal>
      )}
    </div>
  );
  return (
    <section className={cn("relative isolate -mt-16 border-b border-line pt-16", tone === "canvas" ? "bg-canvas" : "bg-page")}>
      <div className="page-glow pointer-events-none absolute inset-0 -z-10" aria-hidden />
      <div
        className={cn(
          "container-page relative",
          compact ? "pb-10 pt-10 sm:pb-12 sm:pt-12 lg:pb-14 lg:pt-14" : "pb-14 pt-12 sm:pb-16 sm:pt-14 lg:pb-20 lg:pt-16",
          center && "text-center",
        )}
      >
        {image ? (
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
            {text}
            <Reveal delay={0.15}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-line shadow-xl">
                <Image src={image.src} alt={image.alt} fill preload sizes="(min-width: 1024px) 520px, 100vw" className="object-cover" />
              </div>
            </Reveal>
          </div>
        ) : (
          text
        )}
        {children}
      </div>
    </section>
  );
}

/** Closing call-to-action: a dark rounded card with a faint grid, white headline and two actions. */
export function CtaBand({
  title,
  description,
  primary,
  secondary,
}: {
  title: string;
  description?: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <section className="relative isolate overflow-hidden border-y border-line bg-night">
      {/* A crisp backdrop: a fine grid, and nested squares stepping out from the logo's corner mark */}
      <div className="pointer-events-none absolute inset-0 -z-10 [background-image:linear-gradient(to_right,rgb(238_233_221/0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgb(238_233_221/0.06)_1px,transparent_1px)] [background-size:56px_56px]" aria-hidden />
      <svg className="pointer-events-none absolute inset-y-0 right-0 -z-10 hidden h-full w-[62%] lg:block" viewBox="0 0 900 600" preserveAspectRatio="xMaxYMid slice" fill="none" aria-hidden>
        {[80, 160, 240, 320, 400, 480].map((r, i) => (
          <rect key={r} x={560 - r} y={300 - r} width={r * 2} height={r * 2} stroke="#eee9dd" strokeOpacity={0.16 - i * 0.02} strokeWidth="1.25" />
        ))}
        <rect x="536" y="276" width="48" height="48" fill="#e5582f" />
        <path d="M80 300H480M560 60V236" stroke="#eee9dd" strokeOpacity="0.14" strokeWidth="1.25" />
      </svg>
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-[linear-gradient(to_right,#e5582f,transparent_55%)]" aria-hidden />
      <div className="container-page py-20 sm:py-28">
        <div className="max-w-xl bg-[#f6f2e8] p-8 text-[#15140f] sm:p-12">
          <WordReveal as="h2" inView text={title} accent={2} className="font-heading text-[2.4rem] leading-[1.02] text-[#15140f] sm:text-[3.2rem]" />
          {description && (
            <Reveal delay={0.15}>
              <p className="mt-5 text-[16.5px] leading-relaxed text-[#3a362d]">{description}</p>
            </Reveal>
          )}
          <Reveal delay={0.25} className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
            <Link href={primary.href} className="inline-flex h-13 items-center gap-2 bg-[#15140f] px-6 text-[15.5px] font-medium text-[#f4f0e6] transition-colors hover:bg-[#2a2721]">
              {primary.label} <ArrowRight className="size-[18px]" />
            </Link>
            {secondary && (
              <Link href={secondary.href} className="group inline-flex items-center gap-2 text-[15px] font-medium text-[#15140f]">
                <span className="border-b-[1.5px] border-[#b83a19] pb-px">{secondary.label}</span>
                <ArrowRight className="size-4 text-[#b83a19] transition-transform group-hover:translate-x-1" />
              </Link>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/** Feature list item with a crisp outlined icon tile. */
export function FeatureItem({ icon, title, children, dark }: { icon: React.ReactNode; title: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <div className="flex gap-4">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl border [&_svg]:size-[18px]", dark ? "border-white/15 bg-white/5 text-white" : "border-line bg-surface text-brand shadow-xs")}>{icon}</span>
      <div>
        <h3 className={cn("text-[16px] font-semibold tracking-[-0.015em]", dark ? "text-white" : "text-ink")}>{title}</h3>
        <p className={cn("mt-1 text-[15px] leading-relaxed", dark ? "text-white/65" : "text-muted")}>{children}</p>
      </div>
    </div>
  );
}
