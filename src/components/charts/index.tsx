"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountUp } from "@/components/motion";

/*
 * Single-series charts. Spec: thin marks, 4px rounded data-end square at the baseline, bars <= 24px,
 * 2px lines, area wash ~10%, hairline solid gridlines, text in text tokens (never the series color),
 * hover tooltip per mark / crosshair on lines, and an sr-only table so values never depend on hover.
 */

export interface Datum {
  label: string;
  value: number;
}

const SERIES = "var(--color-navy)";

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

function SrTable({ data, caption, format }: { data: Datum[]; caption: string; format: (n: number) => string }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Period</th>
          <th scope="col">Value</th>
        </tr>
      </thead>
      <tbody>
        {data.map((d) => (
          <tr key={d.label}>
            <td>{d.label}</td>
            <td>{format(d.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Tooltip({ x, y, label, value, visible }: { x: number; y: number; label: string; value: string; visible: boolean }) {
  return (
    <div
      className={cn("pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-line bg-surface px-2.5 py-1.5 shadow-md transition-opacity duration-100", visible ? "opacity-100" : "opacity-0")}
      style={{ left: x, top: y - 8 }}
      aria-hidden
    >
      <div className="text-sm font-semibold text-ink">{value}</div>
      <div className="whitespace-nowrap text-[11px] text-muted">{label}</div>
    </div>
  );
}

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = React.useRef<T>(null);
  const [w, setW] = React.useState(0);
  React.useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Vertical columns for a single series over time or categories. */
export function ColumnChart({
  data,
  height = 220,
  format = (n) => n.toLocaleString("en-US"),
  caption,
  highlightLast = true,
}: {
  data: Datum[];
  height?: number;
  format?: (n: number) => string;
  caption: string;
  highlightLast?: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const gid = `cc${React.useId().replace(/:/g, "")}`;
  const [hover, setHover] = React.useState<number | null>(null);
  const pad = { top: 20, right: 8, bottom: 26, left: 44 };
  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const band = data.length ? innerW / data.length : 0;
  const barW = Math.min(24, band * 0.56);
  const ticks = [0, max / 2, max];
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={caption} onMouseLeave={() => setHover(null)}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#4f46e5" />
              <stop offset="1" stopColor="#4f46e5" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} className="stroke-line" strokeWidth={1} />
              <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                {format(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const h = Math.max(0, (d.value / max) * innerH);
            const x = pad.left + band * i + (band - barW) / 2;
            const r = Math.min(4, h / 2, barW / 2);
            const top = pad.top + innerH - h;
            const path = h > 0 ? `M${x},${pad.top + innerH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${pad.top + innerH} Z` : "";
            const emphasized = hover === i || (hover === null && highlightLast && i === data.length - 1);
            return (
              <g key={d.label}>
                <motion.path
                  d={path}
                  fill={`url(#${gid})`}
                  initial={{ opacity: 0, scaleY: 0 }}
                  animate={{ opacity: emphasized || !highlightLast ? 1 : 0.28, scaleY: 1 }}
                  style={{ transformOrigin: `0px ${pad.top + innerH}px`, transformBox: "view-box" }}
                  transition={{ scaleY: { duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: i * 0.03 }, opacity: { duration: 0.2 } }}
                />
                <text x={x + barW / 2} y={height - 8} textAnchor="middle" className="fill-muted text-[11px]">
                  {d.label}
                </text>
                {/* hit target is the full band, bigger than the mark */}
                <rect
                  x={pad.left + band * i}
                  y={pad.top}
                  width={band}
                  height={innerH}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${d.label}: ${format(d.value)}`}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="outline-none"
                />
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && width > 0 && (
        <Tooltip visible x={pad.left + band * hover + band / 2} y={y(data[hover].value)} label={data[hover].label} value={format(data[hover].value)} />
      )}
      <SrTable data={data} caption={caption} format={format} />
    </div>
  );
}

/** Single-series line with an area wash, crosshair tooltip and labeled end point. */
export function AreaChart({
  data,
  height = 220,
  format = (n) => n.toLocaleString("en-US"),
  caption,
}: {
  data: Datum[];
  height?: number;
  format?: (n: number) => string;
  caption: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const gid = `ac${React.useId().replace(/:/g, "")}`;
  const [hover, setHover] = React.useState<number | null>(null);
  const pad = { top: 20, right: 16, bottom: 26, left: 44 };
  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const x = (i: number) => pad.left + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.value)}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${pad.top + innerH} L${x(0)},${pad.top + innerH} Z`;
  const ticks = [0, max / 2, max];
  const last = data.length - 1;
  const labelEvery = Math.ceil(data.length / 6);

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(last, Math.round(rel * last))));
  };

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && data.length > 0 && (
        <svg width={width} height={height} role="img" aria-label={caption}>
          <defs>
            <linearGradient id={`${gid}-line`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#121117" />
              <stop offset="1" stopColor="#121117" />
            </linearGradient>
            <linearGradient id={`${gid}-area`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#4f46e5" stopOpacity="0.16" />
              <stop offset="1" stopColor="#4f46e5" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} className="stroke-line" strokeWidth={1} />
              <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                {format(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) =>
            i % labelEvery === 0 || i === last ? (
              <text key={d.label} x={x(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"} className="fill-muted text-[11px]">
                {d.label}
              </text>
            ) : null,
          )}
          <motion.path d={area} fill={`url(#${gid}-area)`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.3 }} />
          <motion.path
            d={line}
            fill="none"
            stroke={`url(#${gid}-line)`}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          />
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} stroke="var(--color-line-strong)" strokeWidth={1} />}
          <circle cx={x(hover ?? last)} cy={y(data[hover ?? last].value)} r={4} fill={SERIES} stroke="var(--color-surface)" strokeWidth={2} />
          <rect
            x={pad.left}
            y={pad.top}
            width={innerW}
            height={innerH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            tabIndex={0}
            aria-label={`${caption}. Use arrow keys to read values.`}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") setHover((h) => Math.min(last, (h ?? -1) + 1));
              if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? last + 1) - 1));
            }}
            onBlur={() => setHover(null)}
            className="outline-none"
          />
        </svg>
      )}
      {width > 0 && data.length > 0 && (
        <Tooltip visible={hover !== null} x={x(hover ?? last)} y={y(data[hover ?? last].value)} label={data[hover ?? last].label} value={format(data[hover ?? last].value)} />
      )}
      <SrTable data={data} caption={caption} format={format} />
    </div>
  );
}

