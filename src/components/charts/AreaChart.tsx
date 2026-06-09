"use client";

import * as React from "react";
import {
  AreaChart as RAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export type AreaSeries = {
  key: string;
  name: string;
  color: string;
};

export function AreaChart({
  data,
  series,
  xKey = "x",
  height = 220,
  formatValue = (v) => v.toLocaleString(),
  formatX,
  stacked = false,
  showGrid = true,
}: {
  data: Array<Record<string, string | number>>;
  series: AreaSeries[];
  xKey?: string;
  height?: number;
  formatValue?: (v: number) => string;
  formatX?: (v: string | number) => string;
  stacked?: boolean;
  showGrid?: boolean;
}) {
  const id = React.useId();
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RAreaChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            {series.map((s) => (
              <linearGradient
                key={s.key}
                id={`${id}-${s.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          {showGrid && (
            <CartesianGrid
              vertical={false}
              strokeDasharray="2 4"
              stroke="var(--border-strong)"
              opacity={0.5}
            />
          )}
          <XAxis
            dataKey={xKey}
            stroke="var(--foreground-faint)"
            tick={{ fontSize: 10, fill: "var(--foreground-faint)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatX as ((v: string) => string) | undefined}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            stroke="var(--foreground-faint)"
            tick={{ fontSize: 10, fill: "var(--foreground-faint)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatValue(Number(v))}
            width={48}
          />
          <Tooltip
            cursor={{ stroke: "var(--blush)", strokeWidth: 1, strokeDasharray: "2 2" }}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              fontSize: 12,
              padding: "8px 12px",
              boxShadow: "0 8px 24px -12px rgba(0,0,0,0.15)",
            }}
            labelStyle={{
              color: "var(--foreground-muted)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              marginBottom: 4,
            }}
            formatter={((v: unknown, n: unknown) => [
              formatValue(Number(v ?? 0)),
              String(n ?? ""),
            ]) as unknown as never}
          />
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              fill={`url(#${id}-${s.key})`}
              stackId={stacked ? "1" : undefined}
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          ))}
        </RAreaChart>
      </ResponsiveContainer>
    </div>
  );
}
