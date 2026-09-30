"use client";

import { LazyScene } from "./LazyScene";
import { AuroraWaveScene } from "./scenes";
import { Aurora } from "@/components/motion";
import { cn } from "@/lib/utils";

/*
 * The dot field is masked away from the text: left-aligned heroes keep it to the right, centered
 * heroes keep a clear area in the middle, and it always fades out before it reaches the copy.
 */
const MASK = {
  left: "[mask-image:linear-gradient(to_bottom,transparent,black_75%),linear-gradient(to_right,transparent_12%,black_62%)] [mask-composite:intersect]",
  center: "[mask-image:linear-gradient(to_bottom,transparent,black_80%),radial-gradient(ellipse_42%_70%_at_50%_10%,transparent_55%,black)] [mask-composite:intersect]",
};

/**
 * Hero backdrop for inner pages: soft drifting color fields (GSAP) with the three.js aurora dot
 * field along the bottom. Place it first inside a `relative overflow-hidden` hero section.
 */
export function HeroWave({ className, align = "left", compact }: { className?: string; align?: "left" | "center"; compact?: boolean }) {
  return (
    <>
      <Aurora className="opacity-80 [mask-image:linear-gradient(to_bottom,black_30%,transparent)]" intensity={0.8} />
      <LazyScene
        scene={AuroraWaveScene}
        className={cn("absolute inset-x-0 bottom-0 opacity-80", compact ? "h-[46%]" : "h-[52%]", MASK[align], className)}
      />
    </>
  );
}
