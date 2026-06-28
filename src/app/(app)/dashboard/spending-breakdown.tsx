"use client";

import Link from "next/link";
import { DonutChart, type DonutDatum } from "@/components/charts/DonutChart";
import { CategoryGlyph } from "@/components/category-glyph";
import { formatCents, cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";

export type SpendingSlice = {
  // null id => non-clickable rollup ("Other"); "uncategorized" => links to the
  // uncategorized filter. A number is a real category id.
  id: number | "uncategorized" | null;
  name: string;
  value: number;
  color: string;
  icon?: string | null;
};

// The dashboard hero. One bold panel that answers "where did my money go":
// a KPI strip (spent / saved / income) over a big donut and a ranked set of
// chunky, animated category bars. Bars scale to the biggest category so the
// ranking reads as a graphic; the % is each category's share of total spend.
export function SpendingHero({
  slices,
  consumption,
  saved,
  income,
}: {
  slices: SpendingSlice[];
  consumption: number;
  saved: number;
  income: number;
}) {
  const donutData: DonutDatum[] = slices.map((s) => ({
    name: s.name,
    value: s.value,
    color: s.color,
  }));
  const maxValue = slices.reduce((m, s) => Math.max(m, s.value), 1);
  const pct = (v: number) =>
    consumption > 0 ? Math.round((v / consumption) * 100) : 0;

  return (
    <section className="rise overflow-hidden rounded-[28px] border border-border bg-surface/85 backdrop-blur-sm shadow-[0_30px_70px_-40px_rgba(34,28,74,0.45)]">
      {/* KPI STRIP */}
      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Kpi label="Spent" value={formatCents(consumption)} accent="var(--blush-deep)" dominant />
        <Kpi label="Saved" value={formatCents(saved)} accent="var(--blue-deep)" />
        <Kpi label="Income" value={formatCents(income)} accent="var(--sage-deep)" />
      </div>

      {/* SPENDING VIZ */}
      <div className="border-t border-border bg-surface/60 p-5 md:p-7">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2 className="display text-lg tracking-tight md:text-[1.5rem]">
            Where your money went
          </h2>
          <span className="hidden text-[11px] tracking-tight text-foreground-faint sm:block">
            this month · tap a category to see what&apos;s inside
          </span>
        </div>

        {consumption <= 0 ? (
          <div className="py-10 text-center text-sm text-foreground-faint">
            No spending recorded yet this month.
          </div>
        ) : (
          <div className="grid items-center gap-6 lg:grid-cols-[auto_1fr] lg:gap-10">
            {/* Donut with display-font center */}
            <div
              className="relative mx-auto shrink-0"
              style={{ width: 196, height: 196 }}
            >
              <DonutChart
                data={donutData}
                size={196}
                thickness={24}
                formatValue={formatCents}
              />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="mb-0.5 text-[9px] uppercase tracking-[0.28em] text-foreground-faint">
                  spent
                </span>
                <span className="display text-[1.7rem] leading-none">
                  {formatCents(consumption)}
                </span>
              </div>
            </div>

            {/* Ranked category bars */}
            <div className="min-w-0 space-y-3">
              {slices.map((s, i) => {
                const widthPct = (s.value / maxValue) * 100;
                const isLink = s.id !== null;
                const body = (
                  <div className="flex items-center gap-3">
                    <CategoryGlyph
                      icon={s.icon}
                      color={s.color}
                      size={38}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-baseline justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium tracking-tight">
                          <span className="truncate">{s.name}</span>
                          {isLink && (
                            <ArrowUpRight
                              className="size-3.5 -translate-x-1 text-foreground-faint opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
                              strokeWidth={2}
                            />
                          )}
                        </span>
                        <span className="flex shrink-0 items-baseline gap-2.5">
                          <span className="display text-base md:text-lg">
                            {formatCents(s.value)}
                          </span>
                          <span className="mono tabular w-9 text-right text-[11px] text-foreground-faint">
                            {pct(s.value)}%
                          </span>
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="grow-x h-full rounded-full"
                          style={
                            {
                              width: `${widthPct}%`,
                              background: `linear-gradient(90deg, ${s.color}, color-mix(in srgb, ${s.color} 62%, white))`,
                              "--i": i,
                            } as React.CSSProperties
                          }
                        />
                      </div>
                    </div>
                  </div>
                );

                if (!isLink) {
                  return (
                    <div key={`other-${i}`} className="px-1">
                      {body}
                    </div>
                  );
                }
                return (
                  <Link
                    key={s.id}
                    href={`/transactions?cat=${s.id}`}
                    className={cn(
                      "group -mx-2 block rounded-xl px-2 py-1.5 transition-colors",
                      "hover:bg-surface-2/50",
                    )}
                  >
                    {body}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Kpi({
  label,
  value,
  accent,
  dominant = false,
}: {
  label: string;
  value: string;
  accent: string;
  dominant?: boolean;
}) {
  return (
    <div className="relative flex flex-col gap-2 px-6 py-4 md:py-5">
      {dominant && (
        <span
          className="absolute left-0 top-5 h-7 w-[3px] rounded-full"
          style={{ background: accent }}
        />
      )}
      <span
        className="text-[10px] font-semibold uppercase tracking-[0.2em]"
        style={{ color: accent }}
      >
        {label}
      </span>
      <div
        className={cn(
          "display leading-none text-foreground",
          dominant ? "text-[2.1rem] md:text-[2.5rem]" : "text-[1.9rem] md:text-[2.1rem]",
        )}
      >
        {value}
      </div>
    </div>
  );
}
