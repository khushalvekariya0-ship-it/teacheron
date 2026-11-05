"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, CalendarX2, Hourglass, Info, MapPin, MessagesSquare, PenLine, SearchX, Video } from "lucide-react";
import { JoinVideoButton, videoLabel } from "@/components/dashboard/bookings/LessonVideo";
import { videoMeetingId } from "@/lib/video-link";
import type { Booking, User } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useHydrated, useNow, useSession, useTutor, useViewerTimezone } from "@/lib/store/hooks";
import { endMs, startMs } from "@/lib/booking";
import { classWindow, EARLY_MINUTES } from "@/lib/classroom";
import { actorFor } from "@/lib/permissions";
import { subjectName } from "@/lib/data/catalog";
import { formatTime, formatWeekdayDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { DarkModeToggle } from "@/components/ui/DarkModeToggle";
import { Logo } from "@/components/ui/Logo";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Overlay";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, UnauthorizedState } from "@/components/ui/States";
import { ChatPanel, type ChatLine } from "./ChatPanel";
import { GuestJoin } from "./live/GuestJoin";
import { LiveClassroom, type ClassChat } from "./live/LiveClassroom";
import { VideoStage } from "./VideoStage";
import { Whiteboard } from "./Whiteboard";

/**
 * The in-app classroom: video on the left, the whiteboard and chat on the right — one screen,
 * no external meeting link. `/classroom/demo` is an open room for trying it; every other id is a
 * booking, open only to the people in that lesson.
 */
export function ClassroomView({ id, guestCode }: { id: string; guestCode?: string }) {
  const hydrated = useHydrated();
  if (!hydrated) {
    return (
      <div className="mesh-gradient grid h-dvh gap-3 p-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" role="status" aria-label="Opening the classroom">
        <Skeleton className="h-[36dvh] rounded-2xl lg:h-auto" />
        <Skeleton className="rounded-2xl" />
      </div>
    );
  }
  return id === "demo" ? <DemoRoom /> : <LessonRoom id={id} guestCode={guestCode} />;
}

/* ─── Demo room ─────────────────────────────────────────────────────────────── */

function DemoRoom() {
  const me = useSession();
  const tz = useViewerTimezone();
  const [lines, setLines] = React.useState<ChatLine[]>([]);
  return (
    <Room
      roomId="demo"
      title="Demo classroom"
      subtitle="Try the whiteboard, your camera and the chat"
      chip={<span className="rounded-full bg-brand-soft px-2.5 py-1 text-[12.5px] font-semibold text-brand">Demo</span>}
      peerName="Your tutor"
      selfName={me ? `${me.firstName} ${me.lastName}` : "You"}
      status="In a booked lesson, your tutor appears here"
      leaveHref="/"
      chat={{
        lines,
        onSend: (body) => {
          setLines((l) => [...l, { id: `demo-${l.length}`, mine: true, body, time: formatTime(new Date().toISOString(), tz) }]);
          return null;
        },
        note: "Try it out. In a booked lesson your messages go to your tutor and stay in your inbox.",
      }}
    />
  );
}

/* ─── A booked lesson ───────────────────────────────────────────────────────── */

function LessonRoom({ id, guestCode }: { id: string; guestCode?: string }) {
  const me = useSession();
  const bookings = useApp((s) => s.bookings);
  const booking = React.useMemo(() => bookings.find((b) => b.id === id), [bookings, id]);
  const now = useNow(15_000);

  if (!me) {
    if (guestCode) return <GuestJoin bookingId={id} code={guestCode} />;
    return (
      <Gate>
        <UnauthorizedState next={`/classroom/${id}`} />
      </Gate>
    );
  }
  const actor = booking ? actorFor(me, booking) : null;
  if ((!booking || !actor || actor === "system") && guestCode) return <GuestJoin bookingId={id} code={guestCode} />;
  if (!booking || !actor || actor === "system") {
    return (
      <Gate>
        <EmptyState
          icon={<SearchX />}
          title="We couldn't open this classroom"
          description="The link may be mistyped, or this lesson belongs to a different account."
          action={
            <Button asChild>
              <Link href="/dashboard/bookings">Go to your lessons</Link>
            </Button>
          }
        />
      </Gate>
    );
  }

  const lessonHref = `/dashboard/bookings/${booking.id}`;
  const lessonLink = (
    <Button asChild>
      <Link href={lessonHref}>View lesson details</Link>
    </Button>
  );
  if (booking.mode !== "online") {
    return (
      <Gate>
        <EmptyState icon={<MapPin />} title="This lesson is in person" description="The classroom is for online lessons. The meeting place is on the lesson page." action={lessonLink} />
      </Gate>
    );
  }
  if (booking.status === "pending") {
    return (
      <Gate>
        <EmptyState icon={<Hourglass />} title="Waiting for the tutor to accept" description="The classroom opens as soon as this lesson is confirmed." action={lessonLink} />
      </Gate>
    );
  }
  return <LessonGate booking={booking} me={me} actor={actor} lessonHref={lessonHref} lessonLink={lessonLink} now={now} />;
}

interface ClassInfo {
  ready: boolean;
  endedAt: string | null;
}

/**
 * With live video set up (LiveKit), a lesson opens the live classroom inside its window (15 minutes
 * before the start until 30 minutes after the end); before that, the page is for checking your camera,
 * and it switches to the live room by itself when it opens. A lesson the tutor runs on Zoom / Google
 * Meet keeps the classroom with the meeting's Join button (its video is there). Without live video set
 * up, the classroom works as before: your own camera, the whiteboard and the chat.
 */
function LessonGate({ booking, me, actor, lessonHref, lessonLink, now }: { booking: Booking; me: User; actor: "booker" | "tutor" | "admin"; lessonHref: string; lessonLink: React.ReactNode; now: number }) {
  const [info, setInfo] = React.useState<ClassInfo | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    void fetch(`/api/classroom/info?id=${encodeURIComponent(booking.id)}`)
      .then((r) => r.json())
      .then((d: Partial<ClassInfo> & { ok?: boolean }) => !cancelled && setInfo({ ready: !!d.ready && d.ok !== false, endedAt: d.endedAt ?? null }))
      .catch(() => !cancelled && setInfo({ ready: false, endedAt: null }));
    return () => {
      cancelled = true;
    };
  }, [booking.id]);

  const ended = (
    <Gate>
      <EmptyState
        icon={<CalendarX2 />}
        title={booking.status === "confirmed" || booking.status === "in_progress" || booking.status === "completed" ? "This lesson has ended" : "This lesson isn't taking place"}
        description="Notes, homework, shared whiteboards and the transcript are on the lesson page."
        action={lessonLink}
      />
    </Gate>
  );

  if (!info) {
    return (
      <div className="mesh-gradient grid h-dvh place-items-center" role="status" aria-label="Opening the classroom">
        <Skeleton className="h-40 w-80" />
      </div>
    );
  }
  if (info.ready && !booking.videoLink) {
    const w = classWindow(booking, info.endedAt, now);
    if (w.state === "upcoming") {
      // More than a day away there's nothing to set up yet.
      if (w.opensAt - now > 24 * 3600_000) {
        return (
          <Gate>
            <EmptyState icon={<CalendarClock />} title="The classroom isn't open yet" description={`It opens ${EARLY_MINUTES} minutes before the lesson. ${w.label}.`} action={lessonLink} />
          </Gate>
        );
      }
      return <ActiveLesson booking={booking} me={me} actor={actor} leaveHref={lessonHref} started={false} liveOpensAt={w.opensAt} />;
    }
    if (!w.canJoin) return ended;
    return <LiveLesson booking={booking} me={me} actor={actor} lessonHref={lessonHref} />;
  }
  if ((booking.status !== "confirmed" && booking.status !== "in_progress") || endMs(booking) <= now) return ended;
  return <ActiveLesson booking={booking} me={me} actor={actor} leaveHref={lessonHref} started={startMs(booking) <= now} />;
}

