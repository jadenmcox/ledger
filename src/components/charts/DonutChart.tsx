"use client";

import * as React from "react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";

export type DonutDatum = {
  name: string;
  value: number;
  color: string;
  // Optional click target. When set and the slice is clicked, onSliceClick
  // fires with this datum so the consumer can navigate.
  href?: string | null;
};

export function DonutChart({
  data,
  centerLabel,
  centerValue,
  size = 220,
  thickness = 22,
  formatValue = (v) => v.toLocaleString(),
  onSliceClick,
  onActiveChange,
  showTooltip = true,
}: {
  data: DonutDatum[];
  centerLabel?: string;
  centerValue?: string;
  size?: number;
  thickness?: number;
  formatValue?: (v: number) => string;
  onSliceClick?: (d: DonutDatum) => void;
  // Fires with the hovered slice on mouse-enter. Let a parent drive a custom
  // hover affordance (e.g. swapping the donut's center) instead of the
  // floating Recharts tooltip.
  onActiveChange?: (d: DonutDatum) => void;
  showTooltip?: boolean;
}) {
  const filtered = data.filter((d) => d.value > 0);
  const hasData = filtered.length > 0;
  const total = filtered.reduce((s, d) => s + d.value, 0) || 1;
  const outer = Math.floor(size / 2) - 6;
  const inner = Math.max(8, outer - thickness);

  return (
    <div
      className="relative flex items-center justify-center mx-auto"
      style={{ height: size, width: size, maxWidth: "100%" }}
    >
      <PieChart width={size} height={size}>
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
            onClick={(entry: unknown) => {
              const d = entry as DonutDatum | undefined;
              if (d?.href) onSliceClick?.(d);
            }}
            onMouseEnter={(entry: unknown) => {
              const d = entry as DonutDatum | undefined;
              if (d) onActiveChange?.(d);
            }}
          >
            {(hasData ? filtered : [{ color: "var(--surface-2)" }]).map(
              (d, i) => (
                <Cell
                  key={i}
                  fill={d.color}
                  className={
                    onSliceClick && "href" in d && d.href
                      ? "cursor-pointer outline-none"
                      : "outline-none"
                  }
                />
              ),
            )}
          </Pie>
          {hasData && showTooltip && (
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
              formatter={((v: unknown, n: unknown) => {
                const val = Number(v ?? 0);
                const pct = Math.round((val / total) * 100);
                return [`${formatValue(val)} · ${pct}%`, String(n ?? "")];
              }) as unknown as never}
            />
          )}
      </PieChart>
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
