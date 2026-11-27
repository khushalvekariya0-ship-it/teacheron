"use client";

import * as React from "react";
import { FileText, Link2, MessagesSquare, Paperclip, SendHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContactHint } from "@/components/domain/ContactHint";
import { FileLink } from "@/components/domain/FileLink";

export interface ChatLine {
  id: string;
  mine: boolean;
  body: string;
  /** Short time label, already in the viewer's time zone. */
  time: string;
  /** A shared file (opens through /api/files once it passed the contact check). */
  attachment?: { name: string; sizeKb: number; path?: string };
}

/** The same files as the inbox: worksheets, pictures and documents. */
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.docx,.txt";
const sizeLabel = (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);

// Web addresses in a message (http/https, or starting with www.): shown as links that open in a new tab.
const URL_IN_TEXT = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;

/** A message's text with its web addresses as links (only http and https ever become links). */
export function Linked({ text, className }: { text: string; className?: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_IN_TEXT)) {
    // Punctuation after an address ends the sentence, not the address.
    const raw = m[0].replace(/[.,;:!?)\]}]+$/, "");
    const start = m.index ?? 0;
    if (!raw) continue;
    const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    let ok = false;
    try {
      ok = ["http:", "https:"].includes(new URL(href).protocol);
    } catch {
      ok = false;
    }
    if (!ok) continue;
    parts.push(text.slice(last, start));
    parts.push(
      <a key={start} href={href} target="_blank" rel="noopener noreferrer nofollow ugc" className={cn("break-all underline underline-offset-2", className)}>
        {raw}
      </a>,
    );
    last = start + raw.length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}

