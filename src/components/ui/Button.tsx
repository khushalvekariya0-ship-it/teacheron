"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium tracking-[-0.005em] select-none transition-[background-color,border-color,color,transform,filter,box-shadow] duration-150 ease-out active:translate-y-px disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Solid ink: the main action on a page.
        primary: "bg-ink text-on-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(9_9_11/0.2)] hover:bg-navy-hover active:bg-black",
        // Solid indigo accent: the key actions (find, book, sign up).
        brand: "bg-brand text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(9_9_11/0.18),0_6px_16px_-8px_rgb(79_70_229/0.6)] hover:bg-brand-hover active:bg-brand-press",
        // Quiet hairline button on the page colour.
        secondary: "border border-line-strong bg-surface text-ink shadow-xs hover:border-subtle hover:bg-canvas",
        outline: "border border-line-strong bg-surface text-ink hover:border-ink",
        ghost: "text-ink-2 hover:bg-canvas hover:text-ink",
        subtle: "bg-canvas text-ink hover:bg-sunken",
        danger: "bg-danger text-white hover:bg-danger/90",
        "danger-outline": "border border-danger/40 bg-surface text-danger hover:border-danger hover:bg-danger-50",
        link: "h-auto px-0 text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2 active:translate-y-0",
      },
      size: {
        xs: "h-7 rounded-full px-3 text-xs [&_svg]:size-3.5",
        sm: "h-9 rounded-full px-4 text-[13.5px] [&_svg]:size-4",
        md: "h-11 rounded-full px-5 text-[15px] [&_svg]:size-[18px]",
        lg: "h-13 rounded-full px-7 text-[15.5px] [&_svg]:size-[18px]",
        icon: "size-10 rounded-full [&_svg]:size-[18px]",
        "icon-sm": "size-8 rounded-full [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading = false, asChild = false, children, disabled, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={asChild ? undefined : disabled || loading}
        aria-busy={loading || undefined}
        type={asChild ? undefined : (type ?? "button")}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="animate-spin" aria-hidden />}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";
