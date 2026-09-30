"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal, WordReveal, Magnetic } from "@/components/motion";
import { Button } from "@/components/ui/Button";

/*
 * Page structure: full-bleed sections stacked on a white page. Color blocks (light brand tint,
 * soft grey, black) mark heroes and key moments. Headlines are tight and extra-bold.
 */

type Tone = "default" | "canvas" | "brand" | "dark" | "yellow";

const TONE: Record<Tone, string> = {
  default: "bg-surface",
  canvas: "bg-canvas",
  brand: "bg-brand-soft",
  dark: "bg-night text-white",
  yellow: "bg-yellow-soft",
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
      <div className="container-page relative py-16 sm:py-20 lg:py-24">{children}</div>
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
    <Tag className={cn("relative overflow-clip bg-surface", className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Small label above a headline: a quiet pill with a brand dot. */
export function Eyebrow({ children, className, center }: { children: React.ReactNode; className?: string; center?: boolean }) {
  return (
    <p className={cn("inline-flex w-fit items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[13px] font-semibold text-ink-2", center && "mx-auto", className)}>
      <span className="size-1.5 rounded-full bg-brand" aria-hidden />
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
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "left" | "center";
  action?: React.ReactNode;
  className?: string;
  dark?: boolean;
  /** @deprecated Accent words are no longer styled differently; kept for call-site compatibility. */
  accent?: number;
}) {
  const titleCls = cn("font-heading text-[2.1rem] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-[2.75rem] lg:text-[3.35rem]", dark ? "text-white" : "text-ink");
  return (
    <div className={cn("mb-10 flex flex-col gap-6 lg:mb-14", align === "center" ? "items-center text-center" : "sm:flex-row sm:items-end sm:justify-between", className)}>
      <Reveal className={cn("max-w-3xl", align === "center" && "mx-auto flex flex-col items-center")}>
        {eyebrow && (
          <Eyebrow className={cn("mb-5", dark && "border-white/20 bg-white/10 text-white")} center={align === "center"}>
            {eyebrow}
          </Eyebrow>
        )}
        {typeof title === "string" ? (
          <WordReveal as="h2" inView text={title} delay={0.05} className={titleCls} />
        ) : (
          <h2 className={titleCls}>{title}</h2>
        )}
        {description && <p className={cn("mt-5 max-w-2xl text-[17px] leading-relaxed sm:text-lg", dark ? "text-white/70" : "text-ink-2")}>{description}</p>}
      </Reveal>
      {action && (
        <Reveal delay={0.1} className="shrink-0">
          {action}
        </Reveal>
      )}
    </div>
  );
}

/** Bold underlined text link with an arrow. */
export function ArrowLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-1.5 text-[15px] font-semibold text-ink underline decoration-2 underline-offset-[6px] transition-[text-underline-offset] hover:underline-offset-[4px]", className)}>
      {children}
      <ArrowRight className="size-[18px] transition-transform duration-300 group-hover:translate-x-1" />
    </Link>
  );
}

/** Hero for inner marketing pages: a light brand-tint block with an extra-bold headline. */
export function PageHero({
  eyebrow,
  title,
  description,
  actions,
  children,
  align = "left",
  size = "default",
  tone = "brand",
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  align?: "left" | "center";
  /** "compact" for app-like pages (directory, jobs, compare) where the content should start sooner. */
  size?: "default" | "compact";
  tone?: "brand" | "canvas" | "yellow";
}) {
  const compact = size === "compact";
  return (
    <section className={cn("relative overflow-hidden", tone === "brand" ? "bg-brand-soft" : tone === "yellow" ? "bg-yellow-soft" : "bg-canvas")}>
      <div
        className={cn(
          "container-page relative",
          compact ? "pb-10 pt-10 sm:pb-12 sm:pt-12 lg:pb-14 lg:pt-14" : "pb-16 pt-14 sm:pb-20 sm:pt-16 lg:pb-24 lg:pt-20",
          align === "center" && "text-center",
        )}
      >
        <div className={cn("max-w-4xl", align === "center" && "mx-auto flex flex-col items-center")}>
          {eyebrow && (
            <Reveal>
              <Eyebrow className={compact ? "mb-4" : "mb-6"} center={align === "center"}>
                {eyebrow}
              </Eyebrow>
            </Reveal>
          )}
          <WordReveal
            text={title}
            className={cn(
              "font-heading font-extrabold text-ink",
              compact
                ? "text-[2.35rem] leading-[1] tracking-[-0.035em] sm:text-5xl lg:text-[3.6rem]"
                : "text-[2.75rem] leading-[0.98] tracking-[-0.04em] sm:text-6xl lg:text-[4.6rem]",
            )}
          />
          {description && (
            <Reveal delay={0.2}>
              <p className={cn("max-w-2xl leading-relaxed text-ink/80", compact ? "mt-4 text-[17px]" : "mt-6 text-lg sm:text-xl")}>{description}</p>
            </Reveal>
          )}
          {actions && (
            <Reveal delay={0.3} className={cn("mt-8 flex flex-wrap gap-3", align === "center" && "justify-center")}>
              {actions}
            </Reveal>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}

/** Closing call-to-action block on the light brand tint. */
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
    <section className="relative overflow-hidden bg-brand-soft">
      <div className="container-page relative grid gap-8 py-16 sm:py-20 lg:grid-cols-[1fr_auto] lg:items-end lg:py-24">
        <div className="max-w-3xl">
          <WordReveal as="h2" inView text={title} className="font-heading text-[2.4rem] font-extrabold leading-[0.98] tracking-[-0.04em] text-ink sm:text-6xl" />
          {description && (
            <Reveal delay={0.15}>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink/80">{description}</p>
            </Reveal>
          )}
        </div>
        <Reveal delay={0.25} className="flex flex-col gap-3 sm:flex-row">
          <Magnetic>
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href={primary.href}>
                {primary.label} <ArrowRight />
              </Link>
            </Button>
          </Magnetic>
          {secondary && (
            <Button asChild size="lg" variant="secondary" className="bg-transparent hover:bg-ink/5">
              <Link href={secondary.href}>{secondary.label}</Link>
            </Button>
          )}
        </Reveal>
      </div>
    </section>
  );
}

const FEATURE_TINTS = ["bg-brand-soft", "bg-sky-soft", "bg-yellow-soft", "bg-teal-soft", "bg-violet-soft", "bg-peach-soft"];

/** Feature list item with a flat pastel icon tile (tint is picked from the title so it stays stable). */
export function FeatureItem({ icon, title, children, dark }: { icon: React.ReactNode; title: string; children: React.ReactNode; dark?: boolean }) {
  const tint = FEATURE_TINTS[[...title].reduce((a, c) => a + c.charCodeAt(0), 0) % FEATURE_TINTS.length];
  return (
    <div className="flex gap-4">
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-lg [&_svg]:size-5", dark ? "bg-white/10 text-white" : cn(tint, "text-ink"))}>{icon}</span>
      <div>
        <h3 className={cn("text-[16px] font-bold tracking-[-0.01em]", dark ? "text-white" : "text-ink")}>{title}</h3>
        <p className={cn("mt-1 text-[15px] leading-relaxed", dark ? "text-white/70" : "text-ink-2")}>{children}</p>
      </div>
    </div>
  );
}
