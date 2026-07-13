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
  mobileColumns,
  color = "var(--blush)",
  emptyColor = "var(--surface-2)",
  rounded = 8,
  gap = 6,
}: {
  cells: HeatmapCell[];
  columns?: number;
  // A phone can't fit 12 readable square cells in one row, so wrap to fewer
  // columns below the `sm` breakpoint. Defaults to half (rounded up) — a
  // 12-month grid becomes a tidy 6×2.
  mobileColumns?: number;
  color?: string;
  emptyColor?: string;
  rounded?: number;
  gap?: number;
}) {
  const phoneCols = mobileColumns ?? Math.ceil(columns / 2);
  // Start at the full column count for SSR/first paint, then narrow on phones
  // once we can read the viewport. `min-w-0` on each cell keeps even the wide
  // count from overflowing before this resolves.
  const [cols, setCols] = React.useState(columns);
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const apply = () => setCols(mq.matches ? columns : phoneCols);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [columns, phoneCols]);

  const max = Math.max(1, ...cells.map((c) => c.value));

  return (
    <div
      className="w-full grid"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
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
            // min-w-0 lets the square shrink to its grid track; without it the
            // aspect-ratio + min-height give the cell an automatic min-width
            // that overflows a narrow track and pushes the page sideways.
            className="aspect-square flex flex-col items-center justify-center text-center min-w-0 overflow-hidden"
            style={{
              background: bg,
              borderRadius: rounded,
              minHeight: 44,
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
