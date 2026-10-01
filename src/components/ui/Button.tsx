"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold select-none transition-[background-color,border-color,color,transform,filter,box-shadow] duration-150 ease-out active:translate-y-px disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Solid slate ink: the main action on a page.
        primary: "border-2 border-ink bg-ink text-on-ink hover:border-navy-hover hover:bg-navy-hover active:bg-black",
        // Signature blue → violet gradient: the key actions (find, book, sign up).
        brand: "bg-brand-gradient text-white shadow-[0_10px_28px_-12px_rgb(75_102_245/0.75)] hover:brightness-110 hover:shadow-[0_14px_32px_-12px_rgb(75_102_245/0.9)] active:brightness-95",
        // Quiet outline on the page colour.
        secondary: "border border-line-strong bg-surface text-ink hover:border-ink/40 hover:bg-canvas",
        outline: "border-2 border-line bg-surface text-ink hover:border-ink",
        ghost: "text-ink-2 hover:bg-canvas hover:text-ink",
        subtle: "bg-canvas text-ink hover:bg-sunken",
        danger: "border-2 border-danger bg-danger text-white hover:bg-danger/90",
        "danger-outline": "border-2 border-danger/40 bg-surface text-danger hover:border-danger hover:bg-danger-50",
        link: "h-auto px-0 text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2 active:translate-y-0",
      },
      size: {
        xs: "h-7 rounded-md px-2.5 text-xs [&_svg]:size-3.5",
        sm: "h-9 rounded-lg px-3.5 text-[13.5px] [&_svg]:size-4",
        md: "h-11 rounded-lg px-5 text-[15px] [&_svg]:size-[18px]",
        lg: "h-14 rounded-lg px-7 text-base [&_svg]:size-5",
        icon: "size-10 rounded-lg [&_svg]:size-[18px]",
        "icon-sm": "size-8 rounded-md [&_svg]:size-4",
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
