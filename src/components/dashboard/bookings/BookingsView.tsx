"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookOpen, CalendarCheck2, CalendarDays, CalendarX2, Clock, Inbox, Search, X } from "lucide-react";
import type { Booking } from "@/lib/types";
import { useNow, useSession, useViewerTimezone } from "@/lib/store/hooks";
import { actorFor } from "@/lib/permissions";
import { subjectName } from "@/lib/data/catalog";
import { pluralize } from "@/lib/format";
import { AnimatePresence, EASE, motion } from "@/components/motion";
import { PageHeader } from "@/components/dashboard/Shell";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Disclosure";
import { EmptyState, InlineAlert } from "@/components/ui/States";
import { BookingRow } from "./BookingRow";
import { bucketOf, isOpenRequest, useMyBookings, usePeople, viewerKind } from "./shared";

type Tab = "upcoming" | "requests" | "past" | "cancelled";
const TABS: Tab[] = ["upcoming", "requests", "past", "cancelled"];
const isTab = (v: string | null): v is Tab => !!v && (TABS as string[]).includes(v);

export function BookingsView() {
  const me = useSession();
  const params = useSearchParams();
  const now = useNow(30_000);
  const tz = useViewerTimezone();
  const bookings = useMyBookings();
  const peopleFor = usePeople();

  const urlTab = params.get("tab");
  const [tab, setTab] = React.useState<Tab>(isTab(urlTab) ? urlTab : "upcoming");
  const [prevUrlTab, setPrevUrlTab] = React.useState(urlTab);
  if (urlTab !== prevUrlTab) {
    setPrevUrlTab(urlTab);
    if (isTab(urlTab)) setTab(urlTab);
  }
  const [query, setQuery] = React.useState(params.get("q") ?? "");
  const [subject, setSubject] = React.useState("");

  const changeTab = (t: Tab) => {
    setTab(t);
    const next = new URLSearchParams(params.toString());
    if (t === "upcoming") next.delete("tab");
    else next.set("tab", t);
    const qs = next.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  };

  const subjects = React.useMemo(() => Array.from(new Set(bookings.map((b) => b.subject))).sort((a, b) => subjectName(a).localeCompare(subjectName(b))), [bookings]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookings.filter((b) => {
      if (subject && b.subject !== subject) return false;
      if (!q) return true;
      const p = peopleFor(b);
      return [subjectName(b.subject), p.counterpart, p.childName ?? "", p.tutor ? `${p.tutor.firstName} ${p.tutor.lastName}` : "", p.booker ? `${p.booker.firstName} ${p.booker.lastName}` : "", b.notes ?? ""]
        .some((s) => s.toLowerCase().includes(q));
    });
  }, [bookings, query, subject, peopleFor]);

  const lists = React.useMemo(() => {
    const byStartAsc = (a: Booking, b: Booking) => a.startUtc.localeCompare(b.startUtc);
    const byStartDesc = (a: Booking, b: Booking) => b.startUtc.localeCompare(a.startUtc);
    return {
      upcoming: filtered.filter((b) => bucketOf(b, now) === "upcoming").sort(byStartAsc),
      requests: filtered.filter((b) => isOpenRequest(b, now)).sort(byStartAsc),
      past: filtered.filter((b) => bucketOf(b, now) === "past").sort(byStartDesc),
      cancelled: filtered.filter((b) => bucketOf(b, now) === "cancelled").sort(byStartDesc),
    } satisfies Record<Tab, Booking[]>;
  }, [filtered, now]);

  if (!me) return null;
  const kind = viewerKind(me);
  const openRequests = bookings.filter((b) => isOpenRequest(b, now)).length;
  const failedPayments = bookings.filter((b) => b.status === "payment_failed" && bucketOf(b, now) === "upcoming").length;
  const filtering = !!query.trim() || !!subject;
  const clearFilters = () => {
    setQuery("");
    setSubject("");
  };

  return (
    <div>
      <PageHeader
        title="Bookings"
        description={kind === "tutor" ? "Requests, upcoming lessons and your teaching history — all times in your time zone." : "Your lessons, requests and history. Times are shown in your time zone."}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/dashboard/calendar">
                <CalendarDays /> Calendar
              </Link>
            </Button>
            {kind === "tutor" ? (
              <Button asChild>
                <Link href="/dashboard/availability">
                  <Clock /> Availability
                </Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/tutors">
                  <Search /> Find a tutor
                </Link>
              </Button>
            )}
          </>
        }
      />

      <AnimatePresence initial={false}>
        {kind === "tutor" && openRequests > 0 && tab !== "requests" && (
          <motion.div key="req-alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
            <InlineAlert
              className="mb-5"
              title={`${pluralize(openRequests, "booking request")} waiting for your response`}
              action={<Button size="sm" variant="outline" onClick={() => changeTab("requests")}>Review</Button>}
            >
              Families see your response time on your profile. Requests expire when the lesson time passes.
            </InlineAlert>
          </motion.div>
        )}
        {kind === "learner" && failedPayments > 0 && (
          <motion.div key="pay-alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
            <InlineAlert tone="danger" className="mb-5" title={`Payment failed for ${pluralize(failedPayments, "lesson")}`}>
              Open the lesson and choose Retry payment to keep your spot.
            </InlineAlert>
          </motion.div>
        )}
      </AnimatePresence>

      <Tabs value={tab} onValueChange={(v) => changeTab(v as Tab)}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
          <TabsList aria-label="Booking lists" className="lg:flex-1">
            <TabsTrigger value="upcoming" count={lists.upcoming.length}>Upcoming</TabsTrigger>
            <TabsTrigger value="requests" count={lists.requests.length}>Requests</TabsTrigger>
            <TabsTrigger value="past" count={lists.past.length}>Past</TabsTrigger>
            <TabsTrigger value="cancelled" count={lists.cancelled.length}>Cancelled</TabsTrigger>
          </TabsList>
          <div className="flex gap-2 pb-2 lg:pb-1.5">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={kind === "tutor" ? "Search student or subject" : "Search tutor or subject"}
              aria-label="Search bookings"
              icon={<Search />}
              suffix={
                query ? (
                  <button type="button" onClick={() => setQuery("")} className="grid size-7 place-items-center rounded-md hover:bg-sunken hover:text-ink" aria-label="Clear search">
                    <X className="size-3.5" />
                  </button>
                ) : undefined
              }
              className="min-w-0 flex-1 lg:w-64"
            />
            <Select
              aria-label="Filter by subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="All subjects"
              options={subjects.map((s) => ({ value: s, label: subjectName(s) }))}
              className="w-36 shrink-0 sm:w-44"
            />
          </div>
        </div>

        {TABS.map((t) => (
          <TabsContent key={t} value={t} className="pt-5">
            {lists[t].length ? (
              <BookingList items={lists[t]} tab={t} now={now} tz={tz} peopleFor={peopleFor} me={me} />
            ) : filtering ? (
              <div className="rounded-xl border border-dashed border-line-strong bg-surface">
                <EmptyState
                  compact
                  icon={<Search />}
                  title="No lessons match your filters"
                  description={query.trim() ? `Nothing in ${TAB_LABEL[t].toLowerCase()} matches “${query.trim()}”${subject ? ` in ${subjectName(subject)}` : ""}.` : `No ${subjectName(subject)} lessons in ${TAB_LABEL[t].toLowerCase()}.`}
                  action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}
                />
              </div>
            ) : (
              <TabEmpty tab={t} kind={kind} onShowUpcoming={() => changeTab("upcoming")} />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

const TAB_LABEL: Record<Tab, string> = { upcoming: "Upcoming", requests: "Requests", past: "Past", cancelled: "Cancelled" };

function BookingList({
  items,
  tab,
  now,
  tz,
  peopleFor,
  me,
}: {
  items: Booking[];
  tab: Tab;
  now: number;
  tz: string;
  peopleFor: ReturnType<typeof usePeople>;
  me: NonNullable<ReturnType<typeof useSession>>;
}) {
  return (
    <motion.ul className="space-y-2.5" aria-label={`${TAB_LABEL[tab]} lessons`}>
      <AnimatePresence initial={true} mode="popLayout">
        {items.map((b, i) => (
          <motion.li
            key={b.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE, delay: Math.min(i, 10) * 0.035 } }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.18 } }}
          >
            <BookingRow booking={b} people={peopleFor(b)} actor={actorFor(me, b)} now={now} tz={tz} />
          </motion.li>
        ))}
      </AnimatePresence>
    </motion.ul>
  );
}

