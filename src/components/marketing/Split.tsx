import * as React from "react";
import { cn } from "@/lib/utils";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { FeatureItem, SectionHeading } from "./Section";

export interface Feature {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}

/** Two-column marketing block: heading + staggered features on one side, a product vignette on the other. */
export function Split({
  eyebrow,
  title,
  description,
  features,
  visual,
  reverse,
  action,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  features?: Feature[];
  visual: React.ReactNode;
  reverse?: boolean;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid items-center gap-12 lg:grid-cols-2 lg:gap-20", className)}>
      <div className={reverse ? "lg:order-2" : undefined}>
        <SectionHeading className="mb-8 lg:mb-10" eyebrow={eyebrow} title={title} description={description} />
        {features && (
          <Stagger className="space-y-6" stagger={0.08}>
            {features.map((f) => (
              <StaggerItem key={f.title}>
                <FeatureItem icon={f.icon} title={f.title}>
                  {f.body}
                </FeatureItem>
              </StaggerItem>
            ))}
          </Stagger>
        )}
        {action && (
          <Reveal delay={0.15} className="mt-8 flex flex-wrap gap-3">
            {action}
          </Reveal>
        )}
      </div>
      <Reveal delay={0.1} className={reverse ? "lg:order-1" : undefined}>
        <div className="mx-auto max-w-md lg:max-w-none">{visual}</div>
      </Reveal>
    </div>
  );
}

const CARD_TINTS = ["bg-brand-soft", "bg-sky-soft", "bg-yellow-soft", "bg-teal-soft", "bg-violet-soft", "bg-peach-soft"];

/** Simple icon-card grid for principles, safeguards and similar lists. */
export function CardGrid({ items, columns = 3 }: { items: Feature[]; columns?: 2 | 3 | 4 }) {
  return (
    <Stagger className={cn("grid gap-4 sm:grid-cols-2", columns === 3 && "lg:grid-cols-3", columns === 4 && "lg:grid-cols-4")} stagger={0.07}>
      {items.map((it, i) => (
        <StaggerItem key={it.title} className="h-full">
          <div className="h-full rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <span className={cn("grid size-11 place-items-center rounded-lg text-ink [&_svg]:size-5", CARD_TINTS[i % CARD_TINTS.length])}>{it.icon}</span>
            <h3 className="mt-4 text-[17px] font-bold tracking-[-0.01em] text-ink">{it.title}</h3>
            <div className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{it.body}</div>
          </div>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