function LiveLesson({ booking, me, actor, lessonHref }: { booking: Booking; me: User; actor: "booker" | "tutor" | "admin"; lessonHref: string }) {
  const router = useRouter();
  const tz = useViewerTimezone();
  const refresh = useApp((s) => s.refresh);
  const chat = useLessonChat(booking, me, actor);
  const tutor = useTutor(booking.tutorId);
  const title = `${subjectName(booking.subject)} with ${actor === "tutor" ? chat.peerName : (tutor?.firstName ?? "your tutor")} · ${formatTime(booking.startUtc, tz)}`;
  return <LiveClassroom bookingId={booking.id} title={title} chat={chat} onRefresh={() => void refresh()} onLeave={() => router.push(lessonHref)} />;
}

/** The lesson's chat is the family's existing conversation with the tutor (moderated and kept in the inbox). */
function useLessonChat(booking: Booking, me: User, actor: "booker" | "tutor" | "admin"): ClassChat {
  const tz = useViewerTimezone();
  const tutor = useTutor(booking.tutorId);
  const users = useApp((s) => s.users);
  const conversations = useApp((s) => s.conversations);
  const messages = useApp((s) => s.messages);
  const sendMessage = useApp((s) => s.sendMessage);
  const startConversation = useApp((s) => s.startConversation);
  const markConversationRead = useApp((s) => s.markConversationRead);

  const tutorName = tutor ? `${tutor.firstName} ${tutor.lastName}` : "Your tutor";
  const booker = users.find((u) => u.id === booking.bookerId);
  const bookerName = booker ? `${booker.firstName} ${booker.lastName.charAt(0)}.` : "Your student";
  const peerName = actor === "tutor" ? bookerName : tutorName;

  const conversation = React.useMemo(() => {
    const between = conversations.filter((c) => c.tutorId === booking.tutorId && c.userId === booking.bookerId);
    return between.find((c) => (c.childId ?? null) === (booking.childId ?? null)) ?? between[0];
  }, [conversations, booking.tutorId, booking.bookerId, booking.childId]);
  const conversationId = conversation?.id;
  const lines = React.useMemo<ChatLine[]>(
    () =>
      conversationId
        ? messages
            .filter((m) => m.conversationId === conversationId)
            .map((m) => ({ id: m.id, mine: m.senderId === me.id || (!!me.tutorId && m.senderId === me.tutorId), body: m.body, time: formatTime(m.createdAt, tz) }))
        : [],
    [messages, conversationId, me.id, me.tutorId, tz],
  );
  React.useEffect(() => {
    if (conversationId && actor !== "admin") markConversationRead(conversationId);
  }, [conversationId, actor, lines.length, markConversationRead]);

  const onSend = async (body: string): Promise<string | null> => {
    let target = conversationId;
    if (!target) {
      if (actor !== "booker") return "The chat opens once the student has sent a first message.";
      const started = await startConversation(booking.tutorId, { childId: booking.childId, subject: booking.subject });
      if (!started.ok) return started.error;
      target = started.data.id;
    }
    const sent = await sendMessage(target, body);
    return sent.ok ? null : sent.error;
  };
  return {
    lines,
    onSend,
    peerName,
    disabledReason: actor === "admin" ? "Staff can view a classroom but can't post in its chat." : undefined,
    note: `Messages here are saved to your conversation with ${peerName.split(" ")[0]}.`,
  };
}

