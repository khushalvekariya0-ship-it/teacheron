import * as React from "react";
import { cn } from "@/lib/utils";

/*
 * The hero's backdrop: a board that writes itself. Axes and a curve, a right triangle, a sine wave,
 * a benzene ring, an orbit and a few equations are drawn in thin chalk lines one after another when
 * the page opens, then stay. Pure SVG + CSS (`chalk-line` / `chalk-text` in globals.css); the strokes
 * take the text colour, so the board is chalk on charcoal in the dark theme and ink on cream in the
 * light one. With reduced motion everything is simply there.
 */

const MATH = { fontFamily: "var(--font-heading)", fontStyle: "italic" as const };

/** A drawn line. `at` is the second it starts; `secs` how long the hand takes. */
function Line({ d, at, secs = 2.2, className, width = 2 }: { d: string; at: number; secs?: number; className?: string; width?: number }) {
  return <path d={d} pathLength={1} className={cn("chalk-line", className)} strokeWidth={width} style={{ "--delay": `${at}s`, "--draw": `${secs}s` } as React.CSSProperties} />;
}

/** A written label. */
function Note({ x, y, at, children, size = 30, className }: { x: number; y: number; at: number; children: React.ReactNode; size?: number; className?: string }) {
  return (
    <text x={x} y={y} fontSize={size} className={cn("chalk-text", className)} style={{ ...MATH, "--delay": `${at}s` } as React.CSSProperties}>
      {children}
    </text>
  );
}

export function Chalkboard({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none overflow-hidden text-ink", className)} aria-hidden>
      {/* Warm and cool light in two corners, a faint grid, then the board */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_60%_at_100%_0%,var(--board-teal),transparent_65%),radial-gradient(ellipse_50%_55%_at_90%_100%,var(--board-orange),transparent_65%)]" />
      <div className="absolute inset-0 bg-line-grid opacity-70 [mask-image:radial-gradient(ellipse_75%_75%_at_60%_45%,black,transparent_85%)]" />

      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full fill-current stroke-current opacity-[0.32]" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* Axes and y = x² — top right */}
        <g className="opacity-80">
          <Line d="M1130 330H1500" at={0.4} />
          <Line d="M1300 360V70" at={1.2} secs={1.6} />
          <Line d="M1490 322l12 8-12 8M1292 80l8-12 8 12" at={2.4} secs={0.6} width={1.6} />
          <Line d="M1160 90Q1300 560 1440 90" at={3} secs={2.8} className="stroke-brand" width={3} />
          <Note x={1450} y={130} at={5.6} className="fill-brand">
            y = x²
          </Note>
          <Line d="M1220 324v12M1380 324v12M1294 250h12M1294 170h12" at={5.2} secs={0.8} width={1.4} />
        </g>

        {/* Pythagoras — bottom left */}
        <g className="opacity-70">
          <Line d="M90 850V640L380 850Z" at={6.2} secs={2.4} />
          <Line d="M90 660h20v-20" at={8.2} secs={0.5} width={1.4} />
          <Note x={40} y={760} at={8.6} size={26}>
            a
          </Note>
          <Note x={220} y={885} at={8.9} size={26}>
            b
          </Note>
          <Note x={250} y={730} at={9.2} size={26}>
            c
          </Note>
          <Note x={420} y={690} at={9.8} size={34}>
            a² + b² = c²
          </Note>
        </g>

        {/* Sine wave — bottom centre */}
        <g className="opacity-70">
          <Line d="M520 820H1060" at={10.6} secs={1.4} width={1.4} />
          <Line d="M540 820C580 740 620 740 660 820S740 900 780 820 860 740 900 820 980 900 1020 820" at={11.4} secs={3} className="stroke-sky" width={2.6} />
          <Note x={1070} y={790} at={14} size={26} className="fill-sky">
            sin x
          </Note>
        </g>

        {/* Benzene ring — right, lower */}
        <g className="opacity-70">
          <Line d="M1330 560l70 40v80l-70 40-70-40v-80z" at={14.6} secs={2.2} />
          <Line d="M1348 586l36 21v44M1298 606v44l36 21" at={16.6} secs={1.4} width={1.4} />
          <Note x={1420} y={720} at={18} size={26}>
            C₆H₆
          </Note>
        </g>

        {/* An orbit — centre right */}
        <g className="opacity-60">
          <Line d="M1010 480a110 42 0 1 0 220 0a110 42 0 1 0-220 0" at={18.6} secs={2.6} width={1.6} />
          <Line d="M1120 466a14 14 0 1 0 0.1 0" at={20.8} secs={0.8} className="stroke-brand" width={2.4} />
          <Line d="M1228 452a7 7 0 1 0 0.1 0" at={21.4} secs={0.5} width={2} />
        </g>

        {/* Equations across the top and middle */}
        <Note x={540} y={128} at={22} size={24} className="opacity-60">
          x = (−b ± √(b² − 4ac)) / 2a
        </Note>
        <Note x={1180} y={140} at={25.4} size={26} className="opacity-50">
          E = mc²
        </Note>
        <Note x={1040} y={610} at={26.2} size={30} className="opacity-60">
          A = πr²
        </Note>
        <Line d="M1030 622h120" at={27} secs={0.8} width={1.6} className="opacity-60" />

        {/* A tick, like a marked answer */}
        <Line d="M1180 850l22 22 44-48" at={28} secs={0.8} className="stroke-live" width={3} />
      </svg>

      {/* Film grain */}
      <div
        className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='180' height='180' filter='url(%23n)'/></svg>\")",
        }}
      />
    </div>
  );
}
