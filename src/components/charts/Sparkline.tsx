"use client";

import * as React from "react";

export function Sparkline({
  values,
  color = "var(--blush)",
  width = 80,
  height = 24,
  strokeWidth = 1.5,
  fill = true,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
  fill?: boolean;
}) {
  if (values.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden="true">
        <line
          x1={0}
          y1={height - 1}
          x2={width}
          y2={height - 1}
          stroke="var(--border-strong)"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const pad = strokeWidth + 1;
  const innerH = height - pad * 2;

  const pts = values.map((v, i) => {
    const x = i * stepX;
    const y = pad + innerH - ((v - min) / range) * innerH;
    return [x, y] as const;
  });

  const line = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(" ");

  const area = fill
    ? `${line} L${width},${height} L0,${height} Z`
    : null;

  const id = React.useId();

  return (
    <svg width={width} height={height} aria-hidden="true" className="overflow-visible">
      {fill && (
        <defs>
          <linearGradient id={`spark-${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
      )}
      {area && <path d={area} fill={`url(#spark-${id})`} />}
      <path
        d={line}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={pts[pts.length - 1][0]}
        cy={pts[pts.length - 1][1]}
        r={strokeWidth + 0.5}
        fill={color}
      />
    </svg>
  );
}
