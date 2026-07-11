"use client";

import { AreaChart } from "@/components/charts/AreaChart";
import { formatCentsCompact } from "@/lib/utils";

// Client wrapper so the format callbacks live on the client side of the
// RSC boundary — functions can't be passed from a server component.
export function BalanceArea({
  data,
  color,
}: {
  data: Array<{ x: string; balance: number }>;
  color: string;
}) {
  return (
    <AreaChart
      data={data}
      series={[{ key: "balance", name: "Balance", color }]}
      height={260}
      formatValue={(v) => formatCentsCompact(Math.round(v * 100))}
      formatX={(v) => {
        const d = new Date(String(v));
        return d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      }}
    />
  );
}
