"use client";

import Link from "next/link";
import { useCatalog } from "@/lib/store/hooks";

/** Popular subjects from the live catalog, so subjects an admin adds, renames or hides update here too. */
export function FooterSubjects() {
  const { subjects } = useCatalog();
  return (
    <ul className="mt-4 space-y-2.5">
      {subjects
        .filter((s) => s.popular)
        .slice(0, 6)
        .map((s) => (
          <li key={s.slug}>
            <Link href={`/subjects/${s.slug}`} className="text-[14px] text-muted transition-colors hover:text-ink">
              {s.name}
            </Link>
          </li>
        ))}
    </ul>
  );
}
