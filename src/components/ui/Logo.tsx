import Link from "next/link";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/site";

/** Geometric mark: two strokes forming a "T" with an orange square — tutor + connection. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" className="fill-ink" />
      <path d="M9 10.5h14" className="stroke-page" strokeWidth="3" strokeLinecap="square" />
      <path d="M16 10.5v11.5" className="stroke-page" strokeWidth="3" strokeLinecap="square" />
      <rect x="20.5" y="19.5" width="5" height="5" className="fill-brand" />
    </svg>
  );
}

export function Logo({ className, href = "/", compact }: { className?: string; href?: string; compact?: boolean }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2 rounded-md", className)} aria-label={`${SITE.name} home`}>
      <LogoMark className="size-7 transition-transform duration-300 group-hover:rotate-[-6deg]" />
      {!compact && (
        <span className="font-heading text-[23px] leading-none text-ink">
          Tutor<em className="not-italic italic">Link</em>
        </span>
      )}
    </Link>
  );
}
