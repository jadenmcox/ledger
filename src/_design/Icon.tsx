/* AUTO-COPIED from the design system. DO NOT EDIT HERE.
   Source: design/src/Icon.tsx
   Change it there, then run: npm run sync -- <app>
   Check every app for drift with: npm run check:drift */

/* =========================================================================
   L2 - Icon component and the tinted chip it usually sits in.

   Generalizes plate/src/components/Icon.tsx so every app shares one pattern:
   catalogs store a plain NAME STRING, the component maps it to a Lucide
   component at render. That keeps quest/badge/nav data serializable across
   the RSC boundary, which is the whole reason Plate did it that way.

   Each app builds its own Icon from the core set plus its domain icons, so
   nothing unused is bundled. See icons.ts.
   ========================================================================= */

import * as React from "react";
import { coreIcons, type IconRegistry } from "./icons";
import type { LucideIcon } from "lucide-react";

/** Sizes are fixed on purpose. Arbitrary pixel values are how icon sets drift
 *  out of alignment with the type scale. */
export const ICON_SIZES = {
  sm: 16, // inline with 13-14px text
  md: 20, // the default: buttons, list rows, nav
  lg: 24, // section headers, empty states
  xl: 32, // hero and celebration moments
} as const;

export type IconSize = keyof typeof ICON_SIZES;

export type IconProps = {
  /** Semantic name from the app's registry, e.g. "streak". */
  name: string;
  size?: IconSize | number;
  className?: string;
  strokeWidth?: number;
  /** Set when the icon is the ONLY content of a control, so it needs a name
   *  in the accessibility tree. Otherwise the icon stays decorative. */
  label?: string;
};

function resolveSize(size: IconSize | number | undefined): number {
  if (typeof size === "number") return size;
  return ICON_SIZES[size ?? "md"];
}

/**
 * Builds an Icon bound to a registry.
 *
 * `fallback` renders when a name is missing, which is better than throwing:
 * a stale catalog string should degrade to a neutral dot, not crash a screen.
 */
export function createIcon(registry: IconRegistry, fallback?: LucideIcon) {
  function Icon({ name, size, className, strokeWidth, label }: IconProps) {
    const Cmp = registry[name] ?? fallback ?? registry.empty;
    if (!Cmp) return null;

    const px = resolveSize(size);
    // Heavier strokes read as noise once an icon gets large.
    const stroke = strokeWidth ?? (px >= 24 ? 1.75 : 2);

    return (
      <Cmp
        size={px}
        strokeWidth={stroke}
        className={className}
        aria-hidden={label ? undefined : true}
        aria-label={label}
        role={label ? "img" : undefined}
      />
    );
  }
  Icon.displayName = "Icon";
  return Icon;
}

/** The default Icon, bound to the core set only. Most apps should build their
 *  own with createIcon so their domain icons are available too. */
export const Icon = createIcon(coreIcons);

/* -------------------------------------------------------------------------
   IconChip - the tinted rounded square icons sit in throughout the family.
   ------------------------------------------------------------------------- */

/* Every tone the kit understands: the app accent, the four status colours, the
   six categorical slots, and neutral. Categorical tones are what let a screen
   be colourful with MEANING rather than decoration: each metric keeps its slot
   across every app. */
export type Tone =
  | "accent"
  | "good"
  | "warn"
  | "bad"
  | "info"
  | "neutral"
  | "cat-1"
  | "cat-2"
  | "cat-3"
  | "cat-4"
  | "cat-5"
  | "cat-6";

/** Background + foreground for a tinted surface (chips, pills, tiles). */
export const TONE_TINT: Record<Tone, string> = {
  accent: "bg-accent-tint text-accent-deep",
  good: "bg-good-tint text-good",
  warn: "bg-warn-tint text-warn",
  bad: "bg-bad-tint text-bad",
  info: "bg-info-tint text-info",
  neutral: "bg-surface-2 text-foreground-muted",
  "cat-1": "bg-cat-1-tint text-cat-1-deep",
  "cat-2": "bg-cat-2-tint text-cat-2-deep",
  "cat-3": "bg-cat-3-tint text-cat-3-deep",
  "cat-4": "bg-cat-4-tint text-cat-4-deep",
  "cat-5": "bg-cat-5-tint text-cat-5-deep",
  "cat-6": "bg-cat-6-tint text-cat-6-deep",
};

