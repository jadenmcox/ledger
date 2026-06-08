"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListOrdered,
  Wallet,
  Tag,
  Upload,
  CalendarRange,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Today", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ListOrdered },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/categories", label: "Categories", icon: Tag },
  { href: "/year", label: "Year", icon: CalendarRange },
  { href: "/import", label: "Import", icon: Upload },
];

function Wordmark({ size = "lg" }: { size?: "lg" | "md" }) {
  const cls = size === "lg" ? "text-3xl" : "text-2xl";
  return (
    <span className={`serif ${cls} leading-none inline-flex items-baseline`}>
      <span>Bu</span>
      <span className="serif-italic text-blush-deep">d</span>
      <span>getly</span>
      <span className="inline-block size-1.5 rounded-full bg-sage-deep ml-1 translate-y-[-2px]" />
    </span>
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
                "group relative flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all overflow-hidden",
                active
                  ? "bg-gradient-to-r from-blush-tint via-blush-tint/70 to-transparent text-sage-deep"
                  : "text-foreground-muted hover:text-foreground hover:bg-surface-2",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-blush" />
              )}
              <Icon
                className={cn(
                  "size-4 shrink-0 transition-colors",
                  active ? "text-blush-deep" : "text-foreground-faint",
                )}
                strokeWidth={1.75}
              />
              <span className="tracking-tight">{item.label}</span>
              {active && (
                <span className="ml-auto size-1.5 rounded-full bg-sage-deep" />
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
  const phoneItems = items.slice(0, 5);
  return (
    <nav className="md:hidden fixed bottom-3 inset-x-3 z-30">
      <div className="relative bg-surface/95 backdrop-blur-2xl rounded-full border border-border shadow-[0_12px_36px_-12px] shadow-foreground/20">
        {/* subtle outer glow */}
        <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/40" />
        <div className="grid grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)]">
          {phoneItems.map((item) => {
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
                <span
                  className={cn(
                    "flex items-center justify-center size-9 rounded-full transition-all",
                    active && "bg-blush-tint",
                  )}
                >
                  <Icon className="size-5" strokeWidth={1.75} />
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
  return (
    <header className="md:hidden sticky top-0 z-20 bg-background/85 backdrop-blur-xl px-5 py-4 flex items-baseline justify-between">
      <Link href="/dashboard" className="block">
        <Wordmark size="md" />
      </Link>
      <div className="text-[10px] tracking-[0.25em] uppercase text-foreground-faint inline-flex items-center gap-1.5">
        <span className="size-1 rounded-full bg-blush" />
        Private
      </div>
    </header>
  );
}
