"use client";

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

// The dashboard hero. The three month numbers (spent / saved / income)
// stacked on the left, a big interactive donut on the right. Hover a slice
// for its amount + share; click a slice (or a legend chip) to drill into that
// category's transactions.
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
  const donutData: DonutDatum[] = slices.map((s) => ({
    name: s.name,
    value: s.value,
    color: s.color,
    href: hrefFor(s.id),
  }));

  return (
    <section className="rise overflow-hidden rounded-[28px] border border-border bg-surface/85 p-6 backdrop-blur-sm shadow-[0_30px_70px_-40px_rgba(34,28,74,0.45)] md:p-9">
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(200px,0.85fr)_auto] lg:gap-14">
        {/* LEFT — the three numbers, stacked */}
        <div className="flex flex-col gap-6 md:gap-7">
          <Stat label="Spent" value={formatCents(consumption)} accent="var(--blush-deep)" dominant />
          <Stat label="Saved" value={formatCents(saved)} accent="var(--blue-deep)" />
          <Stat label="Income" value={formatCents(income)} accent="var(--sage-deep)" />
        </div>

        {/* RIGHT — big interactive donut + icon legend */}
        <div className="flex flex-col items-center gap-6">
          <div className="flex w-full items-baseline justify-between gap-3">
            <h2 className="display text-lg tracking-tight md:text-xl">
              Where your money went
            </h2>
            <span className="text-[11px] tracking-tight text-foreground-faint">
              hover · click to open
            </span>
          </div>

          {consumption <= 0 ? (
            <div className="py-16 text-center text-sm text-foreground-faint">
              No spending recorded yet this month.
            </div>
          ) : (
            <>
              <div className="relative" style={{ width: 300, height: 300 }}>
                <DonutChart
                  data={donutData}
                  size={300}
                  thickness={40}
                  formatValue={formatCents}
                  onSliceClick={(d) => d.href && router.push(d.href)}
                />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="mb-1 text-[10px] uppercase tracking-[0.28em] text-foreground-faint">
                    spent
                  </span>
                  <span className="display text-[2.3rem] leading-none">
                    {formatCents(consumption)}
                  </span>
                </div>
              </div>

              {/* Legend — icon chip per slice, clickable for real categories */}
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2.5">
                {slices.map((s, i) => {
                  const href = hrefFor(s.id);
                  const inner = (
                    <span className="flex items-center gap-2 text-[13px] tracking-tight">
                      <CategoryGlyph icon={s.icon} color={s.color} size={22} />
                      <span className="truncate text-foreground-muted">
                        {s.name}
                      </span>
                    </span>
                  );
                  return href ? (
                    <Link
                      key={s.id}
                      href={href}
                      className="rounded-lg px-1 py-0.5 transition-colors hover:text-foreground"
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
  dominant = false,
}: {
  label: string;
  value: string;
  accent: string;
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
          dominant
            ? "text-[2.4rem] md:text-[3rem]"
            : "text-[1.8rem] md:text-[2.1rem]",
        )}
      >
        {value}
      </div>
    </div>
  );
}
