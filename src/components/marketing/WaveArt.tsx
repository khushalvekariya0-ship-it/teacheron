import * as React from "react";
import { cn } from "@/lib/utils";

/*
 * The site's illustration: layered bands of colour, like strata, with film grain over them.
 * Pure SVG — no image file — so it scales to any box and the colours stay exact. Bands drift
 * very slowly; the global reduced-motion rule stops that.
 */

/** Five band colours, back to front. */
const BANDS = ["#4b6b63", "#d9502b", "#b59bc3", "#c8bd86", "#e9a36e"];

/**
 * Each band is a wavy path over a 1000×1000 box. `offset` lifts it; `amp` is the wave height;
 * `phase` shifts the crests so bands never line up. Each path is twice the box width so it can drift.
 */
function band(offset: number, amp: number, phase: number): string {
  const pts: string[] = [];
  for (let x = -1000; x <= 2000; x += 50) {
    const t = (x / 1000) * Math.PI * 2;
    const y = offset + Math.sin(t * 0.9 + phase) * amp + Math.sin(t * 2.3 + phase * 1.7) * amp * 0.35;
    pts.push(`${x} ${y.toFixed(1)}`);
  }
  return `M${pts.join(" L")} L2000 1200 L-1000 1200 Z`;
}

const PATHS = [
  band(260, 90, 0.4),
  band(420, 110, 2.1),
  band(600, 95, 3.9),
  band(760, 80, 5.2),
  band(900, 70, 1.3),
];

export function WaveArt({ className, drift = true }: { className?: string; /** Set false where the art sits behind text. */ drift?: boolean }) {
  const id = React.useId().replace(/[:]/g, "");
  return (
    <svg className={cn("block size-full", className)} viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        {/* Film grain: fine monochrome noise, mixed over the bands at low strength. */}
        <filter id={`grain-${id}`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="table" tableValues="0 0.22" />
          </feComponentTransfer>
        </filter>
        {/* Faint horizontal striations, like a print. */}
        <pattern id={`lines-${id}`} width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="1.2" fill="#000" opacity="0.08" />
        </pattern>
      </defs>
      <rect width="1000" height="1000" fill={BANDS[0]} />
      {PATHS.map((d, i) => (
        <path
          key={i}
          d={d}
          fill={BANDS[(i + 1) % BANDS.length]}
          style={drift ? { animation: `wave-drift ${38 + i * 9}s ease-in-out infinite alternate`, animationDelay: `${-i * 7}s` } : undefined}
        />
      ))}
      <rect width="1000" height="1000" fill={`url(#lines-${id})`} />
      <rect width="1000" height="1000" filter={`url(#grain-${id})`} />
    </svg>
  );
}
