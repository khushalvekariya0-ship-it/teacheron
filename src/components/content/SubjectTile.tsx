import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Subject } from "@/lib/types";
import { formatCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import { rateRange, tutorsForSubject } from "./insights";

/** Subject link card. Shows real tutor counts and the starting rate when tutors teach it. */
export function SubjectTile({ subject, className, showSummary = true }: { subject: Subject; className?: string; showSummary?: boolean }) {
  const tutors = tutorsForSubject(subject.slug);
  const range = rateRange(tutors);
  return (
    <Link
      href={`/subjects/${subject.slug}`}
      className={cn(
        "group flex h-full flex-col rounded-xl border border-line bg-surface p-5 transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-[0_16px_36px_-24px_rgb(15_23_42/0.45)]",
        className,
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="text-[16px] font-semibold leading-snug text-ink">{subject.name}</span>
        {subject.popular && <span className="shrink-0 rounded-md bg-brand-soft px-1.5 py-0.5 text-[11px] font-semibold text-brand">Popular</span>}
      </span>
      {showSummary && <span className="mt-1.5 text-[13.5px] leading-snug text-muted">{subject.summary}</span>}
      <span className="mt-auto flex items-center justify-between gap-3 pt-4">
        <span className="text-[12.5px] tabular-nums text-ink-2">
          {tutors.length ? (
            <>
              <span className="font-semibold">
                {tutors.length} {tutors.length === 1 ? "tutor" : "tutors"}
              </span>
              {range && <span className="text-muted"> · from {formatCents(range.min)}/hr</span>}
            </>
          ) : (
            <span className="font-medium text-brand">See tutors</span>
          )}
        </span>
        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line text-muted transition-colors duration-300 group-hover:border-transparent group-hover:bg-brand-gradient group-hover:text-on-brand">
          <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
        </span>
      </span>
    </Link>
  );
}
