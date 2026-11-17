"use client";

import * as React from "react";
import { ShieldAlert } from "lucide-react";
import { describeKinds, scanContact, type ContactKind } from "@/lib/domain/contact";
import { cn } from "@/lib/utils";

/*
 * A warning while someone types: the same rules the server uses (src/lib/domain/contact.ts) say the
 * message would be blocked. It's only a hint: the server still checks and decides on Send, and records
 * the attempt, so a changed page can't get around it.
 */

function hintFor(kinds: ContactKind[]): string {
  if (kinds.every((k) => k === "request")) return "Asking to talk, meet or pay outside TutorLink isn't allowed. If you send this, it will be blocked and recorded.";
  return `This looks like ${describeKinds(kinds)}. Phone numbers, emails, social media and outside contact can't be sent on TutorLink: it will be blocked and recorded.`;
}

/** The warning for a draft, or null. Checked as the person types (after they pause). */
export function useContactHint(text: string): string | null {
  const draft = React.useDeferredValue(text);
  return React.useMemo(() => {
    const t = draft.trim();
    if (t.length < 3) return null;
    const found = scanContact(t.slice(0, 2000), "chat");
    return found.found ? hintFor(found.kinds) : null;
  }, [draft]);
}

export function ContactHint({ text, className }: { text: string; className?: string }) {
  const hint = useContactHint(text);
  if (!hint) return null;
  return (
    <p role="status" data-contact-hint="" className={cn("mb-2 flex items-start gap-2 rounded-xl border border-warning-200 bg-warning-50 px-3 py-2 text-[12.5px] leading-snug text-ink", className)}>
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <span>{hint}</span>
    </p>
  );
}
