"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { inSection } from "@/lib/nav-sections";

/*
 * Notification links that were unread when the person opened a sidebar item (the sidebar marks them
 * read straight away, see Shell.tsx). Rows on that page show "New" for them until the person moves to
 * another item.
 */

const listeners = new Set<() => void>();
let fresh: { section: string; links: ReadonlySet<string> } = { section: "", links: new Set() };
const NONE: ReadonlySet<string> = new Set();

export function rememberFresh(section: string, links: string[]) {
  const keep = fresh.section === section ? [...fresh.links] : [];
  fresh = { section, links: new Set([...keep, ...links]) };
  listeners.forEach((l) => l());
}

/** The links that were new on this page (e.g. "/dashboard/bookings/bk_1", "/admin/chat-safety?user=u_1"). */
export function useFreshLinks(): ReadonlySet<string> {
  const pathname = usePathname();
  const current = React.useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => fresh,
    () => fresh,
  );
  return current.section && inSection(pathname, current.section) ? current.links : NONE;
}
