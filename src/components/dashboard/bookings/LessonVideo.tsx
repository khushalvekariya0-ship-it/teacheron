"use client";

import * as React from "react";
import { Check, Copy, Film, KeyRound, Link2, Pencil, Trash2, Video } from "lucide-react";
import type { Booking } from "@/lib/types";
import { endMs, startMs } from "@/lib/booking";
import { useApp } from "@/lib/store";
import { checkPasscode, MAX_PASSCODE, parseRecordingLink, parseVideoLink, VIDEO_PROVIDER_LABEL, videoMeetingId, videoProvider } from "@/lib/video-link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Controls";
import { ConfirmDialog, Dialog, DialogBody, DialogClose, DialogContent, DialogFooter } from "@/components/ui/Overlay";
import { toast } from "@/components/ui/Toast";

/*
 * Zoom / Google Meet for online lessons (like a "live class" link): the tutor makes the meeting in their
 * own Zoom, pastes the invite link (and passcode) here, and the student or parent gets a "Join Zoom"
 * button. Only the people in the lesson and staff who manage bookings ever receive the link.
 */

/** "Zoom" or "Google Meet" for a lesson's saved link. */
export const videoLabel = (b: Pick<Booking, "videoLink">) => VIDEO_PROVIDER_LABEL[videoProvider(b.videoLink) ?? "zoom"];

/** A Zoom / Meet link can be used from the moment the lesson is confirmed until it ends. */
export function videoJoinable(b: Booking, now: number): boolean {
  return !!b.videoLink && b.mode === "online" && (b.status === "confirmed" || b.status === "in_progress") && now < endMs(b);
}

const editable = (b: Booking, now: number) => b.mode === "online" && ["pending", "confirmed", "in_progress"].includes(b.status) && now < endMs(b);

/** Opens the lesson's Zoom / Meet meeting in a new tab. */
export function JoinVideoButton({
  booking,
  size,
  variant = "primary",
  block,
  className,
  label,
}: {
  booking: Booking;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "cta" | "secondary" | "outline";
  block?: boolean;
  className?: string;
  label?: string;
}) {
  if (!booking.videoLink) return null;
  return (
    <Button asChild size={size} variant={variant} className={cn(block && "w-full", className)}>
      <a href={booking.videoLink} target="_blank" rel="noopener noreferrer" data-video-join="">
        <Video /> {label ?? `Join ${videoLabel(booking)}`}
      </a>
    </Button>
  );
}

