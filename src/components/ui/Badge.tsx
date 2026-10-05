import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva("inline-flex items-center gap-1 whitespace-nowrap rounded-full font-medium leading-none [&_svg]:size-3.5", {
  variants: {
    tone: {
      neutral: "bg-sunken text-ink-2",
      accent: "bg-brand-soft text-brand-press",
      solid: "bg-ink text-on-ink",
      success: "bg-success-50 text-success",
      warning: "bg-warning-50 text-warning",
      danger: "bg-danger-50 text-danger",
      outline: "border border-line text-ink-2",
    },
    size: {
      sm: "h-6 px-2 text-[11.5px]",
      md: "h-7 px-2.5 text-[12.5px]",
    },
  },
  defaultVariants: { tone: "neutral", size: "md" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, tone, size, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, size }), className)} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
