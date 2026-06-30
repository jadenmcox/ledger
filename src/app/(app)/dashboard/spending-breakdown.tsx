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
  const incomeSharePct =
    income > 0 ? Math.round((consumption / income) * 100) : null;

  return (
    <section className="rise overflow-hidden rounded-[28px] border border-border bg-surface/85 p-6 backdrop-blur-sm shadow-[0_30px_70px_-40px_rgba(34,28,74,0.45)] md:p-8">
      {consumption <= 0 ? (
        <div className="py-16 text-center text-sm text-foreground-faint">
          No spending recorded yet this month.
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center gap-6 md:flex-row md:items-center md:gap-8 lg:gap-10">
            {/* LEFT — interactive donut */}
            <div
              className="relative shrink-0"
              style={{ width: 280, height: 280 }}
              onMouseLeave={() => setActive(null)}
            >
              <DonutChart
                data={donutData}
                size={280}
                thickness={46}
                formatValue={formatCents}
                showTooltip={false}
                onActiveChange={setActive}
                onSliceClick={(d) => d.href && router.push(d.href)}
              />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
                {active ? (
                  <>
                    <span
                      className="mb-1 max-w-full truncate text-[10px] font-semibold uppercase tracking-[0.2em]"
                      style={{ color: active.color }}
                    >
                      {active.name}
                    </span>
                    <span className="display text-[1.9rem] leading-none">
                      {formatCents(active.value)}
                    </span>
                    <span className="mt-1 text-[11px] text-foreground-faint">
                      {activePct}%
                    </span>
                  </>
                ) : (
                  <>
                    <span className="mb-0.5 text-[10px] uppercase tracking-[0.28em] text-foreground-faint">
                      spent
                    </span>
                    <span className="display text-[2rem] leading-none">
                      {formatCents(consumption)}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* RIGHT — numbers */}
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-5">
              {/* Primary */}
              <div>
                <div
                  className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.22em]"
                  style={{ color: "var(--blush-deep)" }}
                >
                  Total spent
                </div>
                <div className="display text-[2.8rem] leading-none text-foreground md:text-[3.2rem]">
                  {formatCents(consumption)}
                </div>
                {incomeSharePct !== null && (
                  <div className="mt-1.5 text-[13px] text-foreground-faint">
                    {incomeSharePct}% of income
                  </div>
                )}
              </div>

              {/* Secondary: saved + income */}
              <div className="flex gap-8">
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
      <div className={cn("display text-[1.55rem] leading-none text-foreground md:text-[1.75rem]")}>
        {value}
      </div>
    </div>
  );
}
