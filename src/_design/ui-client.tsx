"use client";

/* AUTO-COPIED from the design system. DO NOT EDIT HERE.
   Source: design/src/ui-client.tsx
   Change it there, then run: npm run sync -- <app>
   Check every app for drift with: npm run check:drift */


/* =========================================================================
   L3 - Interactive components.

   Everything here uses state, effects or the DOM, so it is client-only. The
   "use client" directive is what Next needs; Vite ignores it harmlessly.

   Deliberately stack-agnostic: nothing imports next/link, next/navigation or
   react-router. Components that need routing take `activeHref` and an
   optional `linkComponent` instead, so the same file serves the six Next apps
   and the three Vite apps without a fork.
   ========================================================================= */

import * as React from "react";
import { cn } from "./cn";
import { Icon as DefaultIcon, type IconProps } from "./Icon";

type IconCmp = React.ComponentType<IconProps>;
type LinkCmp = React.ComponentType<
  { href: string; className?: string; children: React.ReactNode } & Record<string, unknown>
>;

/* -------------------------------------------------------------------------
   SegmentedControl
   ------------------------------------------------------------------------- */

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "md",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-1 rounded-pill bg-surface-2 p-1",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-pill font-semibold transition-all duration-200 ease-ds",
              size === "sm" ? "px-3 py-1 text-2xs" : "px-4 py-1.5 text-xs",
              active
                ? "bg-surface text-foreground shadow-sm"
                : "text-foreground-muted hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Sheet - bottom sheet on mobile, centered dialog on desktop.
   ------------------------------------------------------------------------- */

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  // Escape closes, and the body must not scroll behind the sheet. Restoring
  // the previous overflow rather than clearing it avoids stomping on an app
  // that already locks scrolling for its own reasons.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[40] flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/40 ds-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative w-full sm:max-w-md bg-surface shadow-sheet",
          "rounded-t-sheet sm:rounded-sheet",
          "ds-sheet-up sm:animate-none max-h-[90vh] flex flex-col",
          className,
        )}
      >
        {/* The grab handle reads as "draggable" on mobile even though the
            sheet is tap-to-dismiss. Hidden on desktop where it means nothing. */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
          <span className="h-1 w-9 rounded-pill bg-border-strong" />
        </div>

        {title && (
          <div className="px-5 pt-3 pb-2 shrink-0">
            <h2 className="ds-display text-lg">{title}</h2>
          </div>
        )}

        <div className="px-5 py-3 overflow-y-auto flex-1">{children}</div>

        {footer && (
          <div className="px-5 py-4 border-t border-border shrink-0 ds-safe-bottom">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   BottomNav - the primary navigation in every one of these PWAs.
   ------------------------------------------------------------------------- */

export type NavItem = {
  href: string;
  label: string;
  /** Icon name from the app's registry. */
  icon: string;
  /** Renders as the raised center action, e.g. Plate's Add. */
  primary?: boolean;
};

export function BottomNav({
  items,
  activeHref,
  className,
  icon: IconCmpProp = DefaultIcon,
  linkComponent,
}: {
  items: NavItem[];
  /** The app supplies this from its own router. */
  activeHref: string;
  className?: string;
  icon?: IconCmp;
  /** next/link or react-router Link. Falls back to a plain anchor. */
  linkComponent?: LinkCmp;
}) {
  const Link: LinkCmp =
    linkComponent ??
    (({ href, className: c, children, ...rest }) => (
      <a href={href} className={c} {...rest}>
        {children}
      </a>
    ));

  return (
    <nav
      className={cn(
        "fixed bottom-0 inset-x-0 z-[20]",
        "border-t border-border bg-surface/95 backdrop-blur-xl",
        "ds-safe-bottom",
        className,
      )}
    >
      <ul className="flex items-stretch justify-around max-w-lg mx-auto">
        {items.map((item) => {
          // Exact match, or a section match for nested routes. "/" must be
          // exact or it would light up on every page.
          const active =
            activeHref === item.href ||
            (item.href !== "/" && activeHref.startsWith(item.href + "/"));

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={item.primary ? item.label : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 h-nav min-h-tap",
                  "transition-colors duration-150",
                  item.primary
                    ? "text-accent-contrast"
                    : active
                      ? "text-accent-deep"
                      : "text-foreground-muted hover:text-foreground",
                )}
              >
                {item.primary ? (
                  // Raised out of the bar so the app's main action is the
                  // biggest thumb target on the screen. Generalized from
                  // Plate's nav, which had this and proved it works.
                  <span
                    className={cn(
                      "-mt-7 flex h-14 w-14 items-center justify-center rounded-pill",
                      "bg-accent-deep text-accent-contrast shadow-pop",
                      "transition-transform duration-150 active:scale-95",
                    )}
                  >
                    <IconCmpProp name={item.icon} size="lg" />
                  </span>
                ) : (
                  <>
                    <IconCmpProp name={item.icon} size="md" />
                    <span
                      className={cn("text-2xs leading-none", active ? "font-bold" : "font-semibold")}
                    >
                      {item.label}
                    </span>
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* -------------------------------------------------------------------------
   SideNav - the desktop counterpart to BottomNav.

   These apps are mobile-first PWAs, but on a laptop a 672px column floating in
   a 2000px window wastes the screen and the bottom bar sits miles from the
   cursor. Pair them: BottomNav below `lg`, SideNav from `lg` up, both driven
   by the same NavItem[] so the two can never fall out of step.
   ------------------------------------------------------------------------- */

export function SideNav({
  items,
  activeHref,
  title,
  footer,
  className,
  icon: IconCmpProp = DefaultIcon,
  linkComponent,
}: {
  items: NavItem[];
  activeHref: string;
  /** App name shown at the top of the rail. */
  title?: string;
  /** Anything pinned to the bottom: streak, level, sign-out. */
  footer?: React.ReactNode;
  className?: string;
  icon?: IconCmp;
  linkComponent?: LinkCmp;
}) {
  const Link: LinkCmp =
    linkComponent ??
    (({ href, className: c, children, ...rest }) => (
      <a href={href} className={c} {...rest}>
        {children}
      </a>
    ));

  return (
    <nav
      className={cn(
        "fixed inset-y-0 left-0 z-[20] w-60 shrink-0",
        "border-r border-border bg-surface",
        "flex flex-col px-3 py-5",
        className,
      )}
    >
      {title && (
        <span className="ds-display px-3 pb-5 text-base leading-none">{title}</span>
      )}

      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const active =
            activeHref === item.href ||
            (item.href !== "/" && activeHref.startsWith(item.href + "/"));

          // The primary action reads as a button here rather than a raised
          // circle: there is no bar for it to rise out of.
          if (item.primary) {
            return (
              <li key={item.href} className="mb-2">
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-pill px-4 h-11 text-sm font-semibold",
                    "bg-accent-deep text-accent-contrast shadow-sm",
                    "transition-all duration-200 ease-ds hover:bg-accent active:scale-[0.98]",
                  )}
                >
                  <IconCmpProp name={item.icon} size="md" />
                  {item.label}
                </Link>
              </li>
            );
          }

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-field px-3 h-10 text-sm",
                  "transition-colors duration-150",
                  active
                    ? "bg-accent-tint text-accent-deep font-semibold"
                    : "text-foreground-muted hover:text-foreground hover:bg-surface-2",
                )}
              >
                <IconCmpProp name={item.icon} size="md" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      {footer && <div className="mt-auto px-1 pt-4">{footer}</div>}
    </nav>
  );
}

/* -------------------------------------------------------------------------
   Toast
   ------------------------------------------------------------------------- */

export type ToastTone = "accent" | "good" | "warn" | "bad";

export function Toast({
  message,
  tone = "good",
  icon,
  onDismiss,
  duration = 3200,
  className,
  iconComponent: IconCmpProp = DefaultIcon,
}: {
  message: string;
  tone?: ToastTone;
  icon?: string;
  onDismiss?: () => void;
  duration?: number;
  className?: string;
  iconComponent?: IconCmp;
}) {
  React.useEffect(() => {
    if (!onDismiss || duration <= 0) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [onDismiss, duration]);

  const toneClass = {
    accent: "bg-accent-tint text-accent-deep",
    good: "bg-good-tint text-good",
    warn: "bg-warn-tint text-warn",
    bad: "bg-bad-tint text-bad",
  }[tone];

  const defaultIcon = { accent: "sparkle", good: "success", warn: "info", bad: "info" }[tone];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed left-1/2 -translate-x-1/2 bottom-[calc(var(--ds-nav-height)+1rem)] z-[50]",
        "flex items-center gap-2 rounded-pill px-4 py-2.5 shadow-pop",
        "text-sm font-medium ds-rise-in max-w-[90vw]",
        toneClass,
        className,
      )}
    >
      <IconCmpProp name={icon ?? defaultIcon} size="sm" />
      <span className="truncate">{message}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------
   CountUp - the headline number animates in rather than just appearing.
   ------------------------------------------------------------------------- */

/**
 * Counts from 0 to `value` on mount. Every app in the family leads with a big
 * number (calories left, dollars left, habit strength), and a number that
 * arrives has far more life than one that is simply there.
 *
 * Renders the final value immediately for anyone with reduced motion, and on
 * the server, so the correct figure is always in the HTML.
 *
 * IMPORTANT: `format` is a function, so it can only be passed from another
 * CLIENT component. Passing it from a server component throws at request time
 * with "Functions cannot be passed directly to Client Components" - and it
 * throws on render, not at build, so a green build proves nothing. That
 * mistake took Plate's diary down in production once.
 *
 * For the common cases use the serializable props instead, which cover
 * everything the apps here actually needed:
 *   <CountUp value={1890} />                     1,890
 *   <CountUp value={12.5} decimals={1} />        12.5
 *   <CountUp value={54} prefix="$" />            $54
 *   <CountUp value={68} suffix="%" />            68%
 */
export function CountUp({
  value,
  duration = 750,
  decimals = 0,
  prefix = "",
  suffix = "",
  locale = "en-US",
  format,
  className,
}: {
  value: number;
  duration?: number;
  /** Decimal places. Serializable, unlike `format`. */
  decimals?: number;
  prefix?: string;
  suffix?: string;
  locale?: string;
  /** CLIENT COMPONENTS ONLY. See the note above. */
  format?: (n: number) => string;
  className?: string;
}) {
  // useSyncExternalStore rather than an effect: it is SSR-safe (the server
  // snapshot reports "reduced", so the real figure is always in the HTML), it
  // reacts if the OS setting changes mid-session, and it keeps the animation
  // effect free of a setState-on-mount for the reduced-motion path.
  const reduced = React.useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotion,
    () => true,
  );

  const [display, setDisplay] = React.useState(value);
  const frame = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    if (reduced) return;

    const start = performance.now();
    const from = 0;
    // Same easing curve as every other motion in the system.
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setDisplay(from + (value - from) * ease(t));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);

    return () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    };
  }, [value, duration, reduced]);

  const n = reduced ? value : display;
  const text = format
    ? format(n)
    : prefix +
      n.toLocaleString(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }) +
      suffix;

  // When motion is reduced we render `value` directly rather than the animated
  // state, so a later change to `value` is still reflected.
  return <span className={className}>{text}</span>;
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getReducedMotion() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}