function CopyRow({ icon: Icon, label, value, mono }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-canvas text-muted">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted">{label}</p>
        <p className={cn("truncate text-sm font-medium text-ink", mono && "font-mono tracking-wide")}>{value}</p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        aria-label={`Copy ${label.toLowerCase()}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value.replace(/ /g, label === "Meeting ID" ? "" : " "));
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            toast.error("Couldn't copy. Select the text and copy it instead.");
          }
        }}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}

/** The lesson page's Zoom card: the meeting's details for everyone in the lesson; add / edit / remove for its tutor (and staff). */
export function LessonVideoCard({ booking: b, canManage, now, counterpart }: { booking: Booking; canManage: boolean; now: number; counterpart: string }) {
  const [dialog, setDialog] = React.useState<"link" | "remove" | "recording" | null>(null);
  const removeVideo = useApp((s) => s.removeLessonVideo);
  const [busy, setBusy] = React.useState(false);
  if (b.mode !== "online") return null;
  const canEdit = canManage && editable(b, now);
  const canRecord = canManage && startMs(b) <= now && ["in_progress", "completed", "confirmed", "disputed", "refunded"].includes(b.status);
  if (!b.videoLink && !b.recordingUrl && !canEdit && !canRecord) return null;
  const name = b.videoLink ? videoLabel(b) : "Zoom or Google Meet";
  const meetingId = videoMeetingId(b.videoLink);

  return (
    <Card>
      <CardHeader
        title={b.videoLink ? `${name} meeting` : "Teach on Zoom or Google Meet"}
        description={
          b.videoLink
            ? canManage
              ? `${counterpart} gets a Join button for this meeting.`
              : `Your tutor runs this lesson on ${name}.`
            : canEdit
              ? `Paste your meeting's invite link and ${counterpart} gets a Join button. Without one, the lesson uses the TutorLink classroom.`
              : undefined
        }
        action={
          canEdit && b.videoLink ? (
            <div className="flex gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => setDialog("link")}>
                <Pencil /> Edit
              </Button>
              <Button size="sm" variant="ghost" aria-label="Remove the meeting link" onClick={() => setDialog("remove")}>
                <Trash2 />
              </Button>
            </div>
          ) : undefined
        }
      />
      <CardContent className="space-y-4">
        {b.videoLink ? (
          <>
            <div className="space-y-3">
              {meetingId && <CopyRow icon={Video} label="Meeting ID" value={meetingId} mono />}
              {b.videoPasscode && <CopyRow icon={KeyRound} label="Passcode" value={b.videoPasscode} mono />}
              <CopyRow icon={Link2} label="Invite link" value={b.videoLink} />
            </div>
            {videoJoinable(b, now) ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <JoinVideoButton booking={b} variant="cta" size="lg" label={`Join ${name} meeting`} />
                <p className="text-[13px] leading-snug text-muted">Opens {name} in a new tab. Notes, homework and messages stay here.</p>
              </div>
            ) : b.status === "pending" ? (
              <p className="text-[13px] text-muted">The Join button works once the lesson is confirmed.</p>
            ) : now >= endMs(b) ? (
              <p className="text-[13px] text-muted">This lesson has ended.</p>
            ) : null}
          </>
        ) : (
          canEdit && (
            <Button variant="secondary" onClick={() => setDialog("link")}>
              <Video /> Add Zoom or Google Meet link
            </Button>
          )
        )}

        {(b.recordingUrl || canRecord) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <Film className="size-4 text-muted" aria-hidden />
            <span className="mr-auto text-sm font-medium text-ink">Recording</span>
            {b.recordingUrl && (
              <Button asChild size="sm" variant="outline">
                <a href={b.recordingUrl} target="_blank" rel="noopener noreferrer">
                  Watch the recording
                </a>
              </Button>
            )}
            {canRecord && (
              <Button size="sm" variant="ghost" onClick={() => setDialog("recording")}>
                {b.recordingUrl ? "Change" : "Add recording link"}
              </Button>
            )}
          </div>
        )}
      </CardContent>

      <VideoLinkDialog booking={b} open={dialog === "link"} onOpenChange={(o) => setDialog(o ? "link" : null)} canApplyToOthers={canManage} now={now} />
      <RecordingDialog booking={b} open={dialog === "recording"} onOpenChange={(o) => setDialog(o ? "recording" : null)} />
      <ConfirmDialog
        open={dialog === "remove"}
        onOpenChange={(o) => setDialog(o ? "remove" : null)}
        title={`Remove the ${name} link?`}
        description={`${counterpart} will be told, and the lesson goes back to the TutorLink classroom.`}
        confirmLabel="Remove link"
        tone="danger"
        loading={busy}
        onConfirm={async () => {
          setBusy(true);
          const r = await removeVideo(b.id);
          setBusy(false);
          if (!r.ok) return void toast.error(r.error);
          toast.success("Meeting link removed");
          setDialog(null);
        }}
      />
    </Card>
  );
}

