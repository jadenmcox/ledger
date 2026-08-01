/* AUTO-COPIED from the design system. DO NOT EDIT HERE.
   Source: design/src/ui.tsx
   Change it there, then run: npm run sync -- <app>
   Check every app for drift with: npm run check:drift */

/* =========================================================================
   L3 - Shared components (hook-free).

   Nothing in this file uses React state or effects, so it stays renderable on
   the server in the Next apps. Anything interactive lives in ui-client.tsx
   behind a "use client" directive, which keeps RSC apps from dragging the
   whole kit into the browser bundle.

   Every component reads ONLY the semantic tokens: surface, border,
   foreground-*, accent-*, good/warn/bad/info, and the semantic radii. No
   component ever names an app's brand color, which is what lets one kit serve
   every app with its own accent.

   Button / Input / Textarea / Card / EmptyState are ported from
   monorepo/packages/ui/src/index.tsx rather than rewritten, so the four apps
   already using them see no behavioural change.
   ========================================================================= */

import * as React from "react";
import { cn } from "./cn";
import { Icon as DefaultIcon, IconChip, type IconProps, type IconSize } from "./Icon";

type IconCmp = React.ComponentType<IconProps>;

/* -------------------------------------------------------------------------
   Button
   ------------------------------------------------------------------------- */

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  /** Icon name rendered before the label. */
  iconLeft?: string;
  /** Icon name rendered after the label. */
  iconRight?: string;
  /** Swaps the left icon for a spinner and disables the button. */
  loading?: boolean;
  /** Square button with no label. Pass `aria-label`. */
  iconOnly?: boolean;
  icon?: IconCmp;
};

const BTN_SIZE = {
  sm: "h-9 px-4 text-xs gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-13 px-6 text-base gap-2",
} as const;

const BTN_ICON_SIZE = { sm: "h-9 w-9", md: "h-11 w-11", lg: "h-13 w-13" } as const;

const BTN_VARIANT = {
  // Fills with accent-DEEP and hovers to accent. deep is the value guaranteed
  // AA against white, so the label is always legible; accent is the brighter
  // hover step. This is the pattern from monorepo/packages/ui.
  primary:
    "bg-accent-deep text-accent-contrast hover:bg-accent shadow-sm active:bg-accent-deep",
  secondary:
    "border border-border-strong bg-surface text-foreground hover:bg-surface-2",
  ghost: "text-foreground-muted hover:text-foreground hover:bg-surface-2",
  danger: "bg-bad-deep text-white hover:opacity-90",
} as const;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "secondary",
      size = "md",
      iconLeft,
      iconRight,
      loading = false,
      iconOnly = false,
      icon: IconCmpProp = DefaultIcon,
      disabled,
      children,
      ...props
    },
    ref,
  ) {
    const iconSize: IconSize = size === "lg" ? "lg" : size === "sm" ? "sm" : "md";
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          "inline-flex items-center justify-center rounded-pill font-medium tracking-tight",
          "transition-all duration-200 ease-ds",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]",
          iconOnly ? BTN_ICON_SIZE[size] : BTN_SIZE[size],
          BTN_VARIANT[variant],
          className,
        )}
        {...props}
      >
        {loading ? (
          <IconCmpProp name="loading" size={iconSize} className="animate-spin" />
        ) : (
          iconLeft && <IconCmpProp name={iconLeft} size={iconSize} />
        )}
        {!iconOnly && children}
        {!loading && iconRight && <IconCmpProp name={iconRight} size={iconSize} />}
      </button>
    );
  },
);

/* -------------------------------------------------------------------------
   Form controls
   ------------------------------------------------------------------------- */

