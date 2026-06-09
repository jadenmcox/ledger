"use client";

import { AreaChart } from "@/components/charts/AreaChart";
import { formatCents, formatCentsCompact } from "@/lib/utils";

export function YearStackedArea({
  data,
}: {
  data: Array<{ x: string; need: number; want: number; savings: number }>;
}) {
  return (
    <AreaChart
      data={data}
      stacked
      series={[
        { key: "need", name: "Need", color: "var(--blush)" },
        { key: "want", name: "Want", color: "var(--peach)" },
        { key: "savings", name: "Savings", color: "var(--blue)" },
      ]}
      height={280}
      formatValue={(v) => formatCentsCompact(v)}
    />
  );
}

export { formatCents };
