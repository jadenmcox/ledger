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
  PiggyBank,
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
  { href: "/categories", label: "Categories", icon: Tag, group: "setup" },
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
  const cls = size === "lg" ? "text-2xl" : "text-xl";
  return (
    <span
      className={`${cls} leading-none inline-flex items-center gap-1.5 font-semibold tracking-[-0.04em]`}
    >
      <LogoMark size={size === "lg" ? 22 : 18} />
      Budgetly
    </span>
  );
}

function LogoMark({ size = 22 }: { size?: number }) {
  // Abstract mark: a "B" suggestion built from two soft arcs in the
  // brand blush. Replaces the italic-d + dot wordmark.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect
        x="2"
        y="2"
        width="20"
        height="20"
        rx="6"
        fill="var(--sage-deep)"
      />
      <path
        d="M8 7h5.5a3 3 0 0 1 0 6H8V7Zm0 6h6a3 3 0 0 1 0 6H8v-6Z"
        fill="var(--blush)"
      />
    </svg>
  );
}

export function DesktopNav() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 flex-col bg-transparent border-r border-border relative z-10">
      <div className="px-7 pt-10 pb-10">
        <Link href="/dashboard" className="block">
          <Wordmark />
          <div className="text-foreground-faint text-[10px] tracking-[0.3em] uppercase mt-2.5">
            Personal
          </div>
        </Link>
      </div>
      <nav className="flex-1 px-3 space-y-0.5">
        {items.map((item, idx) => {
          const prev = items[idx - 1];
          const showDivider = prev && prev.group !== item.group;
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Fragment key={item.href}>
              {showDivider && (
                <div className="px-4 pt-6 pb-2 text-[10px] tracking-[0.3em] uppercase text-foreground-faint">
                  Setup
                </div>
              )}
            <Link
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors",
                active
                  ? "text-blush-deep"
                  : "text-foreground-muted hover:text-foreground hover:bg-surface-2/60",
              )}
            >
              {active && (
                <motion.span
                  layoutId="desktop-nav-pill"
                  className="absolute inset-0 rounded-lg bg-blush-tint"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <Icon
                className={cn(
                  "size-4 shrink-0 transition-colors relative z-10",
                  active ? "text-blush-deep" : "text-foreground-faint",
                )}
                strokeWidth={1.75}
              />
              <span className="tracking-tight relative z-10 font-medium">{item.label}</span>
            </Link>
            </Fragment>
          );
        })}
      </nav>
      <div className="p-7 text-[10px] tracking-[0.25em] uppercase text-foreground-faint">
        v0.1 — local
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