const FIELD_BASE =
  "w-full bg-surface border border-border rounded-field text-sm text-foreground " +
  "placeholder:text-foreground-faint transition-all duration-200 " +
  "focus:border-accent focus:ring-2 focus:ring-accent-tint focus:outline-none " +
  "disabled:opacity-60 disabled:cursor-not-allowed";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(FIELD_BASE, "h-11 px-3.5", className)} {...props} />;
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(FIELD_BASE, "px-3.5 py-2.5 resize-none", className)}
      {...props}
    />
  );
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(FIELD_BASE, "h-11 pl-3.5 pr-9 appearance-none cursor-pointer", className)}
      {...props}
    >
      {children}
    </select>
  );
});

/** Label + control + hint/error, so form spacing is consistent everywhere. */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-xs font-medium text-foreground-muted">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-2xs text-bad">{error}</p>
      ) : hint ? (
        <p className="text-2xs text-foreground-faint">{hint}</p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Surfaces
   ------------------------------------------------------------------------- */

export function Card({
  children,
  className,
  elevated = false,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  /** Adds the soft family shadow. Flat cards are the default. */
  elevated?: boolean;
  as?: React.ElementType;
}) {
  return (
    <Tag
      className={cn(
        "bg-surface border border-border rounded-card",
        elevated && "shadow-card",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function EmptyState({
  title,
  body,
  icon,
  action,
  className,
  iconComponent,
}: {
  title: string;
  body: string;
  /** Icon name. Rendered in a large neutral chip above the title. */
  icon?: string;
  action?: React.ReactNode;
  className?: string;
  iconComponent?: IconCmp;
}) {
  return (
    <div
      className={cn(
        "bg-surface/70 border border-dashed border-border-strong rounded-sheet",
        "p-10 md:p-16 text-center flex flex-col items-center",
        className,
      )}
    >
      {icon && (
        <IconChip name={icon} size="xl" tone="neutral" className="mb-4" icon={iconComponent} />
      )}
      <h3 className="ds-display text-xl mb-2">{title}</h3>
      <p
        className={cn(
          "text-foreground-muted text-sm max-w-md mx-auto leading-relaxed",
          action && "mb-6",
        )}
      >
        {body}
      </p>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex items-start justify-between gap-4 mb-6", className)}>
      <div className="min-w-0">
        <h1 className="ds-display text-2xl md:text-3xl">{title}</h1>
        {subtitle && (
          <p className="text-sm text-foreground-muted mt-1 leading-relaxed">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

/* -------------------------------------------------------------------------
   Pill / Badge
   ------------------------------------------------------------------------- */

const PILL_TONES = {
  accent: "bg-accent-tint text-accent-deep",
  good: "bg-good-tint text-good",
  warn: "bg-warn-tint text-warn",
  bad: "bg-bad-tint text-bad",
  info: "bg-info-tint text-info",
  neutral: "bg-surface-2 text-foreground-muted",
  outline: "border border-border-strong text-foreground-muted",
} as const;

export function Pill({
  children,
  tone = "neutral",
  icon,
  className,
  iconComponent: IconCmpProp = DefaultIcon,
}: {
  children: React.ReactNode;
  tone?: keyof typeof PILL_TONES;
  icon?: string;
  className?: string;
  iconComponent?: IconCmp;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill px-2.5 py-1",
        "text-2xs font-semibold whitespace-nowrap",
        PILL_TONES[tone],
        className,
      )}
    >
      {icon && <IconCmpProp name={icon} size={14} />}
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------
   Data display
   ------------------------------------------------------------------------- */

export function StatTile({
  label,
  value,
  sublabel,
  icon,
  tone = "accent",
  className,
  iconComponent,
}: {
  label: string;
  value: React.ReactNode;
  sublabel?: string;
  icon?: string;
  tone?: "accent" | "good" | "warn" | "bad" | "info" | "neutral";
  className?: string;
  iconComponent?: IconCmp;
}) {
  return (
    <Card className={cn("p-4 flex items-center gap-3", className)}>
      {icon && <IconChip name={icon} tone={tone} icon={iconComponent} />}
      <div className="min-w-0">
        <p className="ds-overline">{label}</p>
        <p className="ds-numeral text-2xl leading-none mt-1">{value}</p>
        {sublabel && (
          <p className="text-2xs text-foreground-faint mt-1 truncate">{sublabel}</p>
        )}
      </div>
    </Card>
  );
}

export function ProgressBar({
  value,
  max = 100,
  tone = "accent",
  className,
  label,
  animate = true,
}: {
  value: number;
  max?: number;
  tone?: "accent" | "good" | "warn" | "bad";
  className?: string;
  label?: string;
  animate?: boolean;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const fill = {
    accent: "bg-accent",
    good: "bg-good",
    warn: "bg-warn",
    bad: "bg-bad",
  }[tone];

  return (
    <div
      className={cn("h-2 w-full rounded-pill bg-surface-2 overflow-hidden", className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn("h-full rounded-pill", fill, animate && "ds-bar-grow")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** The ring used for calories, habit strength, daily completion. */
export function ProgressRing({
  value,
  max = 100,
  size = 96,
  thickness = 8,
  tone = "accent",
  children,
  className,
  animate = true,
  label,
}: {
  value: number;
  max?: number;
  size?: number;
  thickness?: number;
  tone?: "accent" | "good" | "warn" | "bad";
  children?: React.ReactNode;
  className?: string;
  animate?: boolean;
  label?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);
  const stroke = {
    accent: "var(--ds-accent)",
    good: "var(--ds-good)",
    warn: "var(--ds-warn)",
    bad: "var(--ds-bad)",
  }[tone];

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        width={size}
        height={size}
        role="progressbar"
        aria-valuenow={Math.round(pct * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--ds-surface-2)"
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={animate ? "ds-ring-draw" : undefined}
          style={
            animate
              ? ({ "--ds-dash-start": `${circumference}` } as React.CSSProperties)
              : undefined
          }
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}

/** Tappable row: the backbone of every list in these apps. */
export function ListRow({
  title,
  subtitle,
  icon,
  iconTone = "neutral",
  trailing,
  onClick,
  href,
  className,
  iconComponent,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: string;
  iconTone?: "accent" | "good" | "warn" | "bad" | "info" | "neutral";
  trailing?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
  iconComponent?: IconCmp;
}) {
  const interactive = Boolean(onClick || href);
  const inner = (
    <>
      {icon && <IconChip name={icon} tone={iconTone} icon={iconComponent} />}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{title}</p>
        {subtitle && (
          <p className="text-2xs text-foreground-muted truncate mt-0.5">{subtitle}</p>
        )}
      </div>
      {trailing && <div className="shrink-0 text-foreground-faint">{trailing}</div>}
    </>
  );

  const classes = cn(
    "flex items-center gap-3 px-4 py-3 min-h-tap w-full text-left",
    interactive && "transition-colors duration-150 hover:bg-surface-2 active:bg-surface-3",
    className,
  );

  if (href) {
    return (
      <a href={href} className={classes}>
        {inner}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {inner}
      </button>
    );
  }
  return <div className={classes}>{inner}</div>;
}

/** Loading placeholder. Always match the real content's shape. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-field bg-surface-2 relative overflow-hidden",
        "after:absolute after:inset-0 after:bg-gradient-to-r",
        "after:from-transparent after:via-black/[0.04] after:to-transparent",
        "after:animate-[ds-shimmer_1.6s_ease-in-out_infinite]",
        className,
      )}
    />
  );
}

/** The streak flame every gamified app shows. */
export function StreakBadge({
  days,
  className,
  iconComponent: IconCmpProp = DefaultIcon,
}: {
  days: number;
  className?: string;
  iconComponent?: IconCmp;
}) {
  const active = days > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5",
        active ? "bg-accent-tint text-accent-deep" : "bg-surface-2 text-foreground-faint",
        className,
      )}
      title={active ? `${days} day streak` : "No streak yet"}
    >
      <IconCmpProp name="streak" size="sm" />
      <span className="ds-tabular text-sm font-semibold">{days}</span>
    </span>
  );
}
