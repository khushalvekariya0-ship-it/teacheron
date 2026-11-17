/*
 * Which part of a dashboard a notification belongs to, from its link. The sidebar counts unread
 * notifications on the item their link opens, and opening that item marks them read
 * (`markSectionRead`), for students, parents, tutors and staff alike.
 */

/** Public pages whose notifications belong to a dashboard item. */
const ALIASES: [from: string, to: string][] = [["/tutor-jobs", "/dashboard/jobs"]];

/** The path a notification opens (query and #part dropped, public pages mapped to their dashboard item). */
export function notePath(href: string | undefined | null): string | null {
  if (!href || !href.startsWith("/") || href.startsWith("//")) return null;
  let path = href.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  for (const [from, to] of ALIASES) if (path === from || path.startsWith(`${from}/`)) path = to + path.slice(from.length);
  return path;
}

/** Whether a path is inside a sidebar item (the overview pages only match themselves). */
export function inSection(path: string, section: string): boolean {
  if (section === "/dashboard" || section === "/admin") return path === section;
  return path === section || path.startsWith(`${section}/`);
}
