"use client";

import { useState } from "react";
import { DonutChart, type DonutDatum } from "@/components/charts/DonutChart";
import { CategoryGlyph } from "@/components/category-glyph";
import { formatCents, cn } from "@/lib/utils";

export type SpendSlice = {
  id: number;
  name: string;
  value: number; // spent this month in cents
  color: string;
  icon?: string | null;
};

// The Categories hero. Left = three quick numbers (spent / buckets /
// limits set). Right = big interactive donut of this-month spend by
// category — mirroring the dashboard's SpendingHero but click scrolls
// to + expands that category's row in the list below instead of
// navigating away.
export function CategoriesHero({
  slices,
  totalSpent,
  categoryCount,
  limitsSet,
  onSliceClick,
}: {
  slices: SpendSlice[];
  totalSpent: number;
  categoryCount: number;
  limitsSet: number;
  onSliceClick: (id: number) => void;
}) {
  const [active, setActive] = useState<SpendSlice | null>(null);

  // href must be truthy for DonutChart's onSliceClick to fire; navigation is
  // handled by the onSliceClick prop (scroll to row), not by the href itself.
  const donutData: DonutDatum[] = slices.map((s) => ({
    name: s.name,
    value: s.value,
    color: s.color,
    href: "#",
  }));

  const activePct =
    active && totalSpent > 0
      ? Math.round((active.value / totalSpent) * 100)
      : 0;

  return (
    <section className="rise overflow-hidden rounded-[28px] border border-border bg-surface/85 p-6 backdrop-blur-sm shadow-[0_30px_70px_-40px_rgba(34,28,74,0.45)] md:p-9">
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(200px,0.85fr)_auto] lg:gap-14">
        {/* LEFT — three quick numbers */}
        <div className="flex flex-col gap-6 md:gap-7">
          <Stat
            label="Spent this month"
            value={formatCents(totalSpent)}
            accent="var(--blush-deep)"
            dominant
          />
          <Stat
            label="Buckets"
            value={String(categoryCount)}
            accent="var(--blue-deep)"
          />
          <Stat
            label="With a limit"
            value={`${limitsSet} of ${categoryCount}`}
            accent="var(--sage-deep)"
            hint="set limits on Budget"
          />
        </div>

        {/* RIGHT — big interactive donut + icon legend */}
        <div className="flex flex-col items-center gap-6">
          <div className="flex w-full items-baseline justify-between gap-3">
            <h2 className="display text-lg tracking-tight md:text-xl">
              Where it went this month
            </h2>
            <span className="text-[11px] tracking-tight text-foreground-faint">
              hover · click to jump
            </span>
          </div>

          {totalSpent <= 0 ? (
            <div className="py-16 text-center text-sm text-foreground-faint">
              No spending recorded yet this month.
            </div>
          ) : (
            <>
              <div
                className="relative"
                style={{ width: 300, height: 300 }}
                onMouseLeave={() => setActive(null)}
              >
                <DonutChart
                  data={donutData}
                  size={300}
                  thickness={40}
                  formatValue={formatCents}
                  showTooltip={false}
                  onActiveChange={(d) =>
                    setActive(slices.find((s) => s.name === d.name) ?? null)
                  }
                  onSliceClick={(d) => {
                    const s = slices.find((x) => x.name === d.name);
                    if (s) onSliceClick(s.id);
                  }}
                />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-12 text-center">
                  {active ? (
                    <>
                      <span
                        className="mb-1.5 max-w-full truncate text-[11px] font-semibold uppercase tracking-[0.18em]"
                        style={{ color: active.color }}
                      >
                        {active.name}
                      </span>
                      <span className="display text-[2rem] leading-none">
                        {formatCents(active.value)}
                      </span>
                      <span className="mt-1.5 text-[11px] text-foreground-faint">
                        {activePct}% of spending
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="mb-1 text-[10px] uppercase tracking-[0.28em] text-foreground-faint">
                        spent
                      </span>
                      <span className="display text-[2.3rem] leading-none">
                        {formatCents(totalSpent)}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Legend — icon chip per slice, click scrolls to category row */}
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2.5">
                {slices.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onSliceClick(s.id)}
                    className="rounded-lg px-1 py-0.5 transition-colors hover:text-foreground"
                  >
                    <span className="flex items-center gap-2 text-[13px] tracking-tight">
                      <CategoryGlyph icon={s.icon} color={s.color} size={22} />
                      <span className="truncate text-foreground-muted">{s.name}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
  hint,
  dominant = false,
}: {
  label: string;
  value: string;
  accent: string;
  hint?: string;
  dominant?: boolean;
}) {
  return (
    <div className={cn("relative", dominant && "pl-4")}>
      {dominant && (
        <span
          className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full"
          style={{ background: accent }}
        />
      )}
      <div
        className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em]"
        style={{ color: accent }}
      >
        {label}
      </div>
      <div
        className={cn(
          "display leading-none text-foreground",
          dominant ? "text-[2.4rem] md:text-[3rem]" : "text-[1.8rem] md:text-[2.1rem]",
        )}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-1.5 text-[11px] text-foreground-faint">{hint}</div>
      )}
    </div>
  );
}