function ActiveLesson({ booking, me, actor, leaveHref, started, liveOpensAt }: { booking: Booking; me: User; actor: "booker" | "tutor" | "admin"; leaveHref: string; started: boolean; liveOpensAt?: number }) {
  const tz = useViewerTimezone();
  const tutor = useTutor(booking.tutorId);
  const chat = useLessonChat(booking, me, actor);
  const peerName = chat.peerName;

  return (
    <Room
      roomId={booking.id}
      title={`${subjectName(booking.subject)} with ${actor === "tutor" ? peerName : (tutor?.firstName ?? "your tutor")}`}
      subtitle={`${formatWeekdayDate(booking.startUtc, tz)} · ${formatTime(booking.startUtc, tz)}`}
      chip={<LessonClock start={startMs(booking)} end={endMs(booking)} />}
      peerName={peerName}
      selfName={`${me.firstName} ${me.lastName}`}
      status={
        liveOpensAt
          ? `The live classroom opens at ${formatTime(new Date(liveOpensAt).toISOString(), tz)}. Check your camera meanwhile: this page switches over by itself.`
          : started
            ? `Waiting for ${peerName.split(" ")[0]} to join`
            : `The lesson starts at ${formatTime(booking.startUtc, tz)}. You can set up now.`
      }
      liveSoon={!!liveOpensAt}
      leaveHref={leaveHref}
      video={booking.videoLink ? booking : undefined}
      chat={chat}
    />
  );
}

/** "Starts in 2h 05m" before the lesson, then a live countdown to the end. Ticks on its own so the room doesn't re-render every second. */
function LessonClock({ start, end }: { start: number; end: number }) {
  const now = useNow(1000);
  const live = now >= start;
  const s = Math.max(0, Math.floor(((live ? end : start) - now) / 1000));
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const two = (n: number) => String(n).padStart(2, "0");
  const left = d ? `${d}d ${h}h` : h ? `${h}h ${two(m)}m` : `${two(m)}:${two(s % 60)}`;
  return (
    <span role="timer" className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold tabular-nums", live ? "bg-live-soft text-live-ink" : "bg-sunken text-ink-2")}>
      {live && <span className="live-dot" aria-hidden />}
      {live ? `Live · ${left} left` : `Starts in ${left}`}
    </span>
  );
}

/** The lesson runs on the tutor's Zoom / Google Meet: join there; the whiteboard and chat stay here. */
function VideoMeetingBanner({ booking }: { booking: Booking }) {
  const label = videoLabel(booking);
  const meetingId = videoMeetingId(booking.videoLink);
  return (
    <section aria-label={`${label} meeting`} className="shrink-0 rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
          <Video className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold tracking-tight text-ink">This lesson is on {label}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-muted">
            Join the {label} meeting for video. The whiteboard and chat stay here.
            {meetingId && <> Meeting ID <span className="font-mono text-ink-2">{meetingId}</span>.</>}
            {booking.videoPasscode && <> Passcode <span className="font-mono text-ink-2">{booking.videoPasscode}</span>.</>}
          </p>
        </div>
      </div>
      <JoinVideoButton booking={booking} variant="cta" block className="mt-3" label={`Join ${label} meeting`} />
    </section>
  );
}

