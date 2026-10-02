"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { EASE } from "@/components/motion";

export interface MapMetro {
  slug: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  inPerson: number;
}

// Contiguous-US bounding box for a simple equirectangular projection.
const LNG: [number, number] = [-125, -66];
const LAT: [number, number] = [24, 50];

/** Approximate time-zone bands by longitude (the real borders zig-zag; this is a guide, not a boundary map). */
const ZONE_BANDS: { label: string; from: number; to: number }[] = [
  { label: "Pacific", from: -125, to: -114 },
  { label: "Mountain", from: -114, to: -101 },
  { label: "Central", from: -101, to: -86 },
  { label: "Eastern", from: -86, to: -66 },
];
const lngToX = (lng: number) => ((lng - LNG[0]) / (LNG[1] - LNG[0])) * 100;

function project(m: MapMetro): { x: number; y: number } {
  return { x: ((m.lng - LNG[0]) / (LNG[1] - LNG[0])) * 100, y: ((LAT[1] - m.lat) / (LAT[1] - LAT[0])) * 100 };
}

/**
 * Abstract dot map of metro pages. Positions come from each metro's real coordinates; ring size
 * reflects the number of tutors offering in-person lessons there. Every marker is a keyboard-focusable link.
 */
export function MetroMap({ metros }: { metros: MapMetro[] }) {
  // Nudge markers that would sit on top of each other (e.g. New York and Brooklyn).
  const placed: { m: MapMetro; x: number; y: number }[] = [];
  for (const m of metros) {
    let { x, y } = project(m);
    for (const p of placed) {
      if (Math.abs(p.x - x) < 1.6 && Math.abs(p.y - y) < 2.8) {
        x += 1.4;
        y += 2.2;
      }
    }
    placed.push({ m, x, y });
  }

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-line bg-canvas">
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-60" aria-hidden />
      <div className="relative mx-auto aspect-[16/9] w-full max-w-5xl sm:aspect-[2/1]">
        {/* Time-zone bands */}
        {ZONE_BANDS.map((z, i) => (
          <div
            key={z.label}
            aria-hidden
            className={cn("absolute inset-y-0 border-line", i > 0 && "border-l border-dashed", i % 2 ? "bg-brand/[0.03]" : "")}
            style={{ left: `${lngToX(z.from)}%`, width: `${lngToX(z.to) - lngToX(z.from)}%` }}
          >
            <span className="absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted sm:text-[11.5px]">
              <span className="sm:hidden">{z.label.charAt(0)}T</span>
              <span className="hidden sm:inline">{z.label}</span>
            </span>
          </div>
        ))}
        {placed.map(({ m, x, y }, i) => {
          const ring = m.inPerson > 0 ? 18 + m.inPerson * 10 : 0;
          const labelLeft = x > 80;
          return (
            <Link
              key={m.slug}
              href={`/locations/${m.slug}`}
              aria-label={`${m.city}, ${m.state}: ${m.inPerson} ${m.inPerson === 1 ? "tutor" : "tutors"} offering in-person lessons`}
              className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full p-2 hover:z-20 focus-visible:z-20"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              {ring > 0 && (
                <motion.span
                  aria-hidden
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand/40 bg-brand/15"
                  style={{ width: ring, height: ring }}
                  initial={{ scale: 0, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, ease: EASE, delay: 0.2 + i * 0.04 }}
                />
              )}
              <motion.span
                aria-hidden
                className={cn("relative block size-2.5 rounded-full ring-4 transition-transform duration-200 group-hover:scale-125 group-focus-visible:scale-125", m.inPerson > 0 ? "bg-brand-gradient ring-white shadow-md" : "bg-subtle ring-white")}
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ type: "spring", bounce: 0.5, duration: 0.6, delay: 0.1 + i * 0.04 }}
              />
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[12px] font-semibold text-on-ink opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100",
                  labelLeft ? "right-full mr-1" : "left-full ml-1",
                )}
              >
                {m.city}, {m.state} <span className="font-normal text-on-ink/70">· {m.inPerson} in person</span>
              </span>
            </Link>
          );
        })}
      </div>
      <div className="relative flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line bg-surface px-4 py-3 text-[12.5px] text-ink-2">
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-brand-gradient ring-4 ring-brand/20" aria-hidden /> In-person tutors available
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-subtle ring-4 ring-line" aria-hidden /> Online only for now
        </span>
        <span>Larger rings mean more in-person tutors. Time-zone bands are approximate. Hover or focus a city for details.</span>
      </div>
    </div>
  );
}
