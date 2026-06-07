"use client";

import { useMemo, useState, useTransition } from "react";
import type { Account, Category, Transaction } from "@/db/schema";
import { Card, Input, Label, Pill, Button } from "@/components/ui";
import { cn, formatCents } from "@/lib/utils";
import { format } from "date-fns";
import { setCategory, makeRule, setIsTransfer, deleteTransaction } from "./actions";
import { Search, Zap, ArrowRightLeft, Trash2 } from "lucide-react";

export function TransactionsClient({
  initial,
  categories,
  accounts,
}: {
  initial: Transaction[];
  categories: Category[];
  accounts: Account[];
}) {
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState<number | "all">("all");
  const [catFilter, setCatFilter] = useState<number | "all" | "uncategorized">(
    "all",
  );

  const catById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const acctById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );

  const filtered = initial.filter((t) => {
    if (accountFilter !== "all" && t.accountId !== accountFilter) return false;
    if (catFilter === "uncategorized" && t.categoryId) return false;
    if (
      typeof catFilter === "number" &&
      t.categoryId !== catFilter
    )
      return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.merchantRaw.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Group by day
  const groups: Record<string, Transaction[]> = {};
  for (const t of filtered) {
    const k = format(new Date(t.date), "yyyy-MM-dd");
    (groups[k] ||= []).push(t);
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 md:p-5">
        <div className="flex flex-col md:flex-row gap-4 md:items-center">
          <div className="flex items-center gap-3 flex-1">
            <Search
              className="size-4 text-foreground-faint shrink-0"
              strokeWidth={1.5}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search merchant..."
              className="bg-transparent border-none outline-none text-sm flex-1 placeholder:text-foreground-faint"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={accountFilter}
              onChange={(e) =>
                setAccountFilter(
                  e.target.value === "all" ? "all" : Number(e.target.value),
                )
              }
              className="h-9 bg-surface-2 border border-border-strong rounded-md px-3 text-xs"
            >
              <option value="all">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <select
              value={catFilter === "all" ? "all" : String(catFilter)}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "all") setCatFilter("all");
                else if (v === "uncategorized") setCatFilter("uncategorized");
                else setCatFilter(Number(v));
              }}
              className="h-9 bg-surface-2 border border-border-strong rounded-md px-3 text-xs"
            >
              <option value="all">All categories</option>
              <option value="uncategorized">— Uncategorized —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {Object.entries(groups).map(([day, txs]) => {
        const total = txs.reduce(
          (s, t) => s + (t.isTransfer ? 0 : t.amountCents),
          0,
        );
        return (
          <div key={day}>
            <div className="flex items-baseline justify-between px-1 mb-2">
              <h3 className="serif text-lg">
                {format(new Date(day), "EEEE, MMMM d")}
              </h3>
              <div className="mono tabular text-xs text-foreground-faint">
                {formatCents(total, { signed: true })}
              </div>
            </div>
            <Card className="divide-y divide-border">
              {txs.map((t) => (
                <Row
                  key={t.id}
                  tx={t}
                  cat={t.categoryId ? catById.get(t.categoryId) : undefined}
                  acct={acctById.get(t.accountId)}
                  categories={categories}
                />
              ))}
            </Card>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="text-foreground-faint text-sm text-center py-12">
          No transactions match these filters.
        </div>
      )}
    </div>
  );
}

