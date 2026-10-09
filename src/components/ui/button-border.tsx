"use client";

import * as React from "react";
import { Moon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

/**
 * A spark of light that travels around a button's edge. Drop it inside any
 * element that is `relative`; the ring is masked to the border, so nothing
 * covers the label. Corners are square here, like every other edge on the site.
 */
export function BorderBeam({ size = 20, duration = 5, className }: { size?: number; duration?: number; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute -inset-px rounded-[inherit] border-2 border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]",
        className,
      )}
    >
      <motion.div
        className="absolute aspect-square bg-gradient-to-r from-transparent via-brand to-brand"
        style={{ width: size, offsetPath: "rect(0 auto auto 0 round 0px)" }}
        animate={{ offsetDistance: ["0%", "100%"] }}
        transition={{ repeat: Number.POSITIVE_INFINITY, duration, ease: "linear" }}
      />
    </div>
  );
}

/** The two buttons from the recipe, on this site's Button. */
export function ButtonDemo() {
  return (
    <div className="flex gap-3">
      <Button variant="outline" size="icon" className="relative" aria-label="Theme">
        <BorderBeam />
        <Moon />
      </Button>
      <Button variant="outline" className="relative">
        <BorderBeam />
        Animated border
      </Button>
    </div>
  );
}