function TabEmpty({ tab, kind, onShowUpcoming }: { tab: Tab; kind: "learner" | "tutor"; onShowUpcoming: () => void }) {
  const wrap = (node: React.ReactNode) => <div className="rounded-xl border border-dashed border-line-strong bg-surface">{node}</div>;
  if (tab === "upcoming")
    return wrap(
      kind === "tutor" ? (
        <EmptyState
          icon={<CalendarDays />}
          title="No upcoming lessons"
          description="Keep your availability current so families can book you, or apply to open student jobs."
          action={
            <>
              <Button asChild><Link href="/dashboard/availability">Update availability</Link></Button>
              <Button asChild variant="secondary"><Link href="/dashboard/jobs">Browse jobs</Link></Button>
            </>
          }
        />
      ) : (
        <EmptyState
          icon={<CalendarDays />}
          title="No upcoming lessons"
          description="Find a tutor and book a trial or regular lesson — it will show up here with a countdown and join link."
          action={
            <>
              <Button asChild><Link href="/tutors">Find a tutor</Link></Button>
              <Button asChild variant="secondary"><Link href="/post-requirement">Post a requirement</Link></Button>
            </>
          }
        />
      ),
    );
  if (tab === "requests")
    return wrap(
      kind === "tutor" ? (
        <EmptyState icon={<Inbox />} title="You're all caught up" description="New booking requests will appear here. Each one needs your response before the lesson time." action={<Button variant="secondary" onClick={onShowUpcoming}>View upcoming lessons</Button>} />
      ) : (
        <EmptyState icon={<Inbox />} title="No pending requests" description="When you request a lesson from a tutor who approves bookings manually, it waits here until they respond." action={<Button asChild variant="secondary"><Link href="/tutors">Find a tutor</Link></Button>} />
      ),
    );
  if (tab === "past")
    return wrap(
      <EmptyState
        icon={<CalendarCheck2 />}
        title="No past lessons yet"
        description={kind === "tutor" ? "Completed lessons, no-shows and disputes will be listed here." : "After your first lesson you'll be able to review it and see your tutor's notes here."}
        action={<Button variant="secondary" onClick={onShowUpcoming}>View upcoming lessons</Button>}
      />,
    );
  return wrap(<EmptyState icon={<CalendarX2 />} title="Nothing cancelled" description="Cancelled and rescheduled lessons will be listed here with their refund details." action={<Button variant="secondary" onClick={onShowUpcoming}><BookOpen /> View upcoming lessons</Button>} />);
}
