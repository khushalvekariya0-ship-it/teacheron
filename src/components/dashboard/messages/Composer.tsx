"use client";

import * as React from "react";
import { FileText, Paperclip, Send, ShieldAlert, ShieldCheck, X } from "lucide-react";
import type { Message } from "@/lib/types";
import { useApp } from "@/lib/store";
import { AnimatePresence, EASE, motion } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { uploadFile } from "@/lib/upload";
import { formatSize } from "./shared";
import { ContactHint } from "@/components/domain/ContactHint";
import { toast } from "@/components/ui/Toast";
import { useSession } from "@/lib/store/hooks";
import { honestyReminder } from "@/lib/domain/respect";

const MAX_HEIGHT = 168;
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.docx,.txt";

type Picked = { name: string; sizeKb: number; file: File; uploaded?: NonNullable<Message["attachment"]> };

export function Composer({ conversationId, recipient, onSent }: { conversationId: string; recipient: string; onSent: (msg: Message, text: string) => void }) {
  const send = useApp((s) => s.sendMessage);
  const [text, setText] = React.useState("");
  const [file, setFile] = React.useState<Picked | null>(null);
  // `rude`: stopped for abusive words (no "ask for a review": that is for contact details).
  const [error, setError] = React.useState<{ message: string; blocked: boolean; rude?: boolean } | null>(null);
  const me = useSession();
  const appeal = useApp((s) => s.appealContactFlag);
  const [review, setReview] = React.useState<{ open: boolean; note: string; sent?: string; error?: string }>({ open: false, note: "" });
  const [step, setStep] = React.useState<"idle" | "uploading" | "checking" | "sending">("idle");
  const taRef = React.useRef<HTMLTextAreaElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const hintId = React.useId();
  const errorId = React.useId();
  const sending = step !== "idle";

  const autosize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  };

  const submit = async () => {
    if ((!text.trim() && !file) || sending) return;
    let attachment: Message["attachment"];
    if (file) {
      attachment = file.uploaded;
      if (!attachment) {
        // The file goes to private storage first; only people in this conversation can open it, once it passes the check.
        setStep("uploading");
        const up = await uploadFile("messages", file.file);
        if (!up.ok) {
          setStep("idle");
          return setError({ message: up.error, blocked: false });
        }
        attachment = { name: up.file.name, sizeKb: up.file.sizeKb, path: up.file.path };
        // Kept, so editing the text and sending again doesn't upload the file twice.
        const done = attachment;
        setFile((f) => (f && f.file === file.file ? { ...f, uploaded: done } : f));
      }
      setStep("checking");
    } else setStep("sending");
    const res = await send(conversationId, text, attachment);
    setStep("idle");
    if (!res.ok) {
      // A file that showed contact details was deleted on the server; it has to be chosen again.
      if (res.code === "contact_blocked" && /^This file/.test(res.error)) setFile(null);
      setError({ message: res.error, blocked: res.code === "contact_blocked" || res.code === "chat_paused" || res.code === "abusive_language", rude: res.code === "abusive_language" });
      taRef.current?.focus();
      return;
    }
    const sentText = text;
    setText("");
    setFile(null);
    setError(null);
    if (taRef.current) taRef.current.style.height = "auto";
    taRef.current?.focus();
    onSent(res.data, sentText);
    // Asking for (or offering) graded work to be done: the message is sent, with a friendly reminder.
    const tip = honestyReminder(sentText, !!me?.tutorId);
    if (tip) toast("A friendly reminder", { description: tip });
  };

  const canSend = !!text.trim() || !!file;
  const stepLabel = step === "uploading" ? "Uploading your file…" : step === "checking" ? "Checking your file for contact details…" : null;

  return (
    <div className="border-t border-line bg-surface px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-4">
      <AnimatePresence initial={false}>
        {error?.blocked && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2, ease: EASE }} className="overflow-hidden">
            <div id={errorId} role="alert" className="mb-2.5 flex items-start gap-2.5 rounded-xl border border-danger-200 bg-danger-50 px-3.5 py-2.5 text-[13px] leading-snug text-ink">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-danger">Not sent</p>
                <p className="mt-0.5 text-ink-2">{error.message}</p>
                {error.rude ? null : review.sent ? (
                  <p className="mt-1 font-medium text-ink">{review.sent}</p>
                ) : !review.open ? (
                  <button type="button" onClick={() => setReview({ open: true, note: "" })} className="mt-1 font-semibold text-ink underline underline-offset-2">
                    Not contact details? Ask for a review
                  </button>
                ) : (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <label htmlFor={`${hintId}-review`} className="sr-only">Why isn&apos;t it contact details?</label>
                    <input id={`${hintId}-review`} value={review.note} onChange={(e) => setReview((v) => ({ ...v, note: e.target.value }))} maxLength={1000} placeholder="Why isn't it? (optional)" className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-ink" />
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await appeal(review.note);
                        setReview((v) => (res.ok ? { ...v, open: false, sent: "Review asked: our team will look at it." } : { ...v, error: res.error }));
                      }}
                      className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-on-ink"
                    >
                      Send
                    </button>
                    {review.error && <span className="text-danger">{review.error}</span>}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => { setError(null); setReview({ open: false, note: "" }); }} className="grid size-7 shrink-0 place-items-center rounded-md text-muted hover:bg-danger-200/60" aria-label="Dismiss warning">
                <X className="size-3.5" />
              </button>
            </div>
          </motion.div>
        )}
        {file && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2, ease: EASE }} className="overflow-hidden">
            <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-lg border border-line bg-canvas py-1.5 pl-2.5 pr-1 text-[12.5px] text-ink-2">
              <FileText className="size-4 shrink-0 text-muted" aria-hidden />
              <span className="truncate font-medium">{file.name}</span>
              <span className="shrink-0 text-muted">{formatSize(file.sizeKb)}</span>
              <button type="button" disabled={sending} onClick={() => { setFile(null); setError(null); }} className="grid size-7 shrink-0 place-items-center rounded-md hover:bg-sunken disabled:opacity-50" aria-label={`Remove attachment ${file.name}`}>
                <X className="size-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {!error?.blocked && <ContactHint text={text} />}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex items-end gap-2"
      >
        <input
          ref={fileRef}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          accept={ACCEPT}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setFile({ name: f.name, sizeKb: Math.max(1, Math.round(f.size / 1024)), file: f });
              setError(null);
            }
            e.target.value = "";
          }}
        />
        <Button type="button" variant="ghost" size="icon" disabled={sending} onClick={() => fileRef.current?.click()} aria-label="Attach a file" className="shrink-0 text-muted">
          <Paperclip />
        </Button>
        <label htmlFor={`${hintId}-ta`} className="sr-only">
          Message {recipient}
        </label>
        <textarea
          id={`${hintId}-ta`}
          ref={taRef}
          rows={1}
          value={text}
          maxLength={4000}
          onChange={(e) => {
            setText(e.target.value);
            if (error && !error.blocked) setError(null);
            autosize(e.currentTarget);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={`Message ${recipient}`}
          aria-describedby={error ? errorId : hintId}
          aria-invalid={error ? true : undefined}
          className="max-h-[168px] min-h-10 flex-1 resize-none rounded-xl border border-line-strong bg-surface px-3.5 py-2 text-[15px] leading-6 text-ink outline-none transition-[border-color,box-shadow] placeholder:text-subtle hover:border-subtle focus:border-brand focus:ring-2 focus:ring-brand/25 aria-[invalid=true]:border-danger"
        />
        <Button type="submit" size="icon" disabled={!canSend} loading={sending} aria-label="Send message" className="shrink-0">
          <Send />
        </Button>
      </form>

      {error && !error.blocked ? (
        <p id={errorId} role="alert" className="mt-2 text-[12.5px] text-danger">
          {error.message}
        </p>
      ) : stepLabel ? (
        <p role="status" className="mt-2 text-[12px] text-muted">
          {stepLabel}
        </p>
      ) : (
        <p id={hintId} className="mt-2 flex items-center gap-1.5 text-[12px] text-muted">
          <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
          <span className="hidden sm:inline">Keep chats on TutorLink: phone numbers, emails and social or messaging app details can&apos;t be shared, in messages or files. Enter to send, Shift + Enter for a new line.</span>
          <span className="sm:hidden">Contact details can&apos;t be shared here.</span>
        </p>
      )}
    </div>
  );
}
