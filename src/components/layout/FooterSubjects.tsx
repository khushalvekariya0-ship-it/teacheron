"use client";

import Link from "next/link";
import { useCatalog } from "@/lib/store/hooks";

/** Popular subjects from the live catalog, so subjects an admin adds, renames or hides update here too. */
export function FooterSubjects() {
  const { subjects } = useCatalog();
  // Popular subjects first, topped up with others; until there are any, a link to the subjects page.
  const shown = [...subjects.filter((s) => s.popular), ...subjects.filter((s) => !s.popular)].slice(0, 6);
  if (shown.length === 0)
    return (
      <ul className="mt-4 space-y-2.5">
        <li>
          <Link href="/subjects" className="text-[14px] text-muted transition-colors hover:text-ink">
            All subjects
          </Link>
        </li>
      </ul>
    );
  return (
    <ul className="mt-4 space-y-2.5">
      {shown.map((s) => (
          <li key={s.slug}>
            <Link href={`/subjects/${s.slug}`} className="text-[14px] text-muted transition-colors hover:text-ink">
              {s.name}
            </Link>
          </li>
      ))}
    </ul>
  );
}
