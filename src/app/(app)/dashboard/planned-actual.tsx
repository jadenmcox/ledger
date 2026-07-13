"use client";

import { useState } from "react";
import { CategoryGlyph } from "@/components/category-glyph";
import { ProgressBar } from "@/components/ui";
import { formatCents, cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

export type PlannedRow = {
  id: number;
  name: string;
  color: string;
  icon: string;
  planned: number;
  actual: number;
  difference: number;
};

export type MerchantTotal = { merchant: string; total: number; count: number };

type Group = { key: string; label: string; rows: PlannedRow[] };
type Totals = { planned: number; actual: number; difference: number };

// The Planned-vs-actual table. Each category row with spend this month expands
// to show its spend combined by vendor (one total per merchant, biggest first).
export function PlannedActual({
  groups,
  totals,
  merchantsByCategory,
}: {
  groups: Group[];
  totals: Totals;
  merchantsByCategory: Record<number, MerchantTotal[]>;
}) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (id: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-[10px] tracking-[0.18em] uppercase text-foreground-faint border-b border-border">
          <th className="text-left px-3.5 sm:px-5 py-3 font-medium">Category</th>
          <th className="text-right px-2.5 sm:px-3 py-3 font-medium hidden sm:table-cell">
            Planned
          </th>
          <th className="text-right px-2.5 sm:px-3 py-3 font-medium">Actual</th>
          <th className="text-right px-3.5 sm:px-5 py-3 font-medium">Difference</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) =>
          g.rows.length === 0 ? null : (
            <RowGroup
              key={g.key}
              label={g.label}
              rows={g.rows}
              open={open}
              toggle={toggle}
              merchantsByCategory={merchantsByCategory}
            />
          ),
        )}
        <tr className="border-t-2 border-border bg-surface-2/40">
          <td className="px-3.5 sm:px-5 py-3 text-sm font-medium tracking-tight">Total</td>
          <td className="px-2.5 sm:px-3 py-3 text-right mono tabular hidden sm:table-cell">
            {formatCents(totals.planned)}
          </td>
          <td className="px-2.5 sm:px-3 py-3 text-right mono tabular">
            {formatCents(totals.actual)}
          </td>
          <td
            className={cn(
              "px-3.5 sm:px-5 py-3 text-right mono tabular",
              totals.difference < 0 && "text-blush-deep",
            )}
          >
            {totals.difference >= 0 ? "+" : ""}
            {formatCents(totals.difference)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function RowGroup({
  label,
  rows,
  open,
  toggle,
  merchantsByCategory,
}: {
  label: string;
  rows: PlannedRow[];
  open: Set<number>;
  toggle: (id: number) => void;
  merchantsByCategory: Record<number, MerchantTotal[]>;
}) {
  const subtotal = rows.reduce(
    (acc, r) => ({
      planned: acc.planned + r.planned,
      actual: acc.actual + r.actual,
      difference: acc.difference + r.difference,
    }),
    { planned: 0, actual: 0, difference: 0 },
  );
  return (
    <>
      <tr className="bg-surface-2/30 border-t border-border">
        <td
          colSpan={4}
          className="px-3.5 sm:px-5 py-2 text-[10px] tracking-[0.2em] uppercase text-foreground-faint"
        >
          {label}
        </td>
      </tr>
      {rows.map((r) => {
        const over = r.planned > 0 && r.actual > r.planned;
        const merchants = merchantsByCategory[r.id] ?? [];
        const expandable = merchants.length > 0;
        const isOpen = open.has(r.id);
        return (
          <RowFragment
            key={r.id}
            row={r}
            over={over}
            merchants={merchants}
            expandable={expandable}
            isOpen={isOpen}
            onToggle={() => expandable && toggle(r.id)}
          />
        );
      })}
      <tr className="border-t border-border bg-surface-2/10">
        <td className="px-3.5 sm:px-5 py-2 text-[11px] text-foreground-faint tracking-tight">
          {label} subtotal
        </td>
        <td className="px-2.5 sm:px-3 py-2 text-right mono tabular text-foreground-faint text-[11px] hidden sm:table-cell">
          {formatCents(subtotal.planned)}
        </td>
        <td className="px-2.5 sm:px-3 py-2 text-right mono tabular text-foreground-faint text-[11px]">
          {formatCents(subtotal.actual)}
        </td>
        <td
          className={cn(
            "px-3.5 sm:px-5 py-2 text-right mono tabular text-[11px]",
            subtotal.difference < 0 ? "text-blush-deep" : "text-foreground-faint",
          )}
        >
          {subtotal.difference >= 0 ? "+" : ""}
          {formatCents(subtotal.difference)}
        </td>
      </tr>
    </>
  );
}

function RowFragment({
  row,
  over,
  merchants,
  expandable,
  isOpen,
  onToggle,
}: {
  row: PlannedRow;
  over: boolean;
  merchants: MerchantTotal[];
  expandable: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className={cn(
          "border-t border-border transition-colors",
          expandable && "cursor-pointer hover:bg-surface-2/40",
          isOpen && "bg-surface-2/40",
        )}
        onClick={onToggle}
      >
        <td className="px-3.5 sm:px-5 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <CategoryGlyph icon={row.icon} color={row.color} size={30} />
            <span className="truncate">{row.name}</span>
            {expandable && (
              <ChevronRight
                className={cn(
                  "size-3.5 shrink-0 text-foreground-faint transition-transform",
                  isOpen && "rotate-90",
                )}
                strokeWidth={2}
              />
            )}
          </div>
          {row.planned > 0 && (
            <div className="ml-[42px] mt-2 max-w-[120px] sm:max-w-[160px]">
              <ProgressBar
                value={row.actual}
                max={row.planned}
                color={row.color}
                height={4}
              />
            </div>
          )}
        </td>
        <td className="px-2.5 sm:px-3 py-3 text-right mono tabular text-foreground-muted hidden sm:table-cell">
          {row.planned > 0 ? formatCents(row.planned) : "—"}
        </td>
        <td
          className={cn("px-2.5 sm:px-3 py-3 text-right mono tabular", over && "text-blush-deep")}
        >
          {formatCents(row.actual)}
        </td>
        <td
          className={cn(
            "px-3.5 sm:px-5 py-3 text-right mono tabular",
            row.difference < 0 && "text-blush-deep",
          )}
        >
          {row.planned === 0 ? (
            <span className="text-foreground-faint">no limit</span>
          ) : (
            <>
              {row.difference >= 0 ? "+" : ""}
              {formatCents(row.difference)}
            </>
          )}
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-surface-2/20">
          <td colSpan={4} className="px-3.5 sm:px-5 pb-3.5 pt-0">
            <div className="ml-[42px] overflow-hidden rounded-xl border border-border bg-surface">
              <div className="px-3.5 py-2 text-[10px] uppercase tracking-[0.2em] text-foreground-faint border-b border-border">
                by vendor
              </div>
              {merchants.map((m) => (
                <div
                  key={m.merchant}
                  className="flex items-center justify-between gap-3 px-3.5 py-2 border-t border-border first:border-t-0"
                >
                  <span className="min-w-0 truncate text-[13px] text-foreground-muted">
                    {m.merchant}
                    {m.count > 1 && (
                      <span className="ml-1.5 text-foreground-faint">
                        ×{m.count}
                      </span>
                    )}
                  </span>
                  <span className="mono tabular shrink-0 text-[13px]">
                    {formatCents(m.total)}
                  </span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
