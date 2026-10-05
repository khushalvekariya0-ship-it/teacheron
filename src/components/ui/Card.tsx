import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, interactive, ...props }: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      data-spotlight={interactive ? "" : undefined}
      className={cn(
        "rounded-2xl border border-line bg-surface shadow-xs",
        interactive && "transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-line-strong hover:shadow-md",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, title, description, action, ...props }: Omit<React.HTMLAttributes<HTMLDivElement>, "title"> & { title?: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5", className)} {...props}>
      <div className="min-w-0">
        {title && <h3 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h3>}
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center gap-2 border-t border-line px-5 py-3.5", className)} {...props} />;
}

export function Separator({ className, vertical }: { className?: string; vertical?: boolean }) {
  return <div role="separator" aria-orientation={vertical ? "vertical" : "horizontal"} className={cn(vertical ? "w-px self-stretch" : "h-px w-full", "bg-line", className)} />;
}

/** Label/value row used in detail panels. */
export function DetailRow({ label, children, className }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 py-2.5 text-sm", className)}>
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-ink">{children}</dd>
    </div>
  );
}
