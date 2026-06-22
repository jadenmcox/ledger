"use client";

import * as React from "react";
import {
  BarChart as RBarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export function BarChart({
  data,
  xKey = "x",
  barKey = "value",
  name = "Value",
  color = "var(--blush)",
  colors,
  height = 220,
  formatValue = (v) => v.toLocaleString(),
  formatX,
  showGrid = true,
  radius = 6,
}: {
  data: Array<Record<string, string | number>>;
  xKey?: string;
  barKey?: string;
  name?: string;
  color?: string;
  colors?: string[];
  height?: number;
  formatValue?: (v: number) => string;
  formatX?: (v: string | number) => string;
  showGrid?: boolean;
  radius?: number;
}) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RBarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
            interval={0}
            minTickGap={4}
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
            cursor={{ fill: "var(--surface-2)", opacity: 0.5 }}
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
          <Bar
            dataKey={barKey}
            name={name}
            fill={color}
            radius={[radius, radius, 0, 0]}
            isAnimationActive={false}
          >
            {colors &&
              data.map((_, i) => <Cell key={i} fill={colors[i] ?? color} />)}
          </Bar>
        </RBarChart>
      </ResponsiveContainer>
    </div>
  );
}
