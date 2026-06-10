"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Tag, Wallet, ListOrdered, ArrowRight, Plus, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  label: string;
  hint?: string;
  href: string;
  group: "Go to" | "Categories" | "Accounts" | "Recent" | "Actions";
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
};

export function CommandPalette({
  categories,
  accounts,
  recentMerchants,
}: {
  categories: { id: number; name: string }[];
  accounts: { id: number; name: string }[];
  recentMerchants: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const items: Item[] = useMemo(() => {
    const out: Item[] = [
      { id: "go-home", label: "Home", href: "/dashboard", group: "Go to" },
      {
        id: "go-tx",
        label: "Transactions",
        href: "/transactions",
        group: "Go to",
        icon: ListOrdered,
      },
      {
        id: "go-year",
        label: "Year",
        href: "/year",
        group: "Go to",
      },
      {
        id: "go-accts",
        label: "Accounts",
        href: "/accounts",
        group: "Go to",
        icon: Wallet,
      },
      {
        id: "go-cats",
        label: "Categories",
        href: "/categories",
        group: "Go to",
        icon: Tag,
      },
      {
        id: "act-add",
        label: "Add transaction",
        href: "/transactions?add=1",
        group: "Actions",
        icon: Plus,
      },
      {
        id: "act-import",
        label: "Import CSV",
        href: "/import",
        group: "Actions",
        icon: Upload,
      },
    ];
    for (const c of categories) {
      out.push({
        id: `cat-${c.id}`,
        label: c.name,
        hint: "category",
        href: `/categories/${c.id}`,
        group: "Categories",
        icon: Tag,
      });
    }
    for (const a of accounts) {
      out.push({
        id: `acct-${a.id}`,
        label: a.name,
        hint: "account",
        href: `/accounts/${a.id}`,
        group: "Accounts",
        icon: Wallet,
      });
    }
    for (const m of recentMerchants.slice(0, 25)) {
      out.push({
        id: `m-${m}`,
        label: m,
        hint: "merchant",
        href: `/transactions?q=${encodeURIComponent(m)}`,
        group: "Recent",
      });
    }
    return out;
  }, [categories, accounts, recentMerchants]);

  const query = q.toLowerCase().trim();
  const filtered = query
    ? items.filter((i) => i.label.toLowerCase().includes(query))
    : items.filter((i) => i.group === "Go to" || i.group === "Actions");

  const grouped = filtered.reduce<Record<string, Item[]>>((acc, it) => {
    (acc[it.group] ||= []).push(it);
    return acc;
  }, {});
  const flat = Object.values(grouped).flat();
  const safeCursor = Math.min(cursor, Math.max(0, flat.length - 1));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(flat.length - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const sel = flat[safeCursor];
      if (sel) {
        setOpen(false);
        router.push(sel.href);
      }
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-start justify-center pt-[12vh] p-4"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="size-4 text-foreground-faint" strokeWidth={1.5} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Jump to a category, account, merchant…"
            className="bg-transparent border-none outline-none text-sm flex-1 placeholder:text-foreground-faint"
          />
          <kbd className="text-[10px] text-foreground-faint mono tabular border border-border rounded px-1.5 py-0.5">
            esc
          </kbd>
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {flat.length === 0 ? (
            <div className="text-foreground-faint text-sm text-center py-10">
              No matches.
            </div>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <div className="text-[10px] tracking-[0.25em] uppercase text-foreground-faint px-3 pt-3 pb-1">
                  {group}
                </div>
                {items.map((it) => {
                  const idx = flat.indexOf(it);
                  const active = idx === safeCursor;
                  const Icon = it.icon ?? ArrowRight;
                  return (
                    <button
                      key={it.id}
                      onMouseEnter={() => setCursor(idx)}
                      onClick={() => {
                        setOpen(false);
                        router.push(it.href);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-sm transition-colors",
                        active
                          ? "bg-blush-tint text-blush-deep"
                          : "hover:bg-surface-2",
                      )}
                    >
                      <Icon className="size-3.5 shrink-0" strokeWidth={1.5} />
                      <span className="flex-1 tracking-tight truncate">
                        {it.label}
                      </span>
                      {it.hint && (
                        <span className="text-[10px] text-foreground-faint tracking-tight">
                          {it.hint}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="border-t border-border px-4 py-2 flex items-center gap-3 text-[10px] text-foreground-faint mono tabular">
          <span>
            <kbd className="border border-border rounded px-1 py-0.5">↑↓</kbd>{" "}
            navigate
          </span>
          <span>
            <kbd className="border border-border rounded px-1 py-0.5">↵</kbd>{" "}
            select
          </span>
          <span className="ml-auto">⌘K to toggle</span>
        </div>
      </div>
    </div>
  );
}
