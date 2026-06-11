import * as React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  italic,
  subtitle,
  right,
}: {
  eyebrow?: React.ReactNode;
  title: string;
  italic?: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="px-5 md:px-12 pt-6 md:pt-14 pb-4 md:pb-10 relative">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 md:gap-6">
        <div className="min-w-0">
          {eyebrow && (
            <div className="inline-flex items-center gap-2 text-foreground-faint text-[10px] tracking-[0.25em] uppercase mb-2 md:mb-3">
              <span className="size-1 rounded-full bg-blush" />
              {eyebrow}
            </div>
          )}
          <h1 className="text-[2rem] md:text-[2.5rem] leading-[1.05] font-semibold tracking-[-0.03em]">
            {title}
            {italic && (
              <>
                {" "}
                <span className="text-foreground-faint font-normal">{italic}</span>
              </>
            )}
          </h1>
          {subtitle && (
            <p className="mt-2 md:mt-2.5 text-foreground-muted text-sm max-w-xl">
              {subtitle}
            </p>
          )}
        </div>
        {right && (
          <div className="shrink-0 flex justify-end md:justify-start">
            {right}
          </div>
        )}
      </div>
    </div>
  );
}

export function Container({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-5 md:px-12 pb-16 relative", className)}>
      {children}
    </div>
  );
}

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "ghost" | "outline" | "danger";
    size?: "sm" | "md";
  }
>(function Button(
  { className, variant = "outline", size = "md", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-tight transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blush focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]",
        size === "sm" ? "h-9 px-4 text-xs" : "h-11 px-5 text-sm",
        variant === "primary" &&
          "bg-sage-deep text-surface hover:bg-sage hover:shadow-[0_8px_24px_-12px] hover:shadow-sage-deep/50 shadow-sm shadow-sage-deep/20",
        variant === "outline" &&
          "border border-border-strong bg-surface text-foreground hover:bg-surface-2 hover:border-blush/40",
        variant === "ghost" &&
          "text-foreground-muted hover:text-foreground hover:bg-surface-2",
        variant === "danger" &&
          "bg-blush-deep text-surface hover:bg-blush shadow-sm shadow-blush/30",
        className,
      )}
      {...props}
    />
  );
});

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full bg-surface border border-border rounded-xl px-3.5 text-sm placeholder:text-foreground-faint focus:border-blush focus:ring-2 focus:ring-blush-tint focus:outline-none transition-all",
        className,
      )}
      {...props}
    />
  );
});

export function Label({
  children,
  className,
  htmlFor,
}: {
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "text-[10px] tracking-[0.25em] uppercase text-foreground-faint block mb-2",
        className,
      )}
    >
      {children}
    </label>
  );
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-surface border border-border rounded-2xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "gold" | "sage" | "clay" | "peach" | "blush" | "blue";
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="mb-0">{label}</Label>
      <div
        className={cn(
          "mono text-2xl md:text-[1.75rem] tracking-[-0.02em] tabular leading-none font-medium",
          tone === "blush" && "text-blush-deep",
          tone === "blue" && "text-foreground",
          tone === "peach" && "text-foreground",
          tone === "sage" && "text-foreground",
          tone === "gold" && "text-foreground",
          tone === "clay" && "text-foreground",
        )}
      >
        {value}
      </div>
      {hint && (
        <div className="text-[11px] text-foreground-faint tracking-tight">
          {hint}
        </div>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-surface/70 backdrop-blur-sm border border-dashed border-border-strong rounded-3xl p-10 md:p-20 text-center relative overflow-hidden">
      {/* corner light leak */}
      <div className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-blush-tint blur-3xl opacity-60" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 size-64 rounded-full bg-blue-tint blur-3xl opacity-60" />

      <div className="relative">
        <div className="inline-flex items-center gap-2 text-foreground-muted text-[10px] tracking-[0.25em] uppercase mb-5 bg-surface border border-border px-2.5 py-1 rounded-full">
          <span className="size-1 rounded-full bg-blush" />
          Empty
        </div>
        <h3 className="text-2xl md:text-3xl font-semibold tracking-[-0.035em] mb-3">
          {title}
        </h3>
        <p className="text-foreground-muted text-sm max-w-md mx-auto mb-6 leading-relaxed">
          {body}
        </p>
        {action}
      </div>
    </div>
  );
}

export function HeroStat({
  label,
  value,
  delta,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  delta?: { value: string; direction: "up" | "down" | "flat" };
  hint?: string;
  tone?: "default" | "blush" | "blue" | "peach" | "sage";
}) {
  return (
    <div className="flex flex-col gap-3">
      <Label className="mb-0">{label}</Label>
      <div
        className={cn(
          "mono tabular text-[2.5rem] md:text-[3.5rem] leading-[1] tracking-[-0.035em] font-semibold",
          tone === "blush" && "text-blush-deep",
          tone === "blue" && "text-blue-deep",
          tone === "peach" && "text-peach-deep",
          tone === "sage" && "text-sage-deep",
          tone === "default" && "text-foreground",
        )}
      >
        {value}
      </div>
      <div className="flex items-baseline gap-3 flex-wrap">
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[11px] mono tabular",
              delta.direction === "up" && "text-blush-deep",
              delta.direction === "down" && "text-foreground-muted",
              delta.direction === "flat" && "text-foreground-faint",
            )}
          >
            <span aria-hidden>
              {delta.direction === "up"
                ? "↑"
                : delta.direction === "down"
                  ? "↓"
                  : "→"}
            </span>
            {delta.value}
          </span>
        )}
        {hint && (
          <span className="text-[11px] text-foreground-faint tracking-tight">
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  max,
  color = "var(--blush)",
  warnAt = 0.8,
  warnColor = "var(--peach)",
  overColor = "var(--blush-deep)",
  height = 6,
}: {
  value: number;
  max: number;
  color?: string;
  warnAt?: number;
  warnColor?: string;
  overColor?: string;
  height?: number;
}) {
  const ratio = max > 0 ? value / max : 0;
  const clamped = Math.min(ratio, 1);
  const fill =
    ratio > 1 ? overColor : ratio >= warnAt ? warnColor : color;
  return (
    <div
      className="w-full bg-surface-2 rounded-full overflow-hidden"
      style={{ height }}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${clamped * 100}%`,
          background: fill,
        }}
      />
    </div>
  );
}

export function SectionHeader({
  title,
  italic,
  hint,
  right,
}: {
  title: string;
  italic?: string;
  hint?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 mb-4">
      <div className="min-w-0">
        <h2 className="text-sm font-medium tracking-tight truncate text-foreground">
          {title}
          {italic && <span className="text-foreground-faint font-normal">{italic}</span>}
        </h2>
        {hint && (
          <div className="text-[11px] text-foreground-faint tracking-tight mt-0.5">
            {hint}
          </div>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export function Pill({
  children,
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  tone?: "default" | "need" | "want" | "savings" | "income";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-[10px] tracking-[0.18em] uppercase px-2 py-0.5 rounded-full border font-medium",
        tone === "default" &&
          "border-border text-foreground-muted bg-surface-2",
        tone === "need" && "border-blush/40 text-blush-deep bg-blush-tint",
        tone === "want" && "border-peach/40 text-peach-deep bg-peach-tint",
        tone === "savings" && "border-blue/40 text-blue-deep bg-blue-tint",
        tone === "income" && "border-blue/40 text-blue-deep bg-blue-tint",
        className,
      )}
    >
      {children}
    </span>
  );
}
