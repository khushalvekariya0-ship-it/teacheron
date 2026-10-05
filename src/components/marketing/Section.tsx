"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Reveal, WordReveal } from "@/components/motion";

/*
 * Page structure: full-bleed sections stacked on a white page, separated by space rather than
 * colour. Headlines are two-tone (ink + soft grey); the indigo accent is kept for actions.
 */

type Tone = "default" | "canvas" | "brand" | "dark" | "yellow";

const TONE: Record<Tone, string> = {
  default: "bg-page",
  canvas: "bg-canvas",
  brand: "bg-brand-50",
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
  const titleCls = cn("font-heading text-[2.15rem] font-bold leading-[1.04] tracking-[-0.042em] sm:text-[2.75rem] lg:text-[3.25rem]", dark ? "text-white" : "text-ink");
  return (
    <div className={cn("mb-10 flex flex-col gap-6 lg:mb-14", align === "center" ? "items-center text-center" : "sm:flex-row sm:items-end sm:justify-between", className)}>
      <Reveal className={cn("max-w-3xl", align === "center" && "mx-auto flex flex-col items-center")}>
        {eyebrow && (
          <Eyebrow className={cn("mb-6", dark && "border-white/20 bg-white/10 text-white shadow-none")} center={align === "center"}>
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

/** Quiet text link with an arrow that slides on hover. */
export function ArrowLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-1.5 text-[15px] font-medium text-ink transition-colors hover:text-brand", className)}>
      {children}
      <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
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
          "font-heading font-bold text-ink",
          compact
            ? "text-[2.2rem] leading-[1.05] tracking-[-0.04em] sm:text-[2.6rem] lg:text-[3rem]"
            : "text-[2.5rem] leading-[1.03] tracking-[-0.045em] sm:text-[3.25rem] lg:text-[3.75rem]",
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
      <div className="pointer-events-none absolute inset-0 -z-10 bg-line-grid [mask-image:radial-gradient(ellipse_80%_70%_at_50%_0%,black_20%,transparent_75%)]" aria-hidden />
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
    <section className="relative">
      <div className="container-page py-16 sm:py-20">
        <div className="relative overflow-hidden rounded-3xl bg-night px-6 py-14 text-white sm:px-14 sm:py-16">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.06)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_90%_at_85%_0%,black,transparent_70%)]" aria-hidden />
          <div className="relative flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <WordReveal as="h2" inView text={title} accent={2} className="font-heading text-[2rem] font-bold leading-[1.06] tracking-[-0.04em] text-white sm:text-[2.6rem] [&_.text-aurora]:text-white/55" />
              {description && (
                <Reveal delay={0.15}>
                  <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-white/65">{description}</p>
                </Reveal>
              )}
            </div>
            <Reveal delay={0.25} className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-white text-night shadow-none hover:bg-white/90 active:bg-white/80">
                <Link href={primary.href}>
                  {primary.label} <ArrowRight />
                </Link>
              </Button>
              {secondary && (
                <Button asChild variant="ghost" size="lg" className="border border-white/20 text-white hover:bg-white/10 hover:text-white">
                  <Link href={secondary.href}>{secondary.label}</Link>
                </Button>
              )}
            </Reveal>
          </div>
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