/** 12-point trend in the de-emphasis hue, current point in the accent. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const w = 96;
  const h = 28;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * (w - 6) + 3;
  const y = (v: number) => h - 3 - ((v - min) / (max - min || 1)) * (h - 6);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("h-7 w-24", className)} aria-hidden>
      <motion.path d={d} fill="none" stroke="#4f46e5" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={3} fill={SERIES} stroke="white" strokeWidth={1.5} />
    </svg>
  );
}

/**
 * Counts a formatted value up from zero when it enters view: "$1,892.50", "15", "4.8", "100%".
 * Anything that isn't a plain formatted number renders unchanged.
 */
export function AnimatedValue({ value }: { value: React.ReactNode }) {
  if (typeof value !== "string" && typeof value !== "number") return <>{value}</>;
  const str = String(value);
  const m = str.match(/^([^\d-]*)(-?\d[\d,]*(?:\.\d+)?)(.*)$/);
  if (!m) return <>{str}</>;
  const [, prefix, num, suffix] = m;
  const decimals = num.includes(".") ? num.split(".")[1].length : 0;
  const target = Number(num.replace(/,/g, ""));
  if (!Number.isFinite(target)) return <>{str}</>;
  return (
    <>
      <span className="sr-only">{str}</span>
      <span aria-hidden>
        <CountUp
          value={target}
          duration={1.1}
          format={(n) => `${prefix}${n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`}
        />
      </span>
    </>
  );
}

const TILE_TINTS = ["bg-brand-soft text-ink", "bg-sky-soft text-ink", "bg-yellow-soft text-ink", "bg-teal-soft text-ink", "bg-violet-soft text-ink", "bg-peach-soft text-ink"];
/** Stable light tint for a tile, picked from its label. */
function tileTint(label: string): string {
  return TILE_TINTS[[...label].reduce((a, c) => a + c.charCodeAt(0), 0) % TILE_TINTS.length];
}

/** Stat tile: label · value · optional delta vs a named period · optional sparkline. */
export function StatTile({
  label,
  value,
  delta,
  deltaLabel = "vs last month",
  upIsGood = true,
  trend,
  icon,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  delta?: number; // percent
  deltaLabel?: string;
  upIsGood?: boolean;
  trend?: number[];
  icon?: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  const good = delta === undefined ? null : delta === 0 ? null : (delta > 0) === upIsGood;
  return (
    <div data-spotlight className={cn("rounded-xl border border-line bg-surface p-5 shadow-xs transition-[border-color,box-shadow] duration-300 hover:shadow-sm", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        {icon && <span className={cn("grid size-8 place-items-center rounded-lg [&_svg]:size-4", tileTint(label))}>{icon}</span>}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-[26px] font-semibold leading-none tracking-tight text-ink"><AnimatedValue value={value} /></p>
        {trend && trend.length > 1 && <Sparkline values={trend} />}
      </div>
      {(delta !== undefined || hint) && (
        <p className="mt-2.5 flex items-center gap-1.5 text-[12px] text-muted">
          {delta !== undefined && (
            <span className={cn("inline-flex items-center gap-0.5 font-medium tabular-nums", good === null ? "text-muted" : good ? "text-success" : "text-danger")}>
              {delta >= 0 ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
              {delta > 0 ? "+" : ""}
              {delta}%
            </span>
          )}
          {delta !== undefined && <span>{deltaLabel}</span>}
          {hint}
        </p>
      )}
    </div>
  );
}

/** Horizontal single-hue bars for ranked categories (e.g. top subjects). */
export function BarList({ data, format = (n) => n.toLocaleString("en-US") }: { data: Datum[]; format?: (n: number) => string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="space-y-3">
      {data.map((d, i) => (
        <li key={d.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-[13px]">
          <span className="truncate text-ink-2">{d.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-sunken">
            <motion.span
              className="block h-full rounded-full bg-brand-gradient"
              initial={{ width: 0 }}
              whileInView={{ width: `${(d.value / max) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: i * 0.05 }}
            />
          </span>
          <span className="tabular-nums font-medium text-ink">{format(d.value)}</span>
        </li>
      ))}
    </ul>
  );
}
