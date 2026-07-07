"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DonutChart, type DonutDatum } from "@/components/charts/DonutChart";
import { CategoryGlyph } from "@/components/category-glyph";
import { formatCents, cn } from "@/lib/utils";

export type SpendingSlice = {
  // null id => non-clickable rollup ("Other"); "uncategorized" => links to the
  // uncategorized filter. A number is a real category id.
  id: number | "uncategorized" | null;
  name: string;
  value: number;
  color: string;
  icon?: string | null;
};

function hrefFor(id: SpendingSlice["id"]): string | null {
  if (typeof id === "number") return `/transactions?cat=${id}`;
  if (id === "uncategorized") return "/transactions?cat=uncategorized";
  return null;
}

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
  const router = useRouter();
  const [active, setActive] = useState<DonutDatum | null>(null);
  const donutData: DonutDatum[] = slices.map((s) => ({
    name: s.name,
    value: s.value,
    color: s.color,
    href: hrefFor(s.id),
  }));
  const activePct =
    active && consumption > 0
      ? Math.round((active.value / consumption) * 100)
      : 0;
  // "What's left" = income not yet committed this month. Money moved to savings
  // is already allocated, so it counts against income alongside consumption — a
  // dollar saved is not a dollar still free to spend. Goes negative (and red)
  // when consumption + savings tops income. The flow bar shows both segments:
  // consumption (blush) and savings (blue), with the remainder left empty.
  const committed = consumption + saved;
  const remaining = income - committed;
  const over = remaining < 0;
  const consumptionShare = income > 0 ? Math.min(1, consumption / income) : 0;
  const savedShare =
    income > 0 ? Math.max(0, Math.min(1 - consumptionShare, saved / income)) : 0;
  const pctLeft =
    income > 0 ? Math.max(0, Math.round((remaining / income) * 100)) : null;

  return (
    <section className="rise overflow-hidden rounded-[28px] border border-border bg-surface/85 p-6 backdrop-blur-sm shadow-[0_30px_70px_-40px_rgba(34,28,74,0.45)] md:p-8">
      {consumption <= 0 ? (
        <div className="py-16 text-center text-sm text-foreground-faint">
          No spending recorded yet this month.
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center gap-6 md:flex-row md:items-center md:gap-14 lg:gap-20">
            {/* LEFT — interactive donut */}
            <div
              className="relative shrink-0"
              style={{ width: 420, height: 420 }}
              onMouseLeave={() => setActive(null)}
            >
              <DonutChart
                data={donutData}
                size={420}
                thickness={60}
                formatValue={formatCents}
                showTooltip={false}
                onActiveChange={setActive}
                onSliceClick={(d) => d.href && router.push(d.href)}
              />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-16 text-center">
                {active ? (
                  <>
                    <span
                      className="mb-1 max-w-full truncate text-[11px] font-semibold uppercase tracking-[0.2em]"
                      style={{ color: active.color }}
                    >
                      {active.name}
                    </span>
                    <span className="display text-[2.4rem] leading-none">
                      {formatCents(active.value)}
                    </span>
                    <span className="mt-1.5 text-[12px] text-foreground-faint">
                      {activePct}%
                    </span>
                  </>
                ) : (
                  <>
                    <span className="mb-0.5 text-[11px] uppercase tracking-[0.28em] text-foreground-faint">
                      spent
                    </span>
                    <span className="display text-[2.6rem] leading-none">
                      {formatCents(consumption)}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* RIGHT — numbers */}
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-6">
              {/* Primary — total spent */}
              <div>
                <div
                  className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em]"
                  style={{ color: "var(--blush-deep)" }}
                >
                  Total spent
                </div>
                <div className="display text-[3.4rem] leading-none text-foreground md:text-[4rem]">
                  {formatCents(consumption)}
                </div>
              </div>

              {/* Flow bar — how much of income is spent vs. left this month */}
              {income > 0 && (
                <div className="space-y-2.5">
                  <div
                    className="flex h-2.5 w-full overflow-hidden rounded-full"
                    style={{ background: "var(--surface-2)" }}
                  >
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${consumptionShare * 100}%`,
                        background: over ? "var(--blush-deep)" : "var(--blush)",
                      }}
                    />
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${savedShare * 100}%`,
                        background: "var(--blue)",
                      }}
                    />
                  </div>
                  <div className="flex items-baseline justify-between gap-3 text-[14px]">
                    <span className="text-foreground-muted">
                      <span
                        className="display text-[1.05rem]"
                        style={{
                          color: over
                            ? "var(--blush-deep)"
                            : "var(--blue-deep)",
                        }}
                      >
                        {formatCents(Math.abs(remaining))}
                      </span>{" "}
                      {over ? "over income" : "left to spend"}
                    </span>
                    {pctLeft !== null && (
                      <span className="shrink-0 text-foreground-faint">
                        {over ? "0" : pctLeft}% of income
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Secondary: saved + income */}
              <div className="flex gap-10">
                <MiniStat
                  label="Saved"
                  value={formatCents(saved)}
                  accent="var(--blue-deep)"
                />
                <MiniStat
                  label="Income"
                  value={formatCents(income)}
                  accent="var(--sage-deep)"
                />
              </div>
            </div>
          </div>

          {/* Legend — icon chips below the main layout */}
          {slices.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 border-t border-border/40 pt-4">
              {slices.map((s, i) => {
                const href = hrefFor(s.id);
                const inner = (
                  <span className="flex items-center gap-1.5 text-[12px] tracking-tight">
                    <CategoryGlyph icon={s.icon} color={s.color} size={18} />
                    <span className="truncate text-foreground-muted">{s.name}</span>
                  </span>
                );
                return href ? (
                  <Link
                    key={s.id}
                    href={href}
                    className="rounded-md px-1 py-0.5 transition-colors hover:text-foreground"
                  >
                    {inner}
                  </Link>
                ) : (
                  <span key={`x-${i}`} className="px-1 py-0.5">
                    {inner}
                  </span>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div>
      <div
        className="mb-1 text-[9px] font-semibold uppercase tracking-[0.2em]"
        style={{ color: accent }}
      >
        {label}
      </div>
      <div className={cn("display text-[1.75rem] leading-none text-foreground md:text-[2rem]")}>
        {value}
      </div>
    </div>
  );
}
