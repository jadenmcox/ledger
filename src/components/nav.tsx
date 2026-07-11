"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  ListOrdered,
  Wallet,
  Tag,
  CalendarRange,
  CalendarClock,
  PiggyBank,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  group: "primary" | "setup";
};

const items: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, group: "primary" },
  { href: "/transactions", label: "Transactions", icon: ListOrdered, group: "primary" },
  { href: "/budget", label: "Budget", icon: PiggyBank, group: "primary" },
  { href: "/year", label: "Year", icon: CalendarRange, group: "primary" },
  { href: "/accounts", label: "Accounts", icon: Wallet, group: "setup" },
  { href: "/recurring", label: "Recurring", icon: CalendarClock, group: "setup" },
  { href: "/categories", label: "Categories", icon: Tag, group: "setup" },
  { href: "/rules", label: "Rules", icon: Zap, group: "setup" },
];

// First 5 items shown in mobile bottom nav (all of them, conveniently)
const mobileItems = items.slice(0, 5);

function titleFor(pathname: string): string {
  const match = items.find(
    (i) => pathname === i.href || pathname.startsWith(i.href + "/"),
  );
  return match?.label ?? "Budgetly";
}

function Wordmark({ size = "lg" }: { size?: "lg" | "md" }) {
  const cls = size === "lg" ? "text-[1.55rem]" : "text-xl";
  return (
    <span
      className={`${cls} display leading-none inline-flex items-center gap-2.5`}
    >
      <LogoMark size={size === "lg" ? 32 : 28} />
      Budgetly
    </span>
  );
}

function LogoMark({ size = 32 }: { size?: number }) {
  // Gradient squircle badge with a clean "B" set in the display face — the
  // app icon. Brand pink → indigo gradient with a soft inner highlight.
  return (
    <span
      className="relative grid shrink-0 place-items-center overflow-hidden rounded-[28%] text-white shadow-[0_4px_12px_-4px_rgba(196,61,98,0.55)]"
      style={{
        width: size,
        height: size,
        background:
          "linear-gradient(140deg, var(--blush) 0%, var(--blush-deep) 45%, var(--sage-deep) 100%)",
      }}
      aria-hidden="true"
    >
      <span className="pointer-events-none absolute inset-0 rounded-[28%] ring-1 ring-inset ring-white/25" />
      <span
        className="display font-bold leading-none"
        style={{ fontSize: size * 0.6 }}
      >
        B
      </span>
    </span>
  );
}

export function DesktopNav() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:w-56 lg:w-60 shrink-0 flex-col bg-surface/55 backdrop-blur-md border-r border-border/70 relative z-10">
      <div className="px-5 pt-7 pb-8">
        <Link href="/dashboard" className="block">
          <Wordmark />
        </Link>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {items.map((item, idx) => {
          const prev = items[idx - 1];
          const showDivider = prev && prev.group !== item.group;
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Fragment key={item.href}>
              {showDivider && (
                <div className="px-3 pt-6 pb-2 text-[10px] tracking-[0.28em] uppercase text-foreground-faint/80">
                  Setup
                </div>
              )}
              <Link
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors",
                  active
                    ? "text-blush-deep"
                    : "text-foreground-muted hover:text-foreground hover:bg-surface-2/70",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="desktop-nav-pill"
                    className="absolute inset-0 rounded-xl bg-blush-tint/90 shadow-[inset_0_0_0_1px_var(--blush-tint)] ring-1 ring-blush/15"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span
                  className={cn(
                    "relative z-10 grid place-items-center size-7 rounded-lg transition-colors",
                    active
                      ? "bg-blush-deep text-white shadow-sm"
                      : "bg-surface-2/70 text-foreground-faint group-hover:text-foreground-muted",
                  )}
                >
                  <Icon className="size-[15px]" strokeWidth={2} />
                </span>
                <span className="tracking-tight relative z-10 font-medium">
                  {item.label}
                </span>
              </Link>
            </Fragment>
          );
        })}
      </nav>
      <div className="px-6 py-6 flex items-center gap-2 text-[10px] tracking-[0.25em] uppercase text-foreground-faint/70">
        <span className="size-1.5 rounded-full bg-blue/60" />
        Personal · v0.1
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-3 inset-x-3 z-30">
      <div className="relative bg-surface/95 backdrop-blur-2xl rounded-full border border-border shadow-[0_12px_36px_-12px] shadow-foreground/20">
        <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/40" />
        <div className="grid grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)]">
          {mobileItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 transition-colors relative",
                  active ? "text-blush-deep" : "text-foreground-faint",
                )}
              >
                <span className="relative flex items-center justify-center size-9 rounded-full">
                  {active && (
                    <motion.span
                      layoutId="mobile-nav-pill"
                      className="absolute inset-0 bg-blush-tint rounded-full"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <Icon
                    className="size-5 relative z-10"
                    strokeWidth={1.75}
                  />
                </span>
                <span
                  className={cn(
                    "text-[10px] tracking-wide transition-colors",
                    active ? "text-sage-deep font-medium" : "",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export function MobileHeader() {
  const pathname = usePathname();
  const title = titleFor(pathname);
  return (
    <header className="md:hidden sticky top-0 z-20 bg-background/85 backdrop-blur-xl px-5 py-4 flex items-baseline justify-between">
      <Link href="/dashboard" className="block">
        <Wordmark size="md" />
      </Link>
      <div className="text-[10px] tracking-[0.25em] uppercase text-foreground-faint">
        {title}
      </div>
    </header>
  );
}
