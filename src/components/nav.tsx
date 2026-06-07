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
  const cls =
    size === "lg" ? "text-3xl" : "text-2xl";
  return (
    <span className={`serif ${cls} leading-none inline-flex items-baseline`}>
      <span>Le</span>
      <span className="serif-italic text-sage-deep">d</span>
      <span>ger</span>
      <span className="inline-block size-1.5 rounded-full bg-blush ml-1 translate-y-[-2px]" />
    </span>
  );
}

export function DesktopNav() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:w-64 lg:w-72 shrink-0 flex-col bg-surface/60 backdrop-blur-sm border-r border-border relative z-10">
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
                "group flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all",
                active
                  ? "bg-sage-tint text-sage-deep"
                  : "text-foreground-muted hover:text-foreground hover:bg-surface-2",
              )}
            >
              <Icon
                className={cn(
                  "size-4 shrink-0",
                  active ? "text-sage-deep" : "text-foreground-faint",
                )}
                strokeWidth={1.75}
              />
              <span className="tracking-tight">{item.label}</span>
              {active && (
                <span className="ml-auto size-1.5 rounded-full bg-blush" />
              )}
            </Link>
          );
        })}
      </nav>
      <div className="p-6 text-[10px] tracking-[0.2em] uppercase text-foreground-faint flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-sage" />
        v0.1 — local
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const phoneItems = items.slice(0, 5);
  return (
    <nav className="md:hidden fixed bottom-3 inset-x-3 z-30 bg-surface/95 backdrop-blur-xl rounded-2xl border border-border shadow-lg shadow-foreground/5">
      <div className="grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {phoneItems.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-3 transition-colors relative",
                active ? "text-sage-deep" : "text-foreground-faint",
              )}
            >
              {active && (
                <span className="absolute top-1.5 size-1 rounded-full bg-blush" />
              )}
              <Icon className="size-5" strokeWidth={1.75} />
              <span className="text-[10px] tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function MobileHeader() {
  return (
    <header className="md:hidden sticky top-0 z-20 bg-background/85 backdrop-blur-xl px-6 py-4 flex items-baseline justify-between">
      <Link href="/dashboard" className="block">
        <Wordmark size="md" />
      </Link>
      <div className="text-[10px] tracking-[0.25em] uppercase text-foreground-faint">
        Private
      </div>
    </header>
  );
}
