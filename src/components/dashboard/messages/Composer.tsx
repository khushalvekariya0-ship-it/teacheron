"use client";

import * as React from "react";
import { FileText, Paperclip, Send, ShieldCheck, X } from "lucide-react";
import type { Message } from "@/lib/types";
import { useApp } from "@/lib/store";
import { AnimatePresence, EASE, motion } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { formatSize } from "./shared";

const MAX_HEIGHT = 168;

export function Composer({ conversationId, recipient, onSent }: { conversationId: string; recipient: string; onSent: (msg: Message, text: string) => void }) {
  const send = useApp((s) => s.sendMessage);
  const [text, setText] = React.useState("");
  const [file, setFile] = React.useState<Message["attachment"] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const taRef = React.useRef<HTMLTextAreaElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const hintId = React.useId();
  const errorId = React.useId();

  const autosize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  };

  const submit = () => {
    if (!text.trim() && !file) return;
    const res = send(conversationId, text, file ?? undefined);
    if (!res.ok) return setError(res.error);
    const sentText = text;
    setText("");
    setFile(null);
    setError(null);
    if (taRef.current) taRef.current.style.height = "auto";
    taRef.current?.focus();
    onSent(res.data, sentText);
  };

  const canSend = !!text.trim() || !!file;

  return (
    <div className="border-t border-line bg-surface px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-4">
      <AnimatePresence initial={false}>
        {file && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2, ease: EASE }} className="overflow-hidden">
            <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-lg border border-line bg-canvas py-1.5 pl-2.5 pr-1 text-[12.5px] text-ink-2">
              <FileText className="size-4 shrink-0 text-muted" aria-hidden />
              <span className="truncate font-medium">{file.name}</span>
              <span className="shrink-0 text-muted">{formatSize(file.sizeKb)}</span>
              <button type="button" onClick={() => { setFile(null); setError(null); }} className="grid size-7 shrink-0 place-items-center rounded-md hover:bg-sunken" aria-label={`Remove attachment ${file.name}`}>
                <X className="size-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-end gap-2"
      >
        <input
          ref={fileRef}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setFile({ name: f.name, sizeKb: Math.max(1, Math.round(f.size / 1024)) });
              setError(null);
            }
            e.target.value = "";
          }}
        />
        <Button type="button" variant="ghost" size="icon" onClick={() => fileRef.current?.click()} aria-label="Attach a file" className="shrink-0 text-muted">
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
            if (error) setError(null);
            autosize(e.currentTarget);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={`Message ${recipient}`}
          aria-describedby={error ? errorId : hintId}
          aria-invalid={error ? true : undefined}
          className="max-h-[168px] min-h-10 flex-1 resize-none rounded-xl border border-line-strong bg-surface px-3.5 py-2 text-[15px] leading-6 text-ink outline-none transition-[border-color,box-shadow] placeholder:text-subtle hover:border-subtle focus:border-ink focus:ring-1 focus:ring-ink"
        />
        <Button type="submit" size="icon" disabled={!canSend} aria-label="Send message" className="shrink-0 rounded-xl">
          <Send />
        </Button>
      </form>

      {error ? (
        <p id={errorId} role="alert" className="mt-2 text-[12.5px] text-danger">
          {error}
        </p>
      ) : (
        <p id={hintId} className="mt-2 flex items-center gap-1.5 text-[12px] text-muted">
          <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
          <span className="hidden sm:inline">Phone numbers, emails and social handles are hidden automatically. Enter to send, Shift + Enter for a new line.</span>
          <span className="sm:hidden">Contact details are hidden automatically.</span>
        </p>
      )}
    </div>
  );
}