/* ─── Room shell ────────────────────────────────────────────────────────────── */

function Gate({ children }: { children: React.ReactNode }) {
  return (
    <div className="mesh-gradient flex min-h-dvh flex-col">
      <header className="flex h-16 items-center px-4 sm:px-6">
        <Logo />
      </header>
      <main id="main" className="grid flex-1 place-items-center px-4 pb-16">
        <div className="glass-card w-full max-w-lg rounded-3xl">{children}</div>
      </main>
    </div>
  );
}

function Room({
  roomId,
  title,
  subtitle,
  chip,
  peerName,
  selfName,
  status,
  leaveHref,
  chat,
  video,
  liveSoon,
}: {
  roomId: string;
  title: string;
  subtitle: string;
  chip: React.ReactNode;
  peerName: string;
  selfName: string;
  status: string;
  leaveHref: string;
  chat: { lines: ChatLine[]; onSend: (body: string) => string | null | Promise<string | null>; disabledReason?: string; note: string };
  /** A lesson that runs on the tutor's Zoom / Google Meet. */
  video?: Booking;
  /** Live video is set up and this lesson's live room opens soon. */
  liveSoon?: boolean;
}) {
  const [panel, setPanel] = React.useState<"board" | "chat">("board");
  return (
    <div className="mesh-gradient flex h-dvh flex-col overflow-hidden">
      <header className="glass z-10 flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-3 sm:gap-3 sm:px-4">
        <Link href={leaveHref} aria-label="Leave the classroom" className="grid size-9 shrink-0 place-items-center rounded-full border border-line-strong text-ink transition-colors hover:bg-sunken">
          <ArrowLeft className="size-[18px]" />
        </Link>
        <Logo compact className="hidden sm:inline-flex" />
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-semibold leading-tight tracking-[-0.01em] text-ink">{title}</h1>
          <p className="truncate text-[12.5px] leading-tight text-muted">{subtitle}</p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {chip}
          <Popover>
            <PopoverTrigger aria-label="About the classroom" className="grid size-9 place-items-center rounded-full border border-line-strong text-ink transition-colors hover:bg-sunken">
              <Info className="size-[18px]" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-4 text-[13.5px] leading-relaxed text-ink-2">
              <p className="font-semibold text-ink">What works today</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>Your camera, microphone and screen share</li>
                <li>The whiteboard — saved on this device, and live between your own windows</li>
                <li>Chat, saved to your inbox</li>
              </ul>
              {liveSoon ? (
                <p className="mt-3">
                  When the live classroom opens ({EARLY_MINUTES} minutes before the lesson), you see and hear each other, share screens and use one whiteboard together.
                </p>
              ) : (
                <>
                  <p className="mt-3 font-semibold text-ink">Not connected yet (needs a video service)</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    <li>Seeing and hearing the other person</li>
                    <li>One board shared between two devices</li>
                  </ul>
                </>
              )}
            </PopoverContent>
          </Popover>
          <DarkModeToggle className="size-9" />
        </div>
      </header>

      <main id="main" className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] gap-3 p-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-1">
        <div className="flex min-h-0 flex-col gap-3">
          {video && <VideoMeetingBanner booking={video} />}
          <VideoStage peerName={peerName} selfName={selfName} status={status} leaveHref={leaveHref} className={cn("h-[36dvh] lg:h-auto lg:min-h-0 lg:flex-1", video && "hidden lg:flex")} />
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
          {/* Below 1280px the board and the chat share the panel; above it they sit side by side. */}
          <div role="tablist" aria-label="Classroom panel" className="flex shrink-0 gap-1 border-b border-line p-1.5 xl:hidden">
            {(
              [
                { key: "board", label: "Whiteboard", icon: PenLine },
                { key: "chat", label: `Chat${chat.lines.length ? ` · ${chat.lines.length}` : ""}`, icon: MessagesSquare },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={panel === t.key}
                onClick={() => setPanel(t.key)}
                className={cn("flex h-9 flex-1 items-center justify-center gap-2 rounded-lg text-[13.5px] font-semibold transition-colors", panel === t.key ? "bg-sunken text-ink" : "text-muted hover:text-ink")}
              >
                <t.icon className="size-4" aria-hidden /> {t.label}
              </button>
            ))}
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_20rem]">
            <Whiteboard roomId={roomId} className={cn(panel === "board" ? "flex" : "hidden", "xl:flex")} />
            <ChatPanel
              lines={chat.lines}
              onSend={chat.onSend}
              disabledReason={chat.disabledReason}
              peerName={peerName}
              note={chat.note}
              className={cn(panel === "chat" ? "flex" : "hidden", "xl:flex xl:border-l xl:border-line")}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
