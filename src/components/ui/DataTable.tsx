"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Checkbox } from "./Controls";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  /** Sort value; when provided the column header becomes sortable. */
  sortValue?: (row: T) => string | number;
  /** Hide on the stacked mobile layout (e.g. redundant columns). */
  hideOnMobile?: boolean;
  align?: "left" | "right";
}

/**
 * Responsive table: a real <table> on desktop, stacked cards on small screens.
 * Supports client-side sorting, pagination, row selection (for bulk actions) and row click.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  empty,
  pageSize = 10,
  selectable,
  selected,
  onSelectedChange,
  className,
  mobileTitle,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: React.ReactNode;
  pageSize?: number;
  selectable?: boolean;
  selected?: string[];
  onSelectedChange?: (ids: string[]) => void;
  className?: string;
  /** Column key to use as the card heading on mobile. Defaults to the first column. */
  mobileTitle?: string;
}) {
  const [sort, setSort] = React.useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = React.useState(0);

  const sorted = React.useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rows, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = sorted.slice(current * pageSize, current * pageSize + pageSize);
  const sel = new Set(selected ?? []);
  const allVisibleSelected = visible.length > 0 && visible.every((r) => sel.has(rowKey(r)));

  // Back to the first page whenever the row set changes size (e.g. a filter was applied).
  const [lastCount, setLastCount] = React.useState(rows.length);
  if (lastCount !== rows.length) {
    setLastCount(rows.length);
    setPage(0);
  }

  if (!rows.length) return <div className={cn("rounded-xl border border-line bg-surface", className)}>{empty}</div>;

  const titleCol = columns.find((c) => c.key === mobileTitle) ?? columns[0];

  return (
    <div className={cn("overflow-hidden rounded-xl border border-line bg-surface shadow-xs", className)}>
      {/* Desktop */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-canvas/70">
              {selectable && (
                <th className="w-10 px-4 py-3">
                  <Checkbox
                    aria-label="Select all on this page"
                    checked={allVisibleSelected ? true : visible.some((r) => sel.has(rowKey(r))) ? "indeterminate" : false}
                    onCheckedChange={(v) => {
                      const ids = visible.map(rowKey);
                      onSelectedChange?.(v ? Array.from(new Set([...sel, ...ids])) : [...sel].filter((x) => !ids.includes(x)));
                    }}
                  />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn("whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-muted", c.align === "right" && "text-right", c.className)}>
                  {c.sortValue ? (
                    <button
                      type="button"
                      className={cn("inline-flex items-center gap-1 hover:text-ink", c.align === "right" && "flex-row-reverse")}
                      onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === "asc" ? "desc" : "asc" } : { key: c.key, dir: "asc" }))}
                    >
                      {c.header}
                      {sort?.key === c.key ? sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-50" />}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, index) => {
              const id = rowKey(row);
              return (
                <motion.tr
                  key={id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: Math.min(index, 12) * 0.025 }}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.target !== e.currentTarget) return; // let inner buttons/checkboxes handle their own keys
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                  className={cn(
                    "border-b border-line last:border-0 transition-colors",
                    onRowClick && "cursor-pointer hover:bg-canvas/70 focus-visible:bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-navy",
                    sel.has(id) && "bg-navy-50/50",
                  )}
                >
                  {selectable && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        aria-label="Select row"
                        checked={sel.has(id)}
                        onCheckedChange={(v) => onSelectedChange?.(v ? [...sel, id] : [...sel].filter((x) => x !== id))}
                      />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-4 py-3 align-middle text-ink-2", c.align === "right" && "text-right tabular-nums", c.className)}>
                      {c.cell(row)}
                    </td>
                  ))}
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="divide-y divide-line md:hidden">
        {visible.map((row, index) => {
          const id = rowKey(row);
          return (
            <motion.li key={id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: Math.min(index, 12) * 0.025 }}>
              <div
                role={onRowClick ? "button" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (e) => e.key === "Enter" && onRowClick(row) : undefined}
                className={cn("block w-full px-4 py-3.5 text-left", onRowClick && "active:bg-canvas")}
              >
                <div className="flex items-start gap-3">
                  {selectable && (
                    <span onClick={(e) => e.stopPropagation()} className="pt-0.5">
                      <Checkbox aria-label="Select row" checked={sel.has(id)} onCheckedChange={(v) => onSelectedChange?.(v ? [...sel, id] : [...sel].filter((x) => x !== id))} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink">{titleCol.cell(row)}</div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {columns
                        .filter((c) => c.key !== titleCol.key && !c.hideOnMobile)
                        .map((c) => (
                          <div key={c.key} className="min-w-0">
                            <dt className="text-[11px] text-muted">{c.header}</dt>
                            <dd className="truncate text-[13px] text-ink-2">{c.cell(row)}</dd>
                          </div>
                        ))}
                    </dl>
                  </div>
                </div>
              </div>
            </motion.li>
          );
        })}
      </ul>

      {pages > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-[13px] text-muted">
          <span className="tabular-nums">
            {current * pageSize + 1}–{Math.min(sorted.length, (current + 1) * pageSize)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} className="grid size-8 place-items-center rounded-md border border-line hover:bg-canvas disabled:opacity-40" aria-label="Previous page">
              <ChevronLeft className="size-4" />
            </button>
            <span className="px-2 tabular-nums">
              {current + 1} / {pages}
            </span>
            <button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="grid size-8 place-items-center rounded-md border border-line hover:bg-canvas disabled:opacity-40" aria-label="Next page">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
