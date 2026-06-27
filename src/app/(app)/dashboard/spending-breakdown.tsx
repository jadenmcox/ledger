"use client";

import Link from "next/link";
import { Card, SectionHeader, ProgressBar } from "@/components/ui";
import { DonutChart, type DonutDatum } from "@/components/charts/DonutChart";
import { formatCents } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

export type SpendingSlice = {
  // null id => non-clickable rollup ("Other"); "uncategorized" => links to the
  // uncategorized filter. A number is a real category id.
  id: number | "uncategorized" | null;
  name: string;
  value: number;
  color: string;
};

// "Where your money went": a donut of this month's spending by category beside
// a ranked, clickable list. Replaces the old needs/wants composition bar — this
// answers "where did it actually go" instead of "what type was it". The slices
// sum to `consumption` (the "Spent this month" headline); an Uncategorized /
// Other slice closes any gap so the picture is honest.
export function SpendingBreakdown({
  slices,
  consumption,
}: {
  slices: SpendingSlice[];
  consumption: number;
}) {
  const donutData: DonutDatum[] = slices.map((s) => ({
    name: s.name,
    value: s.value,
    color: s.color,
  }));

  const pct = (v: number) =>
    consumption > 0 ? Math.round((v / consumption) * 100) : 0;

  return (
    <Card className="p-6 md:p-7">
      <SectionHeader
        title="Where your money went"
        hint="this month's spending by category — tap one to see what's in it"
      />

      {consumption <= 0 ? (
        <div className="py-10 text-center text-sm text-foreground-faint">
          No spending recorded yet this month.
        </div>
      ) : (
        <div className="flex flex-col md:flex-row md:items-center gap-8 md:gap-10">
          <div className="shrink-0 mx-auto md:mx-0">
            <DonutChart
              data={donutData}
              size={220}
              thickness={26}
              centerLabel="spent"
              centerValue={formatCents(consumption)}
              formatValue={formatCents}
            />
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            {slices.map((s, i) => {
              const row = (
                <div className="flex items-center gap-3 py-2.5">
                  <span
                    className="size-2.5 rounded-full shrink-0"
                    style={{ background: s.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm tracking-tight truncate flex items-center gap-1.5">
                        {s.name}
                        {s.id !== null && (
                          <ArrowRight
                            className="size-3 text-foreground-faint opacity-0 group-hover:opacity-100 transition-opacity"
                            strokeWidth={1.5}
                          />
                        )}
                      </span>
                      <span className="mono tabular text-sm shrink-0">
                        {formatCents(s.value)}
                        <span className="text-foreground-faint text-[11px] ml-1.5">
                          {pct(s.value)}%
                        </span>
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <ProgressBar
                        value={s.value}
                        max={consumption}
                        color={s.color}
                        warnAt={2}
                        height={3}
                      />
                    </div>
                  </div>
                </div>
              );

              if (s.id === null) {
                return (
                  <div key={`other-${i}`} className="px-1">
                    {row}
                  </div>
                );
              }
              return (
                <Link
                  key={s.id}
                  href={`/transactions?cat=${s.id}`}
                  className="group block px-1 rounded-lg hover:bg-surface-2/40 transition-colors"
                >
                  {row}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
