"use client";

import { DonutChart, type DonutDatum } from "@/components/charts/DonutChart";
import { AreaChart } from "@/components/charts/AreaChart";
import { BarChart } from "@/components/charts/BarChart";
import { formatCents, formatCentsCompact } from "@/lib/utils";

export function CategoryDonut({
  data,
  total,
}: {
  data: DonutDatum[];
  total: number;
}) {
  return (
    <DonutChart
      data={data}
      centerLabel="Spent"
      centerValue={formatCentsCompact(total)}
      size={240}
      thickness={26}
      formatValue={(v) => formatCents(v)}
    />
  );
}

export function MonthlyTrendBars({
  data,
  colors,
}: {
  data: Array<{ label: string; spend: number }>;
  colors: string[];
}) {
  return (
    <BarChart
      data={data}
      xKey="label"
      barKey="spend"
      name="Spent"
      colors={colors}
      height={240}
      formatValue={(v) => formatCentsCompact(v)}
    />
  );
}

export function ClassificationDonut({
  data,
  total,
}: {
  data: DonutDatum[];
  total: number;
}) {
  return (
    <DonutChart
      data={data}
      centerLabel="Spent"
      centerValue={formatCentsCompact(total)}
      size={240}
      thickness={26}
      formatValue={(v) => formatCents(v)}
    />
  );
}

export function ThirtyDayArea({
  data,
}: {
  data: Array<{ x: string; spend: number }>;
}) {
  return (
    <AreaChart
      data={data}
      series={[{ key: "spend", name: "Spend", color: "var(--blush)" }]}
      formatValue={(v) => formatCentsCompact(v)}
      height={220}
      formatX={(v) => {
        const d = new Date(String(v));
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      }}
    />
  );
}
