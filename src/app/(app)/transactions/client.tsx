"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import type { Account, Category, Transaction } from "@/db/schema";
import { Card, Input, Label, Pill, Button } from "@/components/ui";
import { cn, formatCents } from "@/lib/utils";
import { format } from "date-fns";
import Link from "next/link";
import {
  setCategory,
  makeRule,
  setIsTransfer,
  deleteTransaction,
  updateTransaction,
  createManualTransaction,
} from "./actions";
import { Search, Zap, ArrowRightLeft, Trash2, Pencil, Plus, Upload } from "lucide-react";

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
  const [adding, setAdding] = useState(false);
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams?.get("add") === "1") setAdding(true);
    const q = searchParams?.get("q");
    if (q) setSearch(q);
  }, [searchParams]);

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
      <div className="flex items-center justify-end gap-2">
        <Button variant="primary" onClick={() => setAdding(true)}>
          <Plus className="size-4" strokeWidth={1.75} />
          Add transaction
        </Button>
        <Link href="/import">
          <Button variant="outline">
            <Upload className="size-4" strokeWidth={1.75} />
            Import CSV
          </Button>
        </Link>
      </div>
      <Card className="p-4 md:p-5 sticky top-0 md:top-3 z-10">
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
            <Card className="divide-y divide-border overflow-hidden">
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

      {adding && (
        <AddTransactionModal
          accounts={accounts}
          categories={categories}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}

function AddTransactionModal({
  accounts,
  categories,
  onClose,
}: {
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [direction, setDirection] = useState<"out" | "in">("out");
  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
        <Card className="p-6">
          <Label>New transaction</Label>
          <h3 className="serif text-xl mt-1 mb-5">Add by hand</h3>
          <form
            action={(fd) => {
              fd.set("direction", direction);
              startTransition(async () => {
                await createManualTransaction(fd);
                onClose();
              });
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  defaultValue={format(new Date(), "yyyy-MM-dd")}
                  required
                />
              </div>
              <div>
                <Label htmlFor="accountId">Account</Label>
                <select
                  id="accountId"
                  name="accountId"
                  required
                  className="h-10 w-full bg-surface border border-border rounded-xl px-3 text-sm"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="merchant">Merchant</Label>
              <Input id="merchant" name="merchant" placeholder="Trader Joe's" required />
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
              <div>
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  name="amount"
                  inputMode="decimal"
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="flex rounded-xl border border-border overflow-hidden h-10">
                <button
                  type="button"
                  onClick={() => setDirection("out")}
                  className={cn(
                    "px-3 text-xs tracking-tight transition-colors",
                    direction === "out"
                      ? "bg-blush-tint text-blush-deep font-medium"
                      : "text-foreground-faint hover:text-foreground",
                  )}
                >
                  Spent
                </button>
                <button
                  type="button"
                  onClick={() => setDirection("in")}
                  className={cn(
                    "px-3 text-xs tracking-tight transition-colors border-l border-border",
                    direction === "in"
                      ? "bg-sage-tint text-sage-deep font-medium"
                      : "text-foreground-faint hover:text-foreground",
                  )}
                >
                  Received
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="categoryId">Category (optional)</Label>
              <select
                id="categoryId"
                name="categoryId"
                className="h-10 w-full bg-surface border border-border rounded-xl px-3 text-sm"
                defaultValue=""
              >
                <option value="">— Uncategorized —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input id="notes" name="notes" placeholder="Anything to remember" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? "Adding…" : "Add"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
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
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();

  const color = cat?.color ?? "var(--foreground-faint)";
  return (
    <div
      className={cn(
        "relative pl-5 md:pl-6 pr-4 md:pr-5 py-3.5 flex items-center gap-3 md:gap-4 group",
        tx.isTransfer && "opacity-50",
      )}
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ background: color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] md:text-sm tracking-tight truncate font-medium md:font-normal">
            {tx.merchantClean || tx.merchantRaw}
          </span>
          {tx.isTransfer && <Pill>transfer</Pill>}
        </div>
        <div className="flex items-baseline gap-2 mt-1 md:mt-0.5">
          <button
            onClick={() => setPicking(true)}
            className="text-[11px] text-foreground-faint hover:text-blush-deep transition-colors tracking-tight"
          >
            {cat?.name ?? "— uncategorized —"}
          </button>
          {acct && (
            <span className="text-[10px] text-foreground-faint truncate">
              · {acct.name}
            </span>
          )}
        </div>
      </div>
      <div
        className={cn(
          "mono tabular text-sm shrink-0 text-right",
          tx.amountCents > 0 && "text-blue-deep",
          tx.amountCents < 0 && "text-foreground",
        )}
      >
        {formatCents(tx.amountCents, { signed: tx.amountCents > 0 })}
      </div>
      <div className="hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setEditing(true)}
          className="size-7 inline-flex items-center justify-center rounded-md hover:bg-surface-2 text-foreground-faint hover:text-foreground"
          title="Edit"
        >
          <Pencil className="size-3.5" strokeWidth={1.5} />
        </button>
        <button
          onClick={() =>
            startTransition(() => setIsTransfer(tx.id, !tx.isTransfer))
          }
          className={cn(
            "size-7 inline-flex items-center justify-center rounded-md hover:bg-surface-2",
            tx.isTransfer
              ? "text-blush-deep"
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
          className="size-7 inline-flex items-center justify-center text-foreground-faint hover:text-blush-deep rounded-md hover:bg-surface-2"
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

      {editing && <EditTxModal tx={tx} onClose={() => setEditing(false)} />}
    </div>
  );
}

function EditTxModal({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
        <Card className="w-full p-6">
          <Label>Edit transaction</Label>
          <form
            action={(fd) =>
              startTransition(async () => {
                await updateTransaction(fd);
                onClose();
              })
            }
            className="space-y-4 mt-3"
          >
            <input type="hidden" name="id" value={tx.id} />
            <div>
              <Label>Merchant</Label>
              <Input
                name="merchant"
                defaultValue={tx.merchantClean || tx.merchantRaw}
                autoFocus
              />
              <div className="text-[10px] text-foreground-faint mt-1 mono">
                raw: {tx.merchantRaw}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount</Label>
                <Input
                  name="amount"
                  defaultValue={(tx.amountCents / 100).toFixed(2)}
                  inputMode="decimal"
                />
                <div className="text-[10px] text-foreground-faint mt-1">
                  negative = expense
                </div>
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  name="date"
                  type="date"
                  defaultValue={format(new Date(tx.date), "yyyy-MM-dd")}
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Input name="notes" defaultValue={tx.notes || ""} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
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
            className="accent-blush-deep"
          />
          <Zap className="size-3.5 text-blush-deep" strokeWidth={1.5} />
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
