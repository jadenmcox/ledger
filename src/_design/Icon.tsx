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

export type IconChipProps = {
  name: string;
  size?: IconSize;
  /** Which color the chip carries. `accent` is the app's brand. */
  tone?: "accent" | "good" | "warn" | "bad" | "info" | "neutral";
  className?: string;
  label?: string;
  /** Pass an app-specific Icon built with createIcon. */
  icon?: React.ComponentType<IconProps>;
};

const CHIP_TONES: Record<NonNullable<IconChipProps["tone"]>, string> = {
  accent: "bg-accent-tint text-accent-deep",
  good: "bg-good-tint text-good",
  warn: "bg-warn-tint text-warn",
  bad: "bg-bad-tint text-bad",
  info: "bg-info-tint text-info",
  neutral: "bg-surface-2 text-foreground-muted",
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
        CHIP_TONES[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <IconCmp name={name} size={inner} label={label} />
    </span>
  );
}
