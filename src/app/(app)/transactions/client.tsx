"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Account, Category, Transaction } from "@/db/schema";
import { Card, Input, Label, Pill, Button } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { CategoryGlyph } from "@/components/category-glyph";
import { cn, formatCents } from "@/lib/utils";
import { format } from "date-fns";
import Link from "next/link";
import {
  setCategory,
  makeRule,
  setIsTransfer,
  setReimbursable,
  deleteTransaction,
  updateTransaction,
  createManualTransaction,
  recategorizeAll,
  bulkSetCategory,
  saveSplits,
  clearSplits,
  scanReceipt,
} from "./actions";
import { Search, Zap, ArrowRightLeft, Trash2, Pencil, Plus, Upload, Sparkles, Receipt, Tag, Split, X, ScanLine } from "lucide-react";

// Downscale a photo to a compact JPEG data: URL before sending it to the
// receipt parser — keeps the upload well under the server-action body limit and
// under Groq's base64 ceiling, and cuts vision-token cost, with plenty of
// resolution left to read receipt text.
async function downscaleToDataUrl(
  file: File,
  maxDim = 1500,
  quality = 0.7,
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process the image.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", quality);
}

// A transaction's category parts, as passed from the server for display.
export type SplitPartView = {
  categoryId: number | null;
  amountCents: number;
  note: string | null;
};

function guessPatternFromRaw(raw: string): string {
  const cleaned = raw
    .replace(/\b(POS|DEBIT|CREDIT|PURCHASE|PAYMENT)\b/gi, "")
    .replace(/\s+\d{6,}/g, "")
    .replace(/\s+#\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = cleaned.split(/\s+/).filter((t) => /^[A-Za-z]{2,}$/.test(t));
  if (tokens.length === 0) return cleaned;
  let best = tokens[0];
  for (const t of tokens) if (t.length > best.length) best = t;
  return best.toUpperCase();
}

export function TransactionsHeaderActions() {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="primary"
        onClick={() => router.push("/transactions?add=1")}
        aria-label="Add transaction"
      >
        <Plus className="size-4" strokeWidth={1.75} />
        <span className="hidden sm:inline">Add</span>
      </Button>
      <Link href="/import" aria-label="Import CSV">
        <Button size="sm" variant="outline">
          <Upload className="size-4" strokeWidth={1.75} />
          <span className="hidden sm:inline">Import</span>
        </Button>
      </Link>
    </div>
  );
}

function RecategorizeBanner({
  count,
  onTriage,
}: {
  count: number;
  onTriage: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  return (
    <Card className="p-3 md:p-4 flex items-center gap-3">
      <Sparkles
        className="size-4 text-blush-deep shrink-0"
        strokeWidth={1.75}
      />
      <div className="flex-1 min-w-0 text-xs md:text-sm">
        {errors.length > 0 ? (
          <span className="text-blush-deep">
            Plaid sync failed: {errors[0]}
          </span>
        ) : done !== null ? (
          done === 0 ? (
            <span>
              No new matches. Add a rule by tapping a merchant — it&apos;ll
              catch every future one.
            </span>
          ) : (
            <span>
              Categorized <span className="font-medium">{done}</span> from your
              rules and Plaid&apos;s hints.
            </span>
          )
        ) : (
          <span>
            <span className="font-medium">{count}</span> uncategorized — run
            your rules and Plaid&apos;s category hints across them.
          </span>
        )}
      </div>
      <Button
        size="sm"
        variant="primary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              const res = await recategorizeAll();
              setDone(res.touched);
              setErrors(res.errors);
              router.refresh();
            } catch (e) {
              setErrors([e instanceof Error ? e.message : String(e)]);
            }
          })
        }
      >
        {pending ? "Working…" : done !== null ? "Run again" : "Recategorize"}
      </Button>
      <Button size="sm" variant="outline" onClick={onTriage}>
        One by one
      </Button>
    </Card>
  );
}