/** What someone typed as a link, as a full web address (https added when it's missing), or null. */
function readLink(input: string): string | null {
  const t = input.trim();
  if (!t || /\s/.test(t)) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`);
    if (!["http:", "https:"].includes(u.protocol) || !u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Live chat beside the whiteboard. In a booked lesson these are the same messages as the
 * tutor–family conversation in the inbox, so nothing said in class is lost afterwards.
 * Files and links can be shared too; both are checked for contact details like any message.
 */
export function ChatPanel({
  lines,
  onSend,
  disabledReason,
  peerName,
  note,
  className,
}: {
  lines: ChatLine[];
  /** Returns an error message when the message (or file) couldn't be sent. */
  onSend: (body: string, file?: File) => string | null | Promise<string | null>;
  /** When set, the composer is replaced by this explanation. */
  disabledReason?: string;
  peerName: string;
  note: string;
  className?: string;
}) {
  const [draft, setDraft] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [link, setLink] = React.useState("");
  const [linkNote, setLinkNote] = React.useState("");
  const [linkError, setLinkError] = React.useState<string | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Keep the newest message in view.
  React.useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if ((!body && !file) || busy) return;
    setBusy(true);
    const err = await onSend(body, file ?? undefined);
    setBusy(false);
    setError(err);
    if (!err) {
      setDraft("");
      setFile(null);
    } else if (/^This file/.test(err)) setFile(null);
  };

  const shareLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = readLink(link);
    if (!url) return setLinkError("Paste a full web address, like https://www.youtube.com/…");
    if (busy) return;
    setBusy(true);
    const about = linkNote.trim();
    const err = await onSend(about ? `${about}\n${url}` : url);
    setBusy(false);
    if (err) return setLinkError(err);
    setLink("");
    setLinkNote("");
    setLinkError(null);
    setLinkOpen(false);
  };

  return (
    <section aria-label="Chat" className={cn("flex min-h-0 flex-col bg-surface", className)}>
      <h3 className="hidden shrink-0 items-center gap-2 border-b border-line px-4 py-3 text-sm font-semibold text-ink xl:flex">
        <MessagesSquare className="size-4 text-muted" aria-hidden /> Chat
      </h3>
      <div ref={listRef} data-lenis-prevent className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-4" role="log" aria-live="polite">
        {lines.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <MessagesSquare className="size-6 text-subtle" aria-hidden />
            <p className="mt-2.5 text-sm font-medium text-ink">No messages yet</p>
            <p className="mt-1 max-w-[15rem] text-[13px] leading-snug text-muted">{note}</p>
          </div>
        ) : (
          lines.map((l) => (
            <div key={l.id} className={cn("flex flex-col", l.mine ? "items-end" : "items-start")}>
              <div className={cn("max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[14px] leading-snug", l.mine ? "rounded-br-md bg-brand text-on-brand" : "rounded-bl-md bg-sunken text-ink")}>
                {l.body && <Linked text={l.body} />}
                {l.attachment && (
                  <span className={cn("flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12.5px]", l.body && "mt-2", l.mine ? "border-white/25 bg-white/10" : "border-line bg-surface text-ink-2")} data-chat-file="">
                    <FileText className="size-4 shrink-0 opacity-80" aria-hidden />
                    <FileLink path={l.attachment.path} className="min-w-0 truncate font-medium">
                      {l.attachment.name}
                    </FileLink>
                    <span className="shrink-0 opacity-70">{sizeLabel(l.attachment.sizeKb)}</span>
                  </span>
                )}
              </div>
              <span className="mt-1 px-1 text-[11px] text-muted">
                {l.mine ? "You" : peerName} · {l.time}
              </span>
            </div>
          ))
        )}
      </div>

      {disabledReason ? (
        <p className="shrink-0 border-t border-line px-4 py-3 text-[13px] leading-snug text-muted">{disabledReason}</p>
      ) : (
        <div className="shrink-0 border-t border-line p-3">
          {linkOpen && (
            <form onSubmit={shareLink} className="mb-2.5 space-y-1.5 rounded-xl border border-line bg-canvas p-2.5" data-chat-link-form="">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] font-semibold text-ink">Share a link</span>
                <button type="button" onClick={() => setLinkOpen(false)} className="grid size-6 place-items-center rounded-md text-muted hover:bg-sunken" aria-label="Close">
                  <X className="size-3.5" />
                </button>
              </div>
              <input
                value={link}
                onChange={(e) => {
                  setLink(e.target.value);
                  setLinkError(null);
                }}
                placeholder="https://…"
                inputMode="url"
                aria-label="Web address"
                autoFocus
                className="w-full rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-[13.5px] text-ink outline-none focus:border-brand"
              />
              <input
                value={linkNote}
                onChange={(e) => setLinkNote(e.target.value)}
                maxLength={200}
                placeholder="What is it? (optional)"
                aria-label="What the link is"
                className="w-full rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-[13.5px] text-ink outline-none focus:border-brand"
              />
              {linkError ? (
                <p role="alert" className="text-[12px] text-danger">
                  {linkError}
                </p>
              ) : (
                <p className="text-[11.5px] leading-snug text-muted">Learning links (a video, an article, an exercise) are fine. Links to messaging apps, social media or file-sharing sites can&apos;t be shared.</p>
              )}
              <button type="submit" disabled={busy || !link.trim()} className="w-full rounded-lg bg-cta px-3 py-1.5 text-[13px] font-semibold text-on-cta hover:bg-cta-hover disabled:opacity-50">
                {busy ? "Sharing…" : "Share link"}
              </button>
            </form>
          )}
          <form onSubmit={submit}>
            {error && (
              <p role="alert" className="mb-2 px-1 text-[13px] text-danger">
                {error}
              </p>
            )}
            {!error && <ContactHint text={draft} />}
            {file && (
              <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-lg border border-line bg-canvas py-1 pl-2.5 pr-1 text-[12.5px] text-ink-2" data-chat-picked="">
                <FileText className="size-4 shrink-0 text-muted" aria-hidden />
                <span className="truncate font-medium">{file.name}</span>
                <span className="shrink-0 text-muted">{sizeLabel(Math.max(1, Math.round(file.size / 1024)))}</span>
                <button type="button" disabled={busy} onClick={() => setFile(null)} className="grid size-6 shrink-0 place-items-center rounded-md hover:bg-sunken disabled:opacity-50" aria-label={`Remove ${file.name}`}>
                  <X className="size-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-end gap-1.5">
              <input
                ref={fileRef}
                type="file"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                accept={ACCEPT}
                data-chat-file-input=""
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFile(f);
                    setError(null);
                  }
                  e.target.value = "";
                }}
              />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} aria-label="Share a file" title="Share a file (PDF, picture, Word or text)" className="grid size-9 shrink-0 place-items-center self-center rounded-full text-muted transition-colors hover:bg-sunken hover:text-ink disabled:opacity-50">
                <Paperclip className="size-[18px]" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setLinkOpen((v) => !v);
                  setLinkError(null);
                }}
                disabled={busy}
                aria-label="Share a link"
                aria-expanded={linkOpen}
                title="Share a link"
                className={cn("grid size-9 shrink-0 place-items-center self-center rounded-full transition-colors hover:bg-sunken hover:text-ink disabled:opacity-50", linkOpen ? "bg-sunken text-ink" : "text-muted")}
              >
                <Link2 className="size-[18px]" />
              </button>
              <label htmlFor="classroom-chat" className="sr-only">
                Message {peerName}
              </label>
              <textarea
                id="classroom-chat"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                rows={1}
                maxLength={4000}
                placeholder={file ? "Add a note (optional)…" : "Type a message…"}
                className="max-h-28 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-line-strong bg-surface px-3.5 py-2.5 text-[14.5px] text-ink outline-none transition-colors placeholder:text-subtle focus:border-brand"
              />
              <button
                type="submit"
                disabled={(!draft.trim() && !file) || busy}
                aria-label="Send message"
                className="grid size-11 shrink-0 place-items-center rounded-full bg-cta text-on-cta transition-colors hover:bg-cta-hover disabled:pointer-events-none disabled:opacity-40"
              >
                <SendHorizontal className="size-[18px]" />
              </button>
            </div>
            {busy && file && (
              <p role="status" className="mt-1.5 px-1 text-[12px] text-muted">
                Uploading and checking your file…
              </p>
            )}
          </form>
        </div>
      )}
    </section>
  );
}
