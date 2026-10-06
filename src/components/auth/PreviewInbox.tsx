"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Stands in for an email in the preview build: whatever the real site would send to the inbox
 * (a reset link, a verification link) is shown here instead, so the whole flow can be followed.
 */
export function PreviewInbox({ to, subject, href, cta, className }: { to: string; subject: string; href: string; cta: string; className?: string }) {
  return (
    <div className={cn("border border-line bg-canvas p-4", className)} role="region" aria-label="Preview inbox">
      <p className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
        <Inbox className="size-3.5" aria-hidden /> Preview inbox · instead of an email
      </p>
      <p className="mt-2.5 text-[14px] text-ink-2">
        <span className="text-muted">To:</span> <span className="font-medium text-ink">{to}</span>
      </p>
      <p className="text-[14px] text-ink-2">
        <span className="text-muted">Subject:</span> <span className="font-medium text-ink">{subject}</span>
      </p>
      <Link href={href} className="group mt-3 inline-flex items-center gap-2 text-[14.5px] font-medium text-ink">
        <span className="border-b-[1.5px] border-brand pb-px">{cta}</span>
        <ArrowRight className="size-4 text-brand transition-transform group-hover:translate-x-1" aria-hidden />
      </Link>
    </div>
  );
}
