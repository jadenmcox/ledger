"use client";

import * as React from "react";

export type HeatmapCell = {
  label: string;
  value: number;
  display?: string;
};

export function Heatmap({
  cells,
  columns = 12,
  color = "var(--blush)",
  emptyColor = "var(--surface-2)",
  rounded = 8,
  gap = 6,
}: {
  cells: HeatmapCell[];
  columns?: number;
  color?: string;
  emptyColor?: string;
  rounded?: number;
  gap?: number;
}) {
  const max = Math.max(1, ...cells.map((c) => c.value));

  return (
    <div
      className="w-full grid"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap,
      }}
    >
      {cells.map((c, i) => {
        const ratio = c.value / max;
        const bg =
          c.value === 0
            ? emptyColor
            : `color-mix(in oklab, ${color} ${Math.max(8, ratio * 100).toFixed(0)}%, var(--surface))`;
        return (
          <div
            key={i}
            className="aspect-square flex flex-col items-center justify-center text-center"
            style={{
              background: bg,
              borderRadius: rounded,
              minHeight: 56,
            }}
            title={`${c.label}: ${c.display ?? c.value}`}
          >
            <div className="text-[10px] tracking-[0.18em] uppercase text-foreground-faint">
              {c.label}
            </div>
            {c.display && c.value > 0 && (
              <div
                className="mono tabular text-[11px] mt-0.5"
                style={{
                  color:
                    ratio > 0.55 ? "var(--surface)" : "var(--foreground)",
                }}
              >
                {c.display}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
