"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  ListOrdered,
  Wallet,
  Tag,
  Upload,
  CalendarRange,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Today", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ListOrdered },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/categories", label: "Categories", icon: Tag },
  { href: "/insights", label: "Insights", icon: Sparkles },
  { href: "/year", label: "Year", icon: CalendarRange },
  { href: "/import", label: "Import", icon: Upload },
];

// First 5 items shown in mobile bottom nav
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
    <aside className="hidden md:flex md:w-64 lg:w-72 shrink-0 flex-col bg-surface/55 backdrop-blur-md border-r border-border relative z-10">
      <div className="px-8 pt-10 pb-8">
        <Link href="/dashboard" className="block">
          <div className="text-foreground-faint text-[10px] tracking-[0.3em] uppercase mb-2">
            Personal
          </div>
          <Wordmark />
        </Link>
      </div>
      <nav className="flex-1 px-4 space-y-1">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-colors overflow-hidden",
                active
                  ? "text-sage-deep"
                  : "text-foreground-muted hover:text-foreground hover:bg-surface-2",
              )}
            >
              {active && (
                <motion.span
                  layoutId="desktop-nav-pill"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-blush-tint via-blush-tint/70 to-transparent"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-blush z-10" />
              )}
              <Icon
                className={cn(
                  "size-4 shrink-0 transition-colors relative z-10",
                  active ? "text-blush-deep" : "text-foreground-faint",
                )}
                strokeWidth={1.75}
              />
              <span className="tracking-tight relative z-10">{item.label}</span>
              {active && (
                <span className="ml-auto size-1.5 rounded-full bg-sage-deep relative z-10" />
              )}
            </Link>
          );
        })}
      </nav>
      <div className="p-6 text-[10px] tracking-[0.2em] uppercase text-foreground-faint flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-blush drift" />
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
      <div className="text-[10px] tracking-[0.25em] uppercase text-foreground-faint inline-flex items-center gap-1.5">
        <span className="size-1 rounded-full bg-blush" />
        {title}
      </div>
    </header>
  );
}