/** Add or change the lesson's Zoom / Google Meet invite link and passcode. */
export function VideoLinkDialog({ booking: b, open, onOpenChange, canApplyToOthers, now }: { booking: Booking; open: boolean; onOpenChange: (o: boolean) => void; canApplyToOthers: boolean; now: number }) {
  const setVideo = useApp((s) => s.setLessonVideo);
  const me = useApp((s) => s.users.find((u) => u.id === s.sessionUserId));
  const bookings = useApp((s) => s.bookings);
  const [link, setLink] = React.useState(b.videoLink ?? "");
  const [passcode, setPasscode] = React.useState(b.videoPasscode ?? "");
  const [applyAll, setApplyAll] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setLink(b.videoLink ?? "");
      setPasscode(b.videoPasscode ?? "");
      setApplyAll(false);
      setError(null);
    }
  }
  // Only the lesson's own tutor can copy the link to their other lessons.
  const isTutor = !!me?.tutorId && me.tutorId === b.tutorId;
  const others = isTutor && canApplyToOthers ? bookings.filter((x) => x.id !== b.id && x.tutorId === b.tutorId && x.mode === "online" && !x.videoLink && (x.status === "pending" || x.status === "confirmed") && startMs(x) > now).length : 0;
  const parsed = link.trim() ? parseVideoLink(link) : null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const p = parseVideoLink(link);
    if (!p.ok) return setError(p.error);
    const pass = checkPasscode(passcode);
    if (!pass.ok) return setError(pass.error);
    setBusy(true);
    const r = await setVideo(b.id, { link: p.link.url, passcode: pass.passcode, applyToUpcoming: applyAll && others > 0 });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success(`${VIDEO_PROVIDER_LABEL[p.link.provider]} link saved`, { description: r.data.updated > 1 ? `Added to ${r.data.updated} lessons. Each family was notified.` : "The student or parent was notified." });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={b.videoLink ? "Change the meeting link" : "Add a Zoom or Google Meet link"} description="Create the meeting in your Zoom or Google Meet, then copy its invite link here.">
        <form onSubmit={save} noValidate>
          <DialogBody className="space-y-5">
            <Field label="Meeting invite link" error={error ?? undefined} hint={parsed?.ok ? `${VIDEO_PROVIDER_LABEL[parsed.link.provider]} meeting${parsed.link.meetingId ? ` · ${parsed.link.meetingId}` : ""}` : "In Zoom: Meetings → your meeting → Copy invitation link. Not your start link."}>
              <Input
                value={link}
                onChange={(e) => {
                  setLink(e.target.value);
                  setError(null);
                }}
                placeholder="https://zoom.us/j/85012345678?pwd=…"
                inputMode="url"
                autoComplete="off"
                icon={<Link2 />}
                autoFocus
              />
            </Field>
            <Field label="Passcode" optional hint={`Only if the meeting has one and it isn't in the link. Up to ${MAX_PASSCODE} characters.`}>
              <Input
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  setError(null);
                }}
                maxLength={MAX_PASSCODE}
                autoComplete="off"
                icon={<KeyRound />}
                className="font-mono"
              />
            </Field>
            {others > 0 && (
              <Checkbox
                checked={applyAll}
                onCheckedChange={(v) => setApplyAll(v === true)}
                label={`Also use this link for my ${others} other upcoming online ${others === 1 ? "lesson" : "lessons"} without one`}
              />
            )}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" loading={busy}>
              Save link
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Add, change or remove the link to the lesson's recording. */
function RecordingDialog({ booking: b, open, onOpenChange }: { booking: Booking; open: boolean; onOpenChange: (o: boolean) => void }) {
  const setRecording = useApp((s) => s.setLessonRecording);
  const [link, setLink] = React.useState(b.recordingUrl ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setLink(b.recordingUrl ?? "");
      setError(null);
    }
  }
  const submit = async (value: string) => {
    setError(null);
    if (value.trim()) {
      const p = parseRecordingLink(value);
      if (!p.ok) return setError(p.error);
      value = p.url;
    }
    setBusy(true);
    const r = await setRecording(b.id, value);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success(value ? "Recording link saved" : "Recording link removed");
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Lesson recording" description="Share a Zoom cloud recording or a Google Drive file so the student can watch it again.">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit(link);
          }}
        >
          <DialogBody>
            <Field label="Recording link" error={error ?? undefined}>
              <Input
                value={link}
                onChange={(e) => {
                  setLink(e.target.value);
                  setError(null);
                }}
                placeholder="https://zoom.us/rec/share/…"
                inputMode="url"
                autoComplete="off"
                icon={<Film />}
                autoFocus
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            {b.recordingUrl && (
              <Button type="button" variant="danger-outline" className="sm:mr-auto" loading={busy} onClick={() => void submit("")}>
                Remove
              </Button>
            )}
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" loading={busy}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
