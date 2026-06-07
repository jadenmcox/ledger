import * as React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  italic,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  italic?: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="px-6 md:px-12 pt-10 md:pt-16 pb-8 md:pb-12">
      <div className="flex items-end justify-between gap-6">
        <div>
          {eyebrow && (
            <div className="inline-flex items-center gap-2 text-foreground-muted text-[10px] tracking-[0.3em] uppercase mb-5 bg-surface/70 backdrop-blur-sm border border-border px-3 py-1 rounded-full">
              <span className="size-1 rounded-full bg-blush" />
              {eyebrow}
            </div>
          )}
          <h1 className="serif text-4xl md:text-6xl leading-[1.0] tracking-tight">
            {title}
            {italic && (
              <>
                {" "}
                <span className="serif-italic text-sage-deep">{italic}</span>
              </>
            )}
          </h1>
          {subtitle && (
            <p className="mt-4 text-foreground-muted text-sm md:text-base max-w-xl leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      <div className="hairline mt-10 md:mt-14" />
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
    <div className={cn("px-6 md:px-12 pb-16", className)}>{children}</div>
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
        "inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-tight transition-all disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        size === "sm" ? "h-8 px-3.5 text-xs" : "h-10 px-5 text-sm",
        variant === "primary" &&
          "bg-sage-deep text-surface hover:bg-sage shadow-sm shadow-sage/30",
        variant === "outline" &&
          "border border-border-strong bg-surface text-foreground hover:bg-surface-2",
        variant === "ghost" &&
          "text-foreground-muted hover:text-foreground hover:bg-surface-2",
        variant === "danger" &&
          "bg-blush-deep text-surface hover:bg-blush",
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
        "h-10 w-full bg-surface border border-border rounded-xl px-3.5 text-sm placeholder:text-foreground-faint focus:border-sage focus:ring-2 focus:ring-sage-tint focus:outline-none transition-all",
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
        "bg-surface border border-border rounded-2xl shadow-sm shadow-foreground/[0.02]",
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
    <div className="flex flex-col gap-2">
      <Label className="mb-0">{label}</Label>
      <div
        className={cn(
          "mono text-3xl md:text-4xl tracking-tight tabular leading-none",
          tone === "sage" && "text-sage-deep",
          tone === "gold" && "text-peach-deep",
          tone === "peach" && "text-peach-deep",
          tone === "clay" && "text-blush-deep",
          tone === "blush" && "text-blush-deep",
          tone === "blue" && "text-blue-deep",
        )}
      >
        {value}
      </div>
      {hint && (
        <div className="text-xs text-foreground-faint tracking-tight">
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
    <div className="bg-surface/60 border border-dashed border-border-strong rounded-3xl p-12 md:p-20 text-center relative overflow-hidden">
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex gap-1.5">
        <span className="size-2 rounded-full bg-sage" />
        <span className="size-2 rounded-full bg-peach" />
        <span className="size-2 rounded-full bg-blush" />
        <span className="size-2 rounded-full bg-blue" />
      </div>
      <div className="serif-italic text-sage-deep text-sm mb-3 mt-3">
        nothing yet
      </div>
      <h3 className="serif text-2xl md:text-3xl mb-3">{title}</h3>
      <p className="text-foreground-muted text-sm max-w-md mx-auto mb-6 leading-relaxed">
        {body}
      </p>
      {action}
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
        tone === "savings" && "border-sage/40 text-sage-deep bg-sage-tint",
        tone === "income" && "border-sage/40 text-sage-deep bg-sage-tint",
        className,
      )}
    >
      {children}
    </span>
  );
}
