"use client";

import * as React from "react";

export function Gauge({
  value,
  max = 100,
  size = 160,
  thickness = 12,
  color = "var(--blush)",
  trackColor = "var(--surface-2)",
  label,
  valueDisplay,
  hint,
}: {
  value: number;
  max?: number;
  size?: number;
  thickness?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  valueDisplay?: string;
  hint?: string;
}) {
  const clamped = Math.max(0, Math.min(value, max));
  const ratio = clamped / max;
  const radius = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2 + thickness / 2;
  // Half-circle arc from (cx-radius, cy) to (cx+radius, cy) — 180°
  const startX = cx - radius;
  const startY = cy;
  const endAngle = Math.PI * (1 - ratio);
  const endX = cx + radius * Math.cos(endAngle);
  const endY = cy - radius * Math.sin(endAngle);
  const largeArc = ratio > 0.5 ? 1 : 0;

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size / 2 + thickness} aria-hidden="true">
        {/* track */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke={trackColor}
          strokeWidth={thickness}
          strokeLinecap="round"
        />
        {/* fill */}
        {ratio > 0.001 && (
          <path
            d={`M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="-mt-2 text-center">
        {label && (
          <div className="text-[10px] tracking-[0.25em] uppercase text-foreground-faint">
            {label}
          </div>
        )}
        {valueDisplay && (
          <div className="serif text-2xl tracking-tight leading-tight mt-0.5">
            {valueDisplay}
          </div>
        )}
        {hint && (
          <div className="text-[11px] text-foreground-faint mt-0.5">{hint}</div>
        )}
      </div>
    </div>
  );
}