function Row({
  tx,
  cat,
  acct,
  categories,
}: {
  tx: Transaction;
  cat: Category | undefined;
  acct: Account | undefined;
  categories: Category[];
}) {
  const [picking, setPicking] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <div
      className={cn(
        "px-5 py-3 flex items-center gap-4 group",
        tx.isTransfer && "opacity-50",
      )}
    >
      <div
        className="size-2 rounded-full shrink-0"
        style={{ background: cat?.color ?? "var(--foreground-faint)" }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm tracking-tight truncate">
            {tx.merchantClean || tx.merchantRaw}
          </span>
          {tx.isTransfer && <Pill>transfer</Pill>}
        </div>
        <div className="flex items-baseline gap-2 mt-0.5">
          <button
            onClick={() => setPicking(true)}
            className="text-[11px] text-foreground-faint hover:text-gold transition-colors tracking-tight"
          >
            {cat?.name ?? "— uncategorized —"}
          </button>
          {acct && (
            <span className="text-[10px] text-foreground-faint">
              · {acct.name}
            </span>
          )}
        </div>
      </div>
      <div
        className={cn(
          "mono tabular text-sm shrink-0",
          tx.amountCents > 0 && "text-sage",
          tx.amountCents < 0 && "text-foreground",
        )}
      >
        {formatCents(tx.amountCents, { signed: tx.amountCents > 0 })}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() =>
            startTransition(() => setIsTransfer(tx.id, !tx.isTransfer))
          }
          className={cn(
            "size-7 inline-flex items-center justify-center rounded-md hover:bg-surface-2",
            tx.isTransfer
              ? "text-gold"
              : "text-foreground-faint hover:text-foreground",
          )}
          title="Mark as transfer"
        >
          <ArrowRightLeft className="size-3.5" strokeWidth={1.5} />
        </button>
        <button
          onClick={() => {
            if (confirm("Delete this transaction?"))
              startTransition(() => deleteTransaction(tx.id));
          }}
          className="size-7 inline-flex items-center justify-center text-foreground-faint hover:text-clay rounded-md hover:bg-surface-2"
          title="Delete"
        >
          <Trash2 className="size-3.5" strokeWidth={1.5} />
        </button>
      </div>

      {picking && (
        <CategoryPicker
          tx={tx}
          categories={categories}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}

function CategoryPicker({
  tx,
  categories,
  onClose,
}: {
  tx: Transaction;
  categories: Category[];
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [makingRule, setMakingRule] = useState(false);
  const [pending, startTransition] = useTransition();

  const results = categories.filter((c) =>
    c.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
      <Card className="w-full p-6">
        <Label>Categorize</Label>
        <h3 className="serif text-xl mt-1 mb-1 truncate">
          {tx.merchantClean || tx.merchantRaw}
        </h3>
        <div className="text-foreground-faint text-xs mb-4 mono tabular">
          {formatCents(tx.amountCents, { signed: tx.amountCents > 0 })}
        </div>
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find a category..."
        />
        <div className="max-h-64 overflow-y-auto mt-4 -mx-2">
          {results.map((c) => (
            <button
              key={c.id}
              onClick={() =>
                startTransition(async () => {
                  if (makingRule) {
                    await makeRule(tx.merchantRaw, c.id, true);
                  } else {
                    await setCategory(tx.id, c.id);
                  }
                  onClose();
                })
              }
              className="w-full text-left px-3 py-2 hover:bg-surface-2 rounded-md flex items-center gap-3"
            >
              <span
                className="size-2 rounded-full"
                style={{ background: c.color }}
              />
              <span className="flex-1 text-sm tracking-tight">{c.name}</span>
              <Pill
                tone={
                  c.classification as "need" | "want" | "savings" | "income"
                }
              >
                {c.classification}
              </Pill>
            </button>
          ))}
        </div>
        <div className="hairline my-4" />
        <label className="flex items-center gap-3 text-xs text-foreground-muted cursor-pointer">
          <input
            type="checkbox"
            checked={makingRule}
            onChange={(e) => setMakingRule(e.target.checked)}
            className="accent-gold"
          />
          <Zap className="size-3.5 text-gold" strokeWidth={1.5} />
          <span>
            Always categorize{" "}
            <span className="mono text-foreground">
              {tx.merchantRaw.slice(0, 24)}
            </span>{" "}
            this way (applies to history)
          </span>
        </label>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {tx.categoryId && (
            <Button
              variant="outline"
              onClick={() =>
                startTransition(async () => {
                  await setCategory(tx.id, null);
                  onClose();
                })
              }
              disabled={pending}
            >
              Uncategorize
            </Button>
          )}
        </div>
      </Card>
      </div>
    </div>
  );
}
