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

export function NetWorthArea({
  data,
}: {
  data: Array<{ x: string; networth: number }>;
}) {
  return (
    <AreaChart
      data={data}
      series={[{ key: "networth", name: "Net worth", color: "var(--blue)" }]}
      height={240}
      formatValue={(v) => formatCentsCompact(Math.round(v * 100))}
      formatX={(v) => {
        const d = new Date(String(v) + "T00:00:00");
        return d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      }}
    />
  );
}

export { formatCents };
