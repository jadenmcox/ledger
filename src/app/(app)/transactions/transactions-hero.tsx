"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DonutChart, type DonutDatum } from "@/components/charts/DonutChart";
import { CategoryGlyph } from "@/components/category-glyph";
import { formatCents, cn } from "@/lib/utils";

export type TxSlice = {
  id: number;
  name: string;
  value: number; // this-month spend in cents
  color: string;
  icon?: string | null;
};

export function TransactionsHero({
  slices,
  totalSpend,
  txCount,
  uncategorized,
  monthLabel,
}: {
  slices: TxSlice[];
  totalSpend: number;
  txCount: number;
  uncategorized: number;
  monthLabel: string;
}) {
  const router = useRouter();
  const [active, setActive] = useState<TxSlice | null>(null);

  const donutData: DonutDatum[] = slices.map((s) => ({
    name: s.name,
    value: s.value,
    color: s.color,
    href: `?cat=${s.id}`,
  }));

  const activePct =
    active && totalSpend > 0
      ? Math.round((active.value / totalSpend) * 100)
      : 0;

  return (
    <section className="rise overflow-hidden rounded-[28px] border border-border bg-surface/85 p-6 backdrop-blur-sm shadow-[0_30px_70px_-40px_rgba(34,28,74,0.45)] md:p-9">
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(200px,0.85fr)_auto] lg:gap-14">
        {/* LEFT */}
        <div className="flex flex-col gap-6 md:gap-7">
          <Stat
            label={`${monthLabel} spend`}
            value={formatCents(totalSpend)}
            accent="var(--blush-deep)"
            dominant
          />
          <Stat
            label="Transactions"
            value={String(txCount)}
            accent="var(--blue-deep)"
            hint="loaded (500 max)"
          />
          <Stat
            label="Uncategorized"
            value={String(uncategorized)}
            accent={uncategorized > 0 ? "var(--blush-deep)" : "var(--sage-deep)"}
            hint={uncategorized > 0 ? "tap a merchant to fix" : "all categorized"}
          />
        </div>

        {/* RIGHT */}
        <div className="flex flex-col items-center gap-6">
          <div className="flex w-full items-baseline justify-between gap-3">
            <h2 className="display text-lg tracking-tight md:text-xl">
              {monthLabel} by category
            </h2>
            <span className="text-[11px] tracking-tight text-foreground-faint">
              hover · click to filter
            </span>
          </div>

          {totalSpend <= 0 ? (
            <div className="py-16 text-center text-sm text-foreground-faint">
              No spending this month yet.
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
                  onSliceClick={(d) => d.href && router.push(d.href)}
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
                        {activePct}% of spend
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="mb-1 text-[10px] uppercase tracking-[0.28em] text-foreground-faint">
                        spent
                      </span>
                      <span className="display text-[2.3rem] leading-none">
                        {formatCents(totalSpend)}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2.5">
                {slices.map((s) => (
                  <Link
                    key={s.id}
                    href={`?cat=${s.id}`}
                    className="rounded-lg px-1 py-0.5 transition-colors hover:text-foreground"
                  >
                    <span className="flex items-center gap-2 text-[13px] tracking-tight">
                      <CategoryGlyph icon={s.icon} color={s.color} size={22} />
                      <span className="truncate text-foreground-muted">{s.name}</span>
                    </span>
                  </Link>
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
