"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Lock, ShieldAlert, CircleAlert, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { useSession } from "@/lib/store/hooks";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn("flex flex-col items-center justify-center text-center", compact ? "px-4 py-10" : "px-6 py-16", className)}
    >
      {icon && (
        <div className="mb-4 grid size-12 place-items-center rounded-xl bg-brand-soft text-ink [&_svg]:size-6">{icon}</div>
      )}
      <h3 className="font-heading text-[17px] font-bold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </motion.div>
  );
}

export function ErrorState({ title = "Something went wrong", description, onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon={<CircleAlert className="text-danger" />}
      title={title}
      description={description ?? "We couldn't load this. Check your connection and try again."}
      action={onRetry && <Button variant="secondary" onClick={onRetry}><RotateCcw /> Try again</Button>}
    />
  );
}

/** Shown when a signed-out visitor opens a protected page. */
export function UnauthorizedState({ next }: { next?: string }) {
  return (
    <EmptyState
      icon={<Lock />}
      title="Sign in to continue"
      description="You need an account to view this page."
      action={
        <>
          <Button asChild><Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Sign in</Link></Button>
          <Button asChild variant="secondary"><Link href="/register">Create account</Link></Button>
        </>
      }
    />
  );
}

/** Shown when a signed-in user lacks permission. Staff are sent back to the admin panel, members to their dashboard. */
export function ForbiddenState({ description }: { description?: string }) {
  const me = useSession();
  const staff = me?.role === "admin" || me?.role === "support";
  return (
    <EmptyState
      icon={<ShieldAlert />}
      title="You don't have access to this page"
      description={description ?? "This area isn't available for your account type. If you think this is a mistake, contact support."}
      action={<Button asChild variant="secondary"><Link href={staff ? "/admin" : "/dashboard"}>{staff ? "Back to admin" : "Go to dashboard"}</Link></Button>}
    />
  );
}

export function InlineAlert({ tone = "info", title, children, className, action }: { tone?: "info" | "warning" | "danger" | "success"; title?: React.ReactNode; children?: React.ReactNode; className?: string; action?: React.ReactNode }) {
  const styles = {
    info: "border-navy-100 bg-navy-50/70 text-navy",
    warning: "border-warning-200 bg-warning-50 text-warning",
    danger: "border-danger-200 bg-danger-50 text-danger",
    success: "border-success-200 bg-success-50 text-success",
  }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "note"} className={cn("flex items-start gap-3 rounded-lg border px-4 py-3 text-sm", styles, className)}>
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn("text-ink-2", title && "mt-0.5")}>{children}</div>}
      </div>
      {action}
    </div>
  );
}
