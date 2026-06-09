"use client";

import * as React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export type DonutDatum = {
  name: string;
  value: number;
  color: string;
};

export function DonutChart({
  data,
  centerLabel,
  centerValue,
  size = 220,
  thickness = 22,
  formatValue = (v) => v.toLocaleString(),
}: {
  data: DonutDatum[];
  centerLabel?: string;
  centerValue?: string;
  size?: number;
  thickness?: number;
  formatValue?: (v: number) => string;
}) {
  const filtered = data.filter((d) => d.value > 0);
  const hasData = filtered.length > 0;
  const outer = Math.floor(size / 2) - 6;
  const inner = Math.max(8, outer - thickness);

  return (
    <div className="relative w-full flex items-center justify-center" style={{ height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={hasData ? filtered : [{ name: "—", value: 1, color: "var(--surface-2)" }]}
            dataKey="value"
            cx="50%"
            cy="50%"
            innerRadius={inner}
            outerRadius={outer}
            stroke="var(--surface)"
            strokeWidth={2}
            startAngle={90}
            endAngle={-270}
            paddingAngle={hasData ? 1.5 : 0}
            isAnimationActive={false}
          >
            {(hasData ? filtered : [{ color: "var(--surface-2)" }]).map(
              (d, i) => (
                <Cell key={i} fill={d.color} />
              ),
            )}
          </Pie>
          {hasData && (
            <Tooltip
              cursor={false}
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                fontSize: 12,
                padding: "6px 10px",
                boxShadow: "0 8px 24px -12px rgba(0,0,0,0.15)",
              }}
              formatter={((v: unknown, n: unknown) => [
                formatValue(Number(v ?? 0)),
                String(n ?? ""),
              ]) as unknown as never}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-6">
          {centerLabel && (
            <div className="text-[10px] tracking-[0.25em] uppercase text-foreground-faint mb-1">
              {centerLabel}
            </div>
          )}
          {centerValue && (
            <div className="mono tabular text-3xl md:text-4xl tracking-[-0.04em] font-semibold leading-none">
              {centerValue}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
