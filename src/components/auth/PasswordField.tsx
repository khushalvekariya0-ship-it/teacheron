"use client";

import * as React from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { motion } from "@/components/motion";
import { Input, type InputProps } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { passwordStrength } from "./authUtils";

/** Password input with a show/hide toggle. Works with react-hook-form `register`. */
export const PasswordInput = React.forwardRef<HTMLInputElement, Omit<InputProps, "type" | "suffix">>(function PasswordInput(props, ref) {
  const [visible, setVisible] = React.useState(false);
  return (
    <Input
      ref={ref}
      {...props}
      type={visible ? "text" : "password"}
      icon={<LockKeyhole />}
      suffix={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-canvas hover:text-ink"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
    />
  );
});

const SEGMENT_TONE = ["bg-line", "bg-danger", "bg-warning", "bg-ink", "bg-success"] as const;
const LABEL_TONE = ["text-muted", "text-danger", "text-warning", "text-ink", "text-success"] as const;

/** Four-segment strength meter. The label carries the meaning; colour only reinforces it. */
export function PasswordStrengthMeter({ value, id }: { value: string; id?: string }) {
  const { level, label, hint } = passwordStrength(value);
  return (
    <div id={id} className="space-y-1.5" aria-live="polite">
      <div className="grid grid-cols-4 gap-1.5" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className="h-1 overflow-hidden rounded-full bg-sunken">
            <motion.span
              className={cn("block h-full rounded-full", SEGMENT_TONE[level])}
              initial={false}
              animate={{ width: level >= i ? "100%" : "0%" }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            />
          </span>
        ))}
      </div>
      <p className="flex items-center justify-between gap-3 text-[12.5px] text-muted">
        <span>{hint}</span>
        {label && <span className={cn("shrink-0 font-medium", LABEL_TONE[level])}>{label}</span>}
      </p>
    </div>
  );
}
