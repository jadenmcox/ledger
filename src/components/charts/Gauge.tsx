"use client";

import * as React from "react";

export function Gauge({
  value,
  max = 100,
  size = 140,
  thickness = 8,
  color = "var(--blush-deep)",
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
  const ratio = max > 0 ? clamped / max : 0;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * ratio;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true" className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
        {valueDisplay && (
          <div className="mono tabular text-2xl font-semibold tracking-[-0.02em] leading-none text-foreground">
            {valueDisplay}
          </div>
        )}
        {label && (
          <div className="text-[9px] tracking-[0.25em] uppercase text-foreground-faint mt-1.5">
            {label}
          </div>
        )}
        {hint && (
          <div className="text-[10px] text-foreground-faint mt-1 leading-tight">
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}