/** Solid fill, for progress and marks. */
export const TONE_FILL: Record<Tone, string> = {
  accent: "bg-accent",
  good: "bg-good",
  warn: "bg-warn",
  bad: "bg-bad",
  info: "bg-info",
  neutral: "bg-foreground-faint",
  "cat-1": "bg-cat-1",
  "cat-2": "bg-cat-2",
  "cat-3": "bg-cat-3",
  "cat-4": "bg-cat-4",
  "cat-5": "bg-cat-5",
  "cat-6": "bg-cat-6",
};

/** The track behind a fill. Tinted in the tone, never grey: a bar at zero
 *  should read as waiting rather than broken. */
export const TONE_TRACK: Record<Tone, string> = {
  accent: "bg-accent-tint",
  good: "bg-good-tint",
  warn: "bg-warn-tint",
  bad: "bg-bad-tint",
  info: "bg-info-tint",
  neutral: "bg-surface-2",
  "cat-1": "bg-cat-1-tint",
  "cat-2": "bg-cat-2-tint",
  "cat-3": "bg-cat-3-tint",
  "cat-4": "bg-cat-4-tint",
  "cat-5": "bg-cat-5-tint",
  "cat-6": "bg-cat-6-tint",
};

/** The CSS variable for a tone, for SVG strokes and inline styles. */
export const TONE_VAR: Record<Tone, string> = {
  accent: "var(--ds-accent)",
  good: "var(--ds-good)",
  warn: "var(--ds-warn)",
  bad: "var(--ds-bad)",
  info: "var(--ds-info)",
  neutral: "var(--ds-fg-faint)",
  "cat-1": "var(--ds-cat-1)",
  "cat-2": "var(--ds-cat-2)",
  "cat-3": "var(--ds-cat-3)",
  "cat-4": "var(--ds-cat-4)",
  "cat-5": "var(--ds-cat-5)",
  "cat-6": "var(--ds-cat-6)",
};

export const TONE_TRACK_VAR: Record<Tone, string> = {
  accent: "var(--ds-accent-tint)",
  good: "var(--ds-good-tint)",
  warn: "var(--ds-warn-tint)",
  bad: "var(--ds-bad-tint)",
  info: "var(--ds-info-tint)",
  neutral: "var(--ds-surface-2)",
  "cat-1": "var(--ds-cat-1-tint)",
  "cat-2": "var(--ds-cat-2-tint)",
  "cat-3": "var(--ds-cat-3-tint)",
  "cat-4": "var(--ds-cat-4-tint)",
  "cat-5": "var(--ds-cat-5-tint)",
  "cat-6": "var(--ds-cat-6-tint)",
};

export type IconChipProps = {
  name: string;
  size?: IconSize;
  /** Which color the chip carries. `accent` is the app's brand; the cat-*
   *  slots are the shared categorical palette, for when the chip stands for a
   *  specific metric rather than the app itself. */
  tone?: Tone;
  className?: string;
  label?: string;
  /** Pass an app-specific Icon built with createIcon. */
  icon?: React.ComponentType<IconProps>;
};

const CHIP_BOX: Record<IconSize, string> = {
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-11 w-11",
  xl: "h-14 w-14",
};

export function IconChip({
  name,
  size = "md",
  tone = "accent",
  className,
  label,
  icon: IconCmp = Icon,
}: IconChipProps) {
  const inner: IconSize = size === "xl" ? "lg" : size === "lg" ? "md" : "sm";
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-chip",
        CHIP_BOX[size],
        TONE_TINT[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <IconCmp name={name} size={inner} label={label} />
    </span>
  );
}
