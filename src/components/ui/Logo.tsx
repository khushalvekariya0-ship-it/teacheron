import Link from "next/link";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/site";

/** Geometric mark: two strokes forming a "T" with a blue dot — tutor + connection. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-ink" />
      <path d="M9 10.5h14" className="stroke-surface" strokeWidth="3" strokeLinecap="round" />
      <path d="M16 10.5v11.5" className="stroke-surface" strokeWidth="3" strokeLinecap="round" />
      <circle cx="22.8" cy="21.8" r="2.6" fill="#60a5fa" />
    </svg>
  );
}

export function Logo({ className, href = "/", compact }: { className?: string; href?: string; compact?: boolean }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2 rounded-md", className)} aria-label={`${SITE.name} home`}>
      <LogoMark className="transition-transform duration-300 group-hover:rotate-[-6deg]" />
      {!compact && <span className="font-heading text-[22px] font-extrabold tracking-[-0.04em] text-ink">{SITE.name}</span>}
    </Link>
  );
}