export function TransactionsClient({
  initial,
  categories,
  accounts,
  refundNotes = {},
  splits = {},
  hasMore = false,
  nextN = 1000,
}: {
  initial: Transaction[];
  categories: Category[];
  accounts: Account[];
  refundNotes?: Record<number, string>;
  splits?: Record<number, SplitPartView[]>;
  hasMore?: boolean;
  nextN?: number;
}) {
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState<number | "all">("all");
  const [catFilter, setCatFilter] = useState<number | "all" | "uncategorized">(
    "all",
  );
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [bulkPicking, setBulkPicking] = useState(false);
  const [triaging, setTriaging] = useState(false);
  const [adding, setAdding] = useState(false);
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams?.get("add") === "1") setAdding(true);
    const q = searchParams?.get("q");
    if (q) setSearch(q);
    const cat = searchParams?.get("cat");
    if (cat === "uncategorized") setCatFilter("uncategorized");
    else if (cat && !Number.isNaN(Number(cat))) setCatFilter(Number(cat));
  }, [searchParams]);

  const catById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const acctById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );

  const uncategorizedTx = useMemo(
    () => initial.filter((t) => !t.categoryId && !t.isTransfer),
    [initial],
  );
  const uncategorizedCount = uncategorizedTx.length;

  // Months present in the loaded window, newest first, for the month filter.
  const months = useMemo(() => {
    const seen = new Set<string>();
    for (const t of initial) seen.add(format(new Date(t.date), "yyyy-MM"));
    return [...seen].sort().reverse();
  }, [initial]);

  const filtered = initial.filter((t) => {
    if (accountFilter !== "all" && t.accountId !== accountFilter) return false;
    if (catFilter === "uncategorized" && t.categoryId) return false;
    if (
      typeof catFilter === "number" &&
      t.categoryId !== catFilter
    )
      return false;
    if (
      monthFilter !== "all" &&
      format(new Date(t.date), "yyyy-MM") !== monthFilter
    )
      return false;
    if (search) {
      const q = search.toLowerCase();
      // Search what you see: the cleaned-up name — plus the raw descriptor
      // and your notes.
      const hay = `${t.merchantClean ?? ""} ${t.merchantRaw} ${t.notes ?? ""}`;
      if (!hay.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const toggleSelected = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  // Group by day
  const groups: Record<string, Transaction[]> = {};
  for (const t of filtered) {
    const k = format(new Date(t.date), "yyyy-MM-dd");
    (groups[k] ||= []).push(t);
  }

  return (
    <div className="space-y-6">
      {uncategorizedCount > 0 && (
        <RecategorizeBanner
          count={uncategorizedCount}
          onTriage={() => setTriaging(true)}
        />
      )}
      <Card className="p-3 md:p-5 sticky top-0 md:top-3 z-10">
        <div className="flex flex-col md:flex-row gap-3 md:gap-4 md:items-center">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Search
              className="size-4 text-foreground-faint shrink-0"
              strokeWidth={1.5}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search merchant or notes..."
              className="bg-transparent border-none outline-none text-sm flex-1 min-w-0 placeholder:text-foreground-faint"
            />
          </div>
          <div className="flex gap-2 md:gap-3 min-w-0 flex-wrap">
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="h-9 flex-1 min-w-0 md:flex-initial bg-surface-2 border border-border-strong rounded-md px-2 md:px-3 text-xs"
            >
              <option value="all">All months</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {format(new Date(m + "-01T00:00:00"), "MMMM yyyy")}
                </option>
              ))}
            </select>
            <select
              value={accountFilter}
              onChange={(e) =>
                setAccountFilter(
                  e.target.value === "all" ? "all" : Number(e.target.value),
                )
              }
              className="h-9 flex-1 min-w-0 md:flex-initial bg-surface-2 border border-border-strong rounded-md px-2 md:px-3 text-xs"
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
              className="h-9 flex-1 min-w-0 md:flex-initial bg-surface-2 border border-border-strong rounded-md px-2 md:px-3 text-xs"
            >
              <option value="all">All categories</option>
              <option value="uncategorized">— Uncategorized —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
              className={cn(
                "h-9 px-3 rounded-md border text-xs tracking-tight transition-colors shrink-0",
                selectMode
                  ? "border-blush bg-blush-tint text-blush-deep font-medium"
                  : "border-border-strong bg-surface-2 text-foreground-muted hover:text-foreground",
              )}
            >
              {selectMode ? "Done" : "Select"}
            </button>
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
                {/* `day` is a yyyy-MM-dd key; append local midnight so it
                    isn't parsed as midnight UTC (which renders a day early
                    in US timezones). */}
                {format(new Date(day + "T00:00:00"), "EEEE, MMMM d")}
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
                  refundNote={refundNotes[t.id]}
                  splits={splits[t.id]}
                  selectMode={selectMode}
                  isSelected={selected.has(t.id)}
                  onToggleSelect={() => toggleSelected(t.id)}
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

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Link href={`/transactions?n=${nextN}`}>
            <Button variant="outline" size="sm">
              Load older transactions
            </Button>
          </Link>
        </div>
      )}

      {selectMode && selected.size > 0 && (
        <div className="fixed bottom-20 md:bottom-6 inset-x-4 z-40 flex justify-center">
          <Card className="px-4 py-3 flex items-center gap-4 shadow-[0_12px_36px_-12px] shadow-foreground/25">
            <span className="text-sm tracking-tight">
              <span className="font-medium">{selected.size}</span> selected
            </span>
            <Button size="sm" variant="primary" onClick={() => setBulkPicking(true)}>
              Categorize
            </Button>
            <Button size="sm" variant="ghost" onClick={exitSelectMode}>
              Cancel
            </Button>
          </Card>
        </div>
      )}

      {bulkPicking && (
        <BulkCategorySheet
          count={selected.size}
          categories={categories}
          onDone={() => {
            setBulkPicking(false);
            exitSelectMode();
          }}
          onClose={() => setBulkPicking(false)}
          ids={[...selected]}
        />
      )}

      {triaging && (
        <TriageSheet
          txs={uncategorizedTx}
          categories={categories}
          onClose={() => setTriaging(false)}
        />
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
  refundNote,
  splits,
  selectMode = false,
  isSelected = false,
  onToggleSelect,
}: {
  tx: Transaction;
  cat: Category | undefined;
  acct: Account | undefined;
  categories: Category[];
  refundNote?: string;
  splits?: SplitPartView[];
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [, startTransition] = useTransition();

  const catById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const isSplit = !!splits && splits.length >= 2;
  // Compact breakdown for a split row: "Groceries $120 · Household $80".
  const splitLabel = isSplit
    ? splits!
        .map(
          (p) =>
            `${p.categoryId ? catById.get(p.categoryId)?.name ?? "Uncategorized" : "Uncategorized"} ${formatCents(
              Math.abs(p.amountCents),
            )}`,
        )
        .join(" · ")
    : null;

  const color = cat?.color ?? "var(--foreground-faint)";
  return (
    <div
      className={cn(
        "relative pl-4 md:pl-5 pr-4 md:pr-5 py-3.5 flex items-center gap-3 md:gap-3.5 group",
        tx.isTransfer && "opacity-50",
        selectMode && "cursor-pointer",
        isSelected && "bg-blush-tint/30",
      )}
      onClick={() => {
        if (selectMode) {
          onToggleSelect?.();
          return;
        }
        // Desktop has hover actions; on touch screens the row itself opens
        // the action sheet (there is no hover).
        if (window.matchMedia("(min-width: 768px)").matches) return;
        setActionsOpen(true);
      }}
    >
      {selectMode && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect?.()}
          onClick={(e) => e.stopPropagation()}
          className="accent-blush-deep size-4 shrink-0"
        />
      )}
      <CategoryGlyph icon={cat?.icon} color={color} size={36} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] md:text-sm tracking-tight truncate font-medium md:font-normal">
            {tx.merchantClean || tx.merchantRaw}
          </span>
          {tx.isTransfer && <Pill>transfer</Pill>}
          {tx.reimbursable && <Pill tone="savings">reimbursable</Pill>}
          {isSplit && <Pill tone="need">split</Pill>}
        </div>
        <div className="flex items-baseline gap-2 mt-1 md:mt-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Editing the parts is the natural action on a split row; a plain
              // recategorize would blow the split away.
              if (isSplit) setSplitting(true);
              else setPicking(true);
            }}
            className="text-[11px] text-foreground-faint hover:text-blush-deep transition-colors tracking-tight truncate"
          >
            {splitLabel ?? cat?.name ?? "— uncategorized —"}
          </button>
          {acct && (
            <span className="text-[10px] text-foreground-faint truncate">
              · {acct.name}
            </span>
          )}
          {refundNote && (
            <span className="text-[10px] text-blue-deep truncate shrink-0">
              · {refundNote}
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
          onClick={() =>
            startTransition(() => setReimbursable(tx.id, !tx.reimbursable))
          }
          className={cn(
            "size-7 inline-flex items-center justify-center rounded-md hover:bg-surface-2",
            tx.reimbursable
              ? "text-blue-deep"
              : "text-foreground-faint hover:text-foreground",
          )}
          title="Reimbursable — won't count toward spending or income"
        >
          <Receipt className="size-3.5" strokeWidth={1.5} />
        </button>
        <button
          onClick={() => setSplitting(true)}
          className={cn(
            "size-7 inline-flex items-center justify-center rounded-md hover:bg-surface-2",
            isSplit
              ? "text-blush-deep"
              : "text-foreground-faint hover:text-foreground",
          )}
          title="Split across categories"
        >
          <Split className="size-3.5" strokeWidth={1.5} />
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

      {(picking || editing || splitting || actionsOpen) && (
        // The row itself is tappable (opens the action sheet on mobile), and
        // these dialogs are its DOM children — keep their clicks from
        // bubbling back up and re-opening the sheet.
        <div onClick={(e) => e.stopPropagation()}>
          {picking && (
            <CategoryPicker
              tx={tx}
              categories={categories}
              onClose={() => setPicking(false)}
            />
          )}
          {editing && (
            <EditTxModal
              tx={tx}
              categories={categories}
              onClose={() => setEditing(false)}
            />
          )}
          {splitting && (
            <SplitSheet
              tx={tx}
              categories={categories}
              existing={splits}
              onClose={() => setSplitting(false)}
            />
          )}
          {actionsOpen && (
            <MobileActionsSheet
              tx={tx}
              cat={cat}
              isSplit={isSplit}
              onClose={() => setActionsOpen(false)}
              onEdit={() => {
                setActionsOpen(false);
                setEditing(true);
              }}
              onPick={() => {
                setActionsOpen(false);
                setPicking(true);
              }}
              onSplit={() => {
                setActionsOpen(false);
                setSplitting(true);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// Touch-screen stand-in for the desktop hover buttons: tap a row, act on it.
function MobileActionsSheet({
  tx,
  cat,
  isSplit = false,
  onClose,
  onEdit,
  onPick,
  onSplit,
}: {
  tx: Transaction;
  cat: Category | undefined;
  isSplit?: boolean;
  onClose: () => void;
  onEdit: () => void;
  onPick: () => void;
  onSplit: () => void;
}) {
  const [, startTransition] = useTransition();
  const item = (
    icon: React.ReactNode,
    label: string,
    onClick: () => void,
    danger = false,
  ) => (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-left hover:bg-surface-2 transition-colors",
        danger ? "text-blush-deep" : "text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
  return (
    <Sheet open onClose={onClose}>
      <Label>Transaction</Label>
      <div className="flex items-baseline justify-between gap-3 mt-1 mb-4">
        <h3 className="serif text-xl truncate">
          {tx.merchantClean || tx.merchantRaw}
        </h3>
        <span className="mono tabular text-sm shrink-0">
          {formatCents(tx.amountCents, { signed: tx.amountCents > 0 })}
        </span>
      </div>
      <div className="space-y-0.5">
        {item(
          <Pencil className="size-4 text-foreground-faint" strokeWidth={1.5} />,
          "Edit details",
          onEdit,
        )}
        {item(
          <Tag className="size-4 text-foreground-faint" strokeWidth={1.5} />,
          cat ? `Category: ${cat.name}` : "Give it a category",
          onPick,
        )}
        {item(
          <Split
            className={cn(
              "size-4",
              isSplit ? "text-blush-deep" : "text-foreground-faint",
            )}
            strokeWidth={1.5}
          />,
          isSplit ? "Edit split" : "Split across categories",
          onSplit,
        )}
        {item(
          <ArrowRightLeft
            className={cn(
              "size-4",
              tx.isTransfer ? "text-blush-deep" : "text-foreground-faint",
            )}
            strokeWidth={1.5}
          />,
          tx.isTransfer ? "Not a transfer" : "Mark as transfer",
          () => {
            startTransition(() => setIsTransfer(tx.id, !tx.isTransfer));
            onClose();
          },
        )}
        {item(
          <Receipt
            className={cn(
              "size-4",
              tx.reimbursable ? "text-blue-deep" : "text-foreground-faint",
            )}
            strokeWidth={1.5}
          />,
          tx.reimbursable ? "Not reimbursable" : "Reimbursable",
          () => {
            startTransition(() => setReimbursable(tx.id, !tx.reimbursable));
            onClose();
          },
        )}
        {item(
          <Trash2 className="size-4" strokeWidth={1.5} />,
          "Delete",
          () => {
            if (confirm("Delete this transaction?")) {
              startTransition(() => deleteTransaction(tx.id));
              onClose();
            }
          },
          true,
        )}
      </div>
    </Sheet>
  );
}

function EditTxModal({
  tx,
  categories,
  onClose,
}: {
  tx: Transaction;
  categories: Category[];
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const initialMerchant = tx.merchantClean || tx.merchantRaw;
  const [merchantInput, setMerchantInput] = useState(initialMerchant);
  const [saveAsRule, setSaveAsRule] = useState(true);
  const [pattern, setPattern] = useState(() => guessPatternFromRaw(tx.merchantRaw));
  const [categoryId, setCategoryIdState] = useState<string>(
    tx.categoryId ? String(tx.categoryId) : "",
  );
  const [applyCategoryToHistory, setApplyCategoryToHistory] = useState(true);
  const initialCategoryId = tx.categoryId ? String(tx.categoryId) : "";
  const categoryChanged = categoryId !== initialCategoryId;
  return (
    <Sheet open onClose={onClose}>
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
            <input
              type="hidden"
              name="saveAsRule"
              value={saveAsRule ? "1" : "0"}
            />
            <input type="hidden" name="rulePattern" value={pattern} />
            <input
              type="hidden"
              name="saveCategoryRule"
              value={categoryChanged && applyCategoryToHistory ? "1" : "0"}
            />
            <div>
              <Label>Merchant</Label>
              <Input
                name="merchant"
                value={merchantInput}
                onChange={(e) => setMerchantInput(e.target.value)}
                autoFocus
              />
              <div className="text-[10px] text-foreground-faint mt-1 mono">
                raw: {tx.merchantRaw}
              </div>
              <div className="mt-3 space-y-2">
                <label className="flex items-center gap-2 text-xs text-foreground-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAsRule}
                    onChange={(e) => setSaveAsRule(e.target.checked)}
                    className="accent-blush-deep"
                  />
                  <Zap
                    className="size-3.5 text-blush-deep"
                    strokeWidth={1.5}
                  />
                  <span>
                    Apply this name to similar transactions (past & future)
                  </span>
                </label>
                {saveAsRule && (
                  <div>
                    <Label htmlFor="rulePattern">
                      Match merchants containing
                    </Label>
                    <Input
                      id="rulePattern"
                      value={pattern}
                      onChange={(e) => setPattern(e.target.value)}
                      className="mono"
                    />
                    <div className="text-[10px] text-foreground-faint mt-1">
                      Case-insensitive.
                    </div>
                  </div>
                )}
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
              <Label>Category</Label>
              <select
                name="categoryId"
                value={categoryId}
                onChange={(e) => setCategoryIdState(e.target.value)}
                className="h-10 w-full bg-surface border border-border rounded-xl px-3.5 text-sm focus:border-sage focus:ring-2 focus:ring-sage-tint focus:outline-none transition-all"
              >
                <option value="">— Uncategorized —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {categoryChanged && categoryId && (
                <label className="flex items-center gap-2 text-xs text-foreground-muted cursor-pointer mt-2">
                  <input
                    type="checkbox"
                    checked={applyCategoryToHistory}
                    onChange={(e) =>
                      setApplyCategoryToHistory(e.target.checked)
                    }
                    className="accent-blush-deep"
                  />
                  <Zap
                    className="size-3.5 text-blush-deep"
                    strokeWidth={1.5}
                  />
                  <span>
                    Apply this category to similar transactions (past &amp;
                    future)
                  </span>
                </label>
              )}
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
    </Sheet>
  );
}

// Pick one category for every selected transaction.
function BulkCategorySheet({
  count,
  ids,
  categories,
  onClose,
  onDone,
}: {
  count: number;
  ids: number[];
  categories: Category[];
  onClose: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [pending, startTransition] = useTransition();
  const results = categories.filter((c) =>
    c.name.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <Sheet open onClose={onClose}>
      <Label>Bulk categorize</Label>
      <h3 className="serif text-xl mt-1 mb-4">
        {count} {count === 1 ? "transaction" : "transactions"}
      </h3>
      <Input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Find a category..."
      />
      <div className="max-h-72 overflow-y-auto mt-4 -mx-2">
        {results.map((c) => (
          <button
            key={c.id}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await bulkSetCategory(ids, c.id);
                router.refresh();
                onDone();
              })
            }
            className="w-full text-left px-3 py-2 hover:bg-surface-2 rounded-md flex items-center gap-3"
          >
            <CategoryGlyph icon={c.icon} color={c.color} size={28} />
            <span className="flex-1 text-sm tracking-tight">{c.name}</span>
            <Pill tone={c.classification as "need" | "want" | "savings" | "income"}>
              {c.classification}
            </Pill>
          </button>
        ))}
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Sheet>
  );
}

// Step through every uncategorized transaction, one decision at a time.
function TriageSheet({
  txs,
  categories,
  onClose,
}: {
  txs: Transaction[];
  categories: Category[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [q, setQ] = useState("");
  const [makingRule, setMakingRule] = useState(true);
  const [pending, startTransition] = useTransition();

  const done = index >= txs.length;
  const tx = txs[index];
  const results = categories.filter((c) =>
    c.name.toLowerCase().includes(q.toLowerCase()),
  );

  const advance = () => {
    setQ("");
    if (index + 1 >= txs.length) {
      router.refresh();
    }
    setIndex((i) => i + 1);
  };

  return (
    <Sheet open onClose={() => { router.refresh(); onClose(); }}>
      {done ? (
        <div className="py-10 text-center">
          <h3 className="serif text-2xl mb-2">All sorted.</h3>
          <p className="text-sm text-foreground-muted mb-6">
            Every uncategorized transaction has a bucket now.
          </p>
          <Button variant="primary" onClick={() => { router.refresh(); onClose(); }}>
            Done
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <Label>Triage</Label>
            <span className="mono tabular text-[11px] text-foreground-faint">
              {index + 1} / {txs.length}
            </span>
          </div>
          <h3 className="serif text-xl mt-1 truncate">
            {tx.merchantClean || tx.merchantRaw}
          </h3>
          <div className="text-foreground-faint text-xs mb-4 mono tabular">
            {formatCents(tx.amountCents, { signed: tx.amountCents > 0 })} ·{" "}
            {format(new Date(tx.date), "EEE, MMM d")}
          </div>
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a category..."
          />
          <div className="max-h-56 overflow-y-auto mt-3 -mx-2">
            {results.map((c) => (
              <button
                key={c.id}
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    if (makingRule) {
                      await makeRule(tx.merchantRaw, c.id, true, {});
                    } else {
                      await setCategory(tx.id, c.id);
                    }
                    advance();
                  })
                }
                className="w-full text-left px-3 py-2 hover:bg-surface-2 rounded-md flex items-center gap-3"
              >
                <CategoryGlyph icon={c.icon} color={c.color} size={28} />
                <span className="flex-1 text-sm tracking-tight">{c.name}</span>
                <Pill tone={c.classification as "need" | "want" | "savings" | "income"}>
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
              Make it a rule for{" "}
              <span className="mono text-foreground">
                {tx.merchantRaw.slice(0, 24)}
              </span>
            </span>
          </label>
          <div className="flex justify-between gap-2 mt-5">
            <Button variant="ghost" onClick={() => { router.refresh(); onClose(); }}>
              Stop
            </Button>
            <Button variant="outline" onClick={advance} disabled={pending}>
              Skip
            </Button>
          </div>
        </>
      )}
    </Sheet>
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
  // Default ON: most spending repeats, so the first time you categorize a
  // merchant you almost always want every future transaction from them to
  // land in the same bucket. Uncheck for one-offs.
  const [makingRule, setMakingRule] = useState(true);
  const [amountCond, setAmountCond] = useState<"any" | "under" | "over">("any");
  const [amountThreshold, setAmountThreshold] = useState("");
  const [pending, startTransition] = useTransition();

  const results = categories.filter((c) =>
    c.name.toLowerCase().includes(q.toLowerCase()),
  );

  const ruleBounds = (): {
    minAmountCents?: number;
    maxAmountCents?: number;
  } => {
    const cents = Math.round(Number(amountThreshold) * 100);
    if (!makingRule || amountCond === "any" || !cents) return {};
    return amountCond === "under"
      ? { maxAmountCents: cents }
      : { minAmountCents: cents };
  };

  return (
    <Sheet open onClose={onClose}>
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
                    await makeRule(tx.merchantRaw, c.id, true, ruleBounds());
                  } else {
                    await setCategory(tx.id, c.id);
                  }
                  onClose();
                })
              }
              className="w-full text-left px-3 py-2 hover:bg-surface-2 rounded-md flex items-center gap-3"
            >
              <CategoryGlyph icon={c.icon} color={c.color} size={28} />
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
        {makingRule && (
          <div className="mt-3 ml-7 flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
            <span>only when the amount is</span>
            <select
              value={amountCond}
              onChange={(e) =>
                setAmountCond(e.target.value as "any" | "under" | "over")
              }
              className="h-8 bg-surface-2 border border-border-strong rounded-md px-2 text-xs"
            >
              <option value="any">any amount</option>
              <option value="under">under</option>
              <option value="over">over</option>
            </select>
            {amountCond !== "any" && (
              <span className="inline-flex items-center gap-1">
                <span className="text-foreground-faint">$</span>
                <input
                  value={amountThreshold}
                  onChange={(e) => setAmountThreshold(e.target.value)}
                  inputMode="decimal"
                  placeholder="50"
                  className="h-8 w-16 bg-surface-2 border border-border-strong rounded-md px-2 text-xs mono tabular outline-none focus:border-blush"
                />
              </span>
            )}
          </div>
        )}
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
    </Sheet>
  );
}

// Splits one purchase across categories: a Target run that's part groceries,
// part household. The parts must add up to the transaction total; a running
// remainder shows what's left, and "assign remainder" fills a line in one tap.
// Saving locks the row (rules/Plaid won't clobber it) and drops to a normal
// single category if fewer than two parts remain.
function SplitSheet({
  tx,
  categories,
  existing,
  onClose,
}: {
  tx: Transaction;
  categories: Category[];
  existing?: SplitPartView[];
  onClose: () => void;
}) {
  const totalCents = Math.abs(tx.amountCents);
  const money = (cents: number) => (cents / 100).toFixed(2);
  const parse = (s: string) => {
    const n = Number(s);
    return Number.isFinite(n) ? Math.max(0, Math.round(n * 100)) : 0;
  };

  type Line = { key: number; categoryId: string; amount: string };
  const [lines, setLines] = useState<Line[]>(() => {
    if (existing && existing.length >= 2) {
      return existing.map((p, i) => ({
        key: i,
        categoryId: p.categoryId ? String(p.categoryId) : "",
        amount: money(Math.abs(p.amountCents)),
      }));
    }
    // Seed with the whole amount on the current category plus a blank line to
    // peel a portion into — the common "most of this is X, some is Y" case.
    return [
      {
        key: 0,
        categoryId: tx.categoryId ? String(tx.categoryId) : "",
        amount: money(totalCents),
      },
      { key: 1, categoryId: "", amount: "" },
    ];
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Income categories can't receive part of a purchase.
  const spendCats = categories.filter((c) => c.classification !== "income");

  const enteredCents = lines.reduce((s, l) => s + parse(l.amount), 0);
  const remainderCents = totalCents - enteredCents;
  const nonZero = lines.filter((l) => parse(l.amount) !== 0);
  const canSave =
    remainderCents === 0 &&
    nonZero.length >= 2 &&
    nonZero.every((l) => l.categoryId !== "");

  const setLine = (key: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = () =>
    setLines((ls) => [
      ...ls,
      {
        key: ls.reduce((m, l) => Math.max(m, l.key), 0) + 1,
        categoryId: "",
        amount: "",
      },
    ]);
  const removeLine = (key: number) =>
    setLines((ls) => (ls.length <= 1 ? ls : ls.filter((l) => l.key !== key)));
  const assignRemainder = (key: number) =>
    setLines((ls) =>
      ls.map((l) =>
        l.key === key
          ? { ...l, amount: money(parse(l.amount) + remainderCents) }
          : l,
      ),
    );

  // Photograph/upload a receipt: downscale it, parse line items via the scan
  // action, and replace the editor's lines with the per-category grouping. The
  // transaction total stays authoritative, so any tax/tip gap surfaces as the
  // usual remainder for the user to assign before saving.
  const onPickReceipt = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setScanNote(null);
    setScanning(true);
    try {
      const dataUrl = await downscaleToDataUrl(file);
      const result = await scanReceipt(dataUrl);
      if (result.splits.length === 0) {
        setScanNote("Couldn't read any line items — enter them by hand.");
        return;
      }
      setLines(
        result.splits.map((s, i) => ({
          key: i,
          categoryId: s.categoryId ? String(s.categoryId) : "",
          amount: money(s.amountCents),
        })),
      );
      const assigned = result.splits.reduce((a, s) => a + s.amountCents, 0);
      const parts = [
        result.merchant ? `Read ${result.itemCount} items from ${result.merchant}` : `Read ${result.itemCount} items`,
        totalCents - assigned !== 0
          ? "check the remainder (tax/tip), then save"
          : "review and save",
      ];
      setScanNote(parts.join(" · "));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setScanning(false);
    }
  };

  const save = () =>
    startTransition(async () => {
      setError(null);
      try {
        await saveSplits(
          tx.id,
          nonZero.map((l) => ({
            categoryId: l.categoryId ? Number(l.categoryId) : null,
            amountCents: parse(l.amount),
          })),
        );
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });

  const remove = () =>
    startTransition(async () => {
      await clearSplits(tx.id);
      onClose();
    });

  return (
    <Sheet open onClose={onClose}>
      <Label>Split transaction</Label>
      <div className="flex items-baseline justify-between gap-3 mt-1 mb-1">
        <h3 className="serif text-xl truncate">
          {tx.merchantClean || tx.merchantRaw}
        </h3>
        <span className="mono tabular text-sm shrink-0">
          {formatCents(tx.amountCents, { signed: tx.amountCents > 0 })}
        </span>
      </div>
      <p className="text-foreground-faint text-xs mb-4">
        Divide this purchase across categories so a mixed basket lands in the
        right buckets. The parts must add up to the total.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void onPickReceipt(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={scanning || pending}
        className="w-full mb-3 h-10 inline-flex items-center justify-center gap-2 rounded-md border border-dashed border-border-strong text-xs text-foreground-muted hover:text-blush-deep hover:border-blush transition-colors disabled:opacity-50"
      >
        <ScanLine className="size-4" strokeWidth={1.5} />
        {scanning ? "Reading receipt…" : "Scan a receipt to fill these in"}
      </button>
      {scanNote && (
        <div className="mb-3 text-[11px] text-blue-deep">{scanNote}</div>
      )}

      <div className="space-y-2">
        {lines.map((l) => (
          <div key={l.key} className="flex items-center gap-2">
            <select
              value={l.categoryId}
              onChange={(e) => setLine(l.key, { categoryId: e.target.value })}
              className="h-9 flex-1 min-w-0 bg-surface-2 border border-border-strong rounded-md px-2 text-xs"
            >
              <option value="">Category…</option>
              {spendCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="inline-flex items-center gap-1 h-9 px-2 bg-surface-2 border border-border-strong rounded-md focus-within:border-blush">
              <span className="text-foreground-faint text-xs">$</span>
              <input
                value={l.amount}
                onChange={(e) => setLine(l.key, { amount: e.target.value })}
                inputMode="decimal"
                placeholder="0.00"
                className="w-20 bg-transparent text-xs mono tabular outline-none text-right"
              />
            </div>
            <button
              onClick={() => removeLine(l.key)}
              disabled={lines.length <= 1}
              className="size-8 inline-flex items-center justify-center rounded-md text-foreground-faint hover:text-blush-deep hover:bg-surface-2 disabled:opacity-30"
              title="Remove line"
              aria-label="Remove line"
            >
              <X className="size-4" strokeWidth={1.5} />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addLine}
        className="mt-3 inline-flex items-center gap-1.5 text-xs text-foreground-muted hover:text-blush-deep transition-colors"
      >
        <Plus className="size-3.5" strokeWidth={1.75} />
        Add category
      </button>

      <div className="hairline my-4" />

      <div className="flex items-center justify-between text-xs">
        <span className="text-foreground-faint">
          {formatCents(enteredCents)} of {formatCents(totalCents)} assigned
        </span>
        {remainderCents === 0 ? (
          <span className="text-sage-deep font-medium">Balanced</span>
        ) : (
          <button
            onClick={() => {
              // Assign the leftover to the last line for a one-tap balance.
              const last = lines[lines.length - 1];
              if (last) assignRemainder(last.key);
            }}
            className="text-blush-deep hover:underline"
          >
            {remainderCents > 0
              ? `${formatCents(remainderCents)} left · assign it`
              : `${formatCents(-remainderCents)} over · fix it`}
          </button>
        )}
      </div>

      {error && (
        <div className="mt-3 text-xs text-blush-deep">{error}</div>
      )}

      <div className="flex justify-end gap-2 mt-5">
        {existing && existing.length >= 2 && (
          <Button variant="ghost" onClick={remove} disabled={pending}>
            Remove split
          </Button>
        )}
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button variant="primary" onClick={save} disabled={!canSave || pending}>
          {pending ? "Saving…" : "Save split"}
        </Button>
      </div>
    </Sheet>
  );
}
