"use client";

import * as React from "react";
import { FileText, ImageIcon, Sparkles, Trash2 } from "lucide-react";
import type { Booking } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { useViewerTimezone } from "@/lib/store/hooks";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { GuestLinkBox } from "@/components/classroom/live/LiveClassroom";

interface Info {
  ready: boolean;
  isHost: boolean;
  hasRecap: boolean;
  boards: number;
  window: { state: "upcoming" | "open" | "ended" | "closed" };
}
interface Board {
  id: string;
  title: string;
  sharedBy: string;
  createdAt: string;
  url: string;
}
interface Recap {
  transcript: string | null;
  summary: string | null;
  summaryAt: string | null;
  snapshots: { title: string; at: string; url: string }[];
  aiRecap: boolean;
}

/**
 * What the live classroom left on the lesson page: whiteboards the tutor shared, the caption transcript
 * with snapshots (and an AI recap when that's switched on), and for the tutor the guest link.
 */
export function LessonClassroomCard({ booking }: { booking: Booking }) {
  const tz = useViewerTimezone();
  const [info, setInfo] = React.useState<Info | null>(null);
  const [boards, setBoards] = React.useState<Board[]>([]);
  const [recap, setRecap] = React.useState<Recap | null>(null);
  const [showTranscript, setShowTranscript] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [reload, setReload] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/classroom/info?id=${encodeURIComponent(booking.id)}`);
        if (!res.ok) return;
        const i = (await res.json()) as Info;
        if (cancelled) return;
        setInfo(i);
        const [b, r] = await Promise.all([
          i.boards ? fetch(`/api/classroom/boards?id=${encodeURIComponent(booking.id)}`).then((x) => x.json() as Promise<{ boards?: Board[] }>) : Promise.resolve({ boards: [] as Board[] }),
          i.hasRecap ? fetch(`/api/classroom/recap?id=${encodeURIComponent(booking.id)}`).then((x) => x.json() as Promise<{ recap?: Recap }>) : Promise.resolve({ recap: undefined }),
        ]);
        if (cancelled) return;
        setBoards(b.boards ?? []);
        setRecap(r.recap ?? null);
      } catch {
        // the card simply stays hidden
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [booking.id, reload]);

  const post = async (op: string, body: Record<string, unknown>) => {
    setError(null);
    const res = await fetch(`/api/classroom/${op}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: booking.id, ...body }) });
    if (!res.ok) setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Something went wrong.");
    setReload((n) => n + 1);
  };

  if (!info) return null;
  const hasContent = boards.length > 0 || !!recap?.transcript || !!recap?.summary || (recap?.snapshots.length ?? 0) > 0;
  const showGuest = info.ready && info.isHost && (info.window.state === "open" || info.window.state === "upcoming");
  if (!hasContent && !showGuest) return null;

  return (
    <Card>
      <CardHeader title="From the classroom" description={hasContent ? "Kept from the live lesson. Contact details are hidden." : "Invite someone without an account to this lesson."} />
      <CardContent className="space-y-5">
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        {showGuest && <GuestLinkBox bookingId={booking.id} />}

        {boards.length > 0 && (
          <section aria-label="Shared whiteboards">
            <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
              <ImageIcon className="size-4 text-brand" aria-hidden /> Whiteboards shared with you
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {boards.map((b) => (
                <div key={b.id} className="border border-line">
                  <a href={b.url} target="_blank" rel="noopener noreferrer" className="block bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed link to a private file */}
                    <img src={b.url} alt={b.title} className="h-36 w-full object-contain" />
                  </a>
                  <div className="flex items-start gap-2 p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold text-ink">{b.title}</p>
                      <p className="text-[12px] text-muted">
                        {b.sharedBy} · {formatDateTime(b.createdAt, tz)}
                      </p>
                    </div>
                    {info.isHost && (
                      <Button size="sm" variant="ghost" aria-label={`Remove ${b.title}`} onClick={() => void post("delete-board", { boardId: b.id })}>
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {recap && (recap.summary || recap.transcript || recap.snapshots.length > 0) && (
          <section aria-label="Lesson recap" className="space-y-3">
            {recap.summary && (
              <div className="border border-line bg-canvas p-3">
                <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                  <Sparkles className="size-4 text-brand" aria-hidden /> AI recap
                </p>
                <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-2">{recap.summary}</p>
              </div>
            )}
            {recap.transcript && (
              <div>
                <button type="button" onClick={() => setShowTranscript((v) => !v)} className="flex items-center gap-1.5 text-[13px] font-semibold text-ink underline underline-offset-4">
                  <FileText className="size-4 text-brand" aria-hidden /> {showTranscript ? "Hide the transcript" : "Show the transcript"}
                </button>
                {showTranscript && <pre className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap border border-line bg-canvas p-3 font-sans text-[13px] leading-relaxed text-ink-2">{recap.transcript}</pre>}
                {!recap.summary && <p className="mt-1 text-[12px] text-muted">{recap.aiRecap ? "The AI recap is being written. Check back in a minute." : "AI recaps aren't switched on."}</p>}
              </div>
            )}
            {recap.snapshots.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {recap.snapshots.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="block border border-line bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed link to a private file */}
                    <img src={s.url} alt={`${s.title} at ${s.at}`} className="h-24 w-full object-contain" />
                    <span className="block truncate px-1.5 py-1 text-[11px] text-muted">
                      {s.title} · {s.at}
                    </span>
                  </a>
                ))}
              </div>
            )}
            {info.isHost && (
              <Button size="sm" variant="ghost" onClick={() => void post("delete-recap", {})}>
                <Trash2 /> Delete the transcript and snapshots
              </Button>
            )}
          </section>
        )}
      </CardContent>
    </Card>
  );
}
