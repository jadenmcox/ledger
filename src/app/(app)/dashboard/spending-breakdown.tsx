"use client";

import Link from "next/link";
import { DonutChart, type DonutDatum } from "@/components/charts/DonutChart";
import { formatCents, cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";

export type SpendingSlice = {
  // null id => non-clickable rollup ("Other"); "uncategorized" => links to the
  // uncategorized filter. A number is a real category id.
  id: number | "uncategorized" | null;
  name: string;
  value: number;
  color: string;
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
  plannedConsumption,
  txCount,
}: {
  slices: SpendingSlice[];
  consumption: number;
  saved: number;
  income: number;
  plannedConsumption: number;
  txCount: number;
}) {
  const donutData: DonutDatum[] = slices.map((s) => ({
    name: s.name,
    value: s.value,
    color: s.color,
  }));
  const maxValue = slices.reduce((m, s) => Math.max(m, s.value), 1);
  const pct = (v: number) =>
    consumption > 0 ? Math.round((v / consumption) * 100) : 0;
  const leftover = income - consumption;

  return (
    <section className="rise overflow-hidden rounded-[28px] border border-border bg-surface/85 backdrop-blur-sm shadow-[0_30px_70px_-40px_rgba(34,28,74,0.45)]">
      {/* KPI STRIP */}
      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Kpi
          label="Spent this month"
          value={formatCents(consumption)}
          hint={`of ${formatCents(plannedConsumption)} planned · ${txCount} transactions`}
          dot="var(--blush-deep)"
          dominant
        />
        <Kpi
          label="Saved this month"
          value={formatCents(saved)}
          hint="into savings & investments"
          dot="var(--blue-deep)"
        />
        <Kpi
          label="Income"
          value={formatCents(income)}
          hint={
            leftover >= 0
              ? `${formatCents(leftover)} left after spending`
              : `${formatCents(-leftover)} over income`
          }
          dot="var(--sage-deep)"
        />
      </div>

      {/* SPENDING VIZ */}
      <div className="border-t border-border bg-surface/60 p-6 md:p-9">
        <div className="mb-7 flex items-baseline justify-between gap-4">
          <h2 className="display text-xl tracking-tight md:text-[1.7rem]">
            Where your money went
          </h2>
          <span className="hidden text-[11px] tracking-tight text-foreground-faint sm:block">
            this month · tap a category to see what&apos;s inside
          </span>
        </div>

        {consumption <= 0 ? (
          <div className="py-12 text-center text-sm text-foreground-faint">
            No spending recorded yet this month.
          </div>
        ) : (
          <div className="grid items-center gap-9 lg:grid-cols-[auto_1fr] lg:gap-14">
            {/* Donut with display-font center */}
            <div
              className="relative mx-auto shrink-0"
              style={{ width: 244, height: 244 }}
            >
              <DonutChart
                data={donutData}
                size={244}
                thickness={30}
                formatValue={formatCents}
              />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="mb-1 text-[10px] uppercase tracking-[0.28em] text-foreground-faint">
                  spent
                </span>
                <span className="display text-[2rem] leading-none md:text-[2.3rem]">
                  {formatCents(consumption)}
                </span>
              </div>
            </div>

            {/* Ranked category bars */}
            <div className="min-w-0 space-y-4">
              {slices.map((s, i) => {
                const widthPct = (s.value / maxValue) * 100;
                const isLink = s.id !== null;
                const body = (
                  <>
                    <div className="mb-2 flex items-baseline justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2.5 text-sm font-medium tracking-tight">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: s.color }}
                        />
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
                  </>
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
  hint,
  dot,
  dominant = false,
}: {
  label: string;
  value: string;
  hint: string;
  dot: string;
  dominant?: boolean;
}) {
  return (
    <div className="px-6 py-6 md:px-8 md:py-7">
      <div className="mb-3 flex items-center gap-2">
        <span
          className="size-1.5 rounded-full"
          style={{ background: dot }}
        />
        <span className="text-[10px] uppercase tracking-[0.22em] text-foreground-faint">
          {label}
        </span>
      </div>
      <div
        className={cn(
          "display leading-none text-foreground",
          dominant ? "text-[2.6rem] md:text-[3.1rem]" : "text-4xl md:text-[2.6rem]",
        )}
      >
        {value}
      </div>
      <div className="mt-2.5 text-[11px] leading-relaxed text-foreground-faint">
        {hint}
      </div>
    </div>
  );
}
