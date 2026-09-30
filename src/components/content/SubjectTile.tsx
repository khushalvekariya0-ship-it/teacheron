import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Subject } from "@/lib/types";
import { formatCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import { rateRange, tutorsForSubject } from "./insights";

/** Subject link card with real tutor counts and starting rate from the sample catalog. */
export function SubjectTile({ subject, className, showSummary = true }: { subject: Subject; className?: string; showSummary?: boolean }) {
  const tutors = tutorsForSubject(subject.slug);
  const range = rateRange(tutors);
  return (
    <Link
      href={`/subjects/${subject.slug}`}
      className={cn(
        "group flex h-full flex-col rounded-xl border border-line bg-surface p-4 transition-[border-color,box-shadow] duration-300 hover:border-line-strong hover:shadow-md",
        className,
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="text-[15px] font-semibold text-ink">{subject.name}</span>
        <ArrowRight className="mt-0.5 size-4 shrink-0 -translate-x-1 text-subtle opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:text-navy group-hover:opacity-100" aria-hidden />
      </span>
      {showSummary && <span className="mt-1 text-[13px] leading-snug text-muted">{subject.summary}</span>}
      <span className="mt-auto flex flex-wrap items-center gap-x-2 pt-3 text-[12.5px] tabular-nums text-ink-2">
        {tutors.length ? (
          <>
            <span className="font-medium">
              {tutors.length} {tutors.length === 1 ? "tutor" : "tutors"}
            </span>
            {range && (
              <>
                <span className="text-subtle" aria-hidden>·</span>
                <span className="text-muted">from {formatCents(range.min)}/hr</span>
              </>
            )}
          </>
        ) : (
          <span className="text-muted">No tutors yet</span>
        )}
      </span>
    </Link>
  );
}
