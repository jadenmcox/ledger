"use client";

import { confirmDialog } from "@/components/confirm";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { Button, Card, Input, Label } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { CategoryGlyph, CATEGORY_ICON_NAMES } from "@/components/category-glyph";
import { formatCents, parseDollarsToCents, cn } from "@/lib/utils";
import type { BudgetFramework, Classification } from "@/db/schema";
import type { LedgerEntry } from "@/lib/ledger";
import {
  bulkSetMonthlyLimits,
  createCategory,
  deleteCategory,
  setBudgetFramework,
  setExpectedIncomeOverride,
  setMonthlyLimit,
  updateCategory,
} from "./actions";

export type BudgetCategory = {
  id: number;
  name: string;
  color: string;
  icon: string;
  classification: Classification;
  isSystem: boolean;
  limitCents: number | null;
  // This month: spending for need/want/savings, money in for income.
  spent: number;
  entries: LedgerEntry[];
  suggest: { average: number; split5030: number; fitIncome: number };
};

type FillMode = "average" | "split5030" | "fitIncome";

const GROUPS: { cls: Classification; label: string; blurb: string }[] = [
  { cls: "need", label: "Needs", blurb: "rent, groceries, bills" },
  { cls: "want", label: "Wants", blurb: "eating out, shopping, fun" },
  { cls: "savings", label: "Saving & investing", blurb: "money you keep" },
];

const TYPE_LABEL: Record<Classification, string> = {
  need: "Need",
  want: "Want",
  savings: "Saving",
  income: "Income",
};

const SWATCHES = [
  "#f0478e",
  "#e5484d",
  "#f76b15",
  "#e5a50a",
  "#30a46c",
  "#12a594",
  "#0090ff",
  "#3e63dd",
  "#8e4ec6",
  "#ab4aba",
  "#978365",
  "#6f6e77",
];

const OPEN_NEW = "budgetly:new-category";

export function NewCategoryButton() {
  return (
    <Button variant="outline" size="sm" onClick={() => window.dispatchEvent(new Event(OPEN_NEW))}>
      <Plus className="size-4" strokeWidth={1.75} />
      <span className="hidden sm:inline">New category</span>
    </Button>
  );
}

const toDollars = (cents: number | null | undefined) =>
  cents != null && cents > 0 ? String(Math.round(cents / 100)) : "";

export function BudgetClient({
  categories,
  spent,
  saved,
  incomeReceived,
  expectedIncome,
  incomeOverride,
  derivedIncome,
  uncategorizedSpend,
  uncategorizedCount,
  dayOfMonth,
  daysInMonth,
  framework,
  basisMonths,
  hasHistory,
  initialOpenId,
}: {
  categories: BudgetCategory[];
  spent: number;
  saved: number;
  incomeReceived: number;
  expectedIncome: number;
  incomeOverride: number | null;
  derivedIncome: number;
  uncategorizedSpend: number;
  uncategorizedCount: number;
  dayOfMonth: number;
  daysInMonth: number;
  framework: BudgetFramework;
  basisMonths: number;
  hasHistory: boolean;
  initialOpenId: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [openId, setOpenId] = useState<number | null>(initialOpenId);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const open = () => setCreating(true);
    window.addEventListener(OPEN_NEW, open);
    return () => window.removeEventListener(OPEN_NEW, open);
  }, []);

  const initialDrafts = useMemo(() => {
    const d: Record<number, string> = {};
    for (const c of categories) d[c.id] = toDollars(c.limitCents);
    return d;
  }, [categories]);
  const [drafts, setDrafts] = useState(initialDrafts);
  const [fillFramework, setFillFramework] = useState<BudgetFramework | null>(null);
  // Fresh server data resets the drafts, but never mid-edit.
  const [syncedFrom, setSyncedFrom] = useState(initialDrafts);
  if (!editing && syncedFrom !== initialDrafts) {
    setSyncedFrom(initialDrafts);
    setDrafts(initialDrafts);
  }
  const draftCents = (id: number) => {
    const v = drafts[id];
    return v ? parseDollarsToCents(v) : null;
  };

  const spendCats = categories.filter((c) => c.classification === "need" || c.classification === "want");
  const saveCats = categories.filter((c) => c.classification === "savings");
  const incomeCats = categories.filter((c) => c.classification === "income");
  const limitOf = (c: BudgetCategory) => (editing ? draftCents(c.id) : c.limitCents) ?? 0;
  const plannedSpending = spendCats.reduce((s, c) => s + limitOf(c), 0);
  const plannedSaving = saveCats.reduce((s, c) => s + limitOf(c), 0);
  const planTotal = plannedSpending + plannedSaving;
  const leftToSpend = plannedSpending - spent;
  const daysLeft = daysInMonth - dayOfMonth;
  const calendarPct = (dayOfMonth / daysInMonth) * 100;

  const dirty = categories.some((c) => (c.limitCents ?? null) !== draftCents(c.id));
  const saveDrafts = () => {
    const updates = categories
      .filter((c) => (c.limitCents ?? null) !== draftCents(c.id))
      .map((c) => ({ id: c.id, limitCents: draftCents(c.id) }));
    startTransition(async () => {
      if (updates.length) await bulkSetMonthlyLimits(updates);
      if (fillFramework && fillFramework !== framework) await setBudgetFramework(fillFramework);
      setFillFramework(null);
      setEditing(false);
    });
  };

  const open = categories.find((c) => c.id === openId) ?? null;

  return (
    <div className="space-y-8 md:space-y-10">
      {/* SUMMARY */}
      <Card className="overflow-hidden">
        <div className="p-5 md:p-7">
          {plannedSpending > 0 ? (
            <>
              <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
                <div>
                  <div
                    className="text-[10px] font-bold uppercase tracking-[0.08em]"
                    style={{ color: leftToSpend >= 0 ? "var(--blue-deep)" : "var(--blush-deep)" }}
                  >
                    {leftToSpend >= 0 ? "Left to spend" : "Over your plan"}
                  </div>
                  <div className="display mt-1.5 text-[2.6rem] leading-none md:text-[3.2rem]">
                    {formatCents(Math.abs(leftToSpend))}
                  </div>
                </div>
                <div className="pb-1 text-sm text-foreground-muted">
                  <span className="mono tabular text-foreground">{formatCents(spent)}</span> spent of{" "}
                  <span className="mono tabular text-foreground">{formatCents(plannedSpending)}</span> planned
                </div>
              </div>
              <div className="relative mt-5">
                <div className="h-3 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (spent / plannedSpending) * 100)}%`,
                      background: leftToSpend >= 0 ? "var(--blush)" : "var(--blush-deep)",
                    }}
                  />
                </div>
                <div
                  className="absolute -top-1 h-5 w-0.5 rounded-full bg-foreground/70"
                  style={{ left: `${calendarPct}%` }}
                  title="today"
                />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-foreground-faint">
                <span>
                  {Math.round((spent / plannedSpending) * 100)}% of your spending plan used
                </span>
                <span>
                  today, {daysLeft} {daysLeft === 1 ? "day" : "days"} left
                </span>
              </div>
            </>
          ) : (
            <div className="py-2">
              <div className="display text-2xl">No plan yet for this month.</div>
              <p className="mt-2 text-sm text-foreground-muted">
                Give each category a monthly limit and this shows what&apos;s left to spend.
              </p>
              <Button className="mt-4" variant="primary" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="size-3.5" strokeWidth={1.75} /> Set limits
              </Button>
            </div>
          )}
        </div>
        <div className="divide-y divide-border border-t border-border bg-surface-2/40 text-sm">
          <IncomeLine
            expectedIncome={expectedIncome}
            incomeReceived={incomeReceived}
            incomeOverride={incomeOverride}
            derivedIncome={derivedIncome}
          />
          {plannedSaving > 0 && (
            <div className="flex items-center justify-between gap-3 px-5 py-3 md:px-7">
              <span className="text-foreground-muted">Saving & investing</span>
              <span className="text-foreground-muted">
                <span className="mono tabular text-foreground">{formatCents(saved)}</span> of{" "}
                {formatCents(plannedSaving)}
              </span>
            </div>
          )}
          {expectedIncome > 0 && planTotal > 0 && (
            <PlanVsIncome planTotal={planTotal} expectedIncome={expectedIncome} />
          )}
        </div>
      </Card>

      {uncategorizedCount > 0 && (
        <Link
          href="/transactions?cat=uncategorized"
          className="flex items-center gap-3 rounded-card bg-surface px-5 py-4 transition-colors hover:bg-surface-2/60"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blush-tint text-blush-deep">
            <Tag className="size-4" strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1 text-sm">
            <span className="font-medium">{formatCents(uncategorizedSpend)}</span>
            <span className="text-foreground-muted">
              {" "}
              across {uncategorizedCount} {uncategorizedCount === 1 ? "charge has" : "charges have"} no
              category, so no limit below sees it.
            </span>
          </span>
          <span className="shrink-0 text-xs font-medium text-foreground-muted">Sort</span>
          <ChevronRight className="size-4 shrink-0 text-foreground-faint" strokeWidth={2} />
        </Link>
      )}

      {/* EDIT TOOLBAR */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="display text-lg md:text-xl">Categories</h2>
        {!editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" strokeWidth={1.75} /> Edit limits
          </Button>
        )}
      </div>

      {editing && (
        <FillBar
          framework={framework}
          basisMonths={basisMonths}
          hasHistory={hasHistory}
          hasIncome={expectedIncome > 0}
          onFill={(mode) => {
            const next: Record<number, string> = { ...drafts };
            for (const c of [...spendCats, ...saveCats]) {
              const v = c.suggest[mode];
              next[c.id] = v > 0 ? String(Math.round(v / 100)) : "";
            }
            setDrafts(next);
            setFillFramework(
              mode === "split5030" ? "50_30_20" : mode === "fitIncome" ? "zero_based" : "custom",
            );
          }}
          onReset={() => setDrafts(initialDrafts)}
        />
      )}

      {GROUPS.map(({ cls, label, blurb }) => {
        const rows = categories.filter((c) => c.classification === cls);
        if (rows.length === 0) return null;
        const visible =
          editing || showAll[cls]
            ? rows
            : rows.filter((c) => (c.limitCents ?? 0) > 0 || c.spent > 0);
        const hidden = rows.length - visible.length;
        const groupPlanned = rows.reduce((s, c) => s + limitOf(c), 0);
        const groupSpent = rows.reduce((s, c) => s + c.spent, 0);
        return (
          <section key={cls}>
            <div className="mb-2.5 flex items-baseline justify-between gap-3 px-1">
              <div>
                <span className="text-sm font-medium tracking-tight">{label}</span>
                <span className="ml-2 text-[11px] text-foreground-faint">{blurb}</span>
              </div>
              <span className="text-[12px] text-foreground-faint">
                <span className="mono tabular text-foreground-muted">{formatCents(groupSpent)}</span>
                {groupPlanned > 0 && <> of {formatCents(groupPlanned)}</>}
              </span>
            </div>
            <Card className="divide-y divide-border overflow-hidden">
              {visible.length === 0 && (
                <div className="px-5 py-4 text-sm text-foreground-faint">
                  Nothing planned or spent here yet.
                </div>
              )}
              {visible.map((c) => (
                <CategoryRow
                  key={c.id}
                  c={c}
                  editing={editing}
                  draft={drafts[c.id] ?? ""}
                  onDraft={(v) => setDrafts((p) => ({ ...p, [c.id]: v }))}
                  onOpen={() => setOpenId(c.id)}
                />
              ))}
              {hidden > 0 && (
                <button
                  onClick={() => setShowAll((p) => ({ ...p, [cls]: true }))}
                  className="flex w-full items-center gap-2 px-5 py-3 text-left text-[12px] text-foreground-muted transition-colors hover:bg-surface-2/50 hover:text-foreground"
                >
                  <ChevronDown className="size-3.5" strokeWidth={2} />
                  {hidden} more with no limit and nothing spent
                </button>
              )}
            </Card>
          </section>
        );
      })}

      {incomeCats.some((c) => c.spent > 0) && !editing && (
        <section>
          <div className="mb-2.5 flex items-baseline justify-between gap-3 px-1">
            <span className="text-sm font-medium tracking-tight">Income this month</span>
            <span className="mono tabular text-[12px] text-foreground-muted">
              +{formatCents(incomeReceived)}
            </span>
          </div>
          <Card className="divide-y divide-border overflow-hidden">
            {incomeCats
              .filter((c) => c.spent > 0)
              .map((c) => (
                <button
                  key={c.id}
                  onClick={() => setOpenId(c.id)}
                  className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-surface-2/50 md:px-5"
                >
                  <CategoryGlyph icon={c.icon} color={c.color} size={34} />
                  <span className="min-w-0 flex-1 truncate text-sm tracking-tight">{c.name}</span>
                  <span className="mono tabular text-sm text-blue-deep">+{formatCents(c.spent)}</span>
                  <ChevronRight className="size-4 shrink-0 text-foreground-faint" strokeWidth={2} />
                </button>
              ))}
          </Card>
        </section>
      )}

      {editing && (
        <div className="sticky bottom-24 z-20 md:bottom-6">
          <Card className="flex items-center justify-between gap-3 px-4 py-3 shadow-[0_12px_36px_-12px] shadow-foreground/25">
            <span className="text-sm text-foreground-muted">
              Plan: <span className="mono tabular text-foreground">{formatCents(planTotal)}</span>
              {expectedIncome > 0 && <> of {formatCents(expectedIncome)} income</>}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDrafts(initialDrafts);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={saveDrafts} disabled={pending || (!dirty && !fillFramework)}>
                {pending ? "Saving…" : "Save limits"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {open && (
        <CategorySheet
          c={open}
          onClose={() => {
            setOpenId(null);
            if (initialOpenId) router.replace("/budget", { scroll: false });
          }}
        />
      )}
      {creating && <CategoryFormSheet onClose={() => setCreating(false)} />}
    </div>
  );
}

function IncomeLine({
  expectedIncome,
  incomeReceived,
  incomeOverride,
  derivedIncome,
}: {
  expectedIncome: number;
  incomeReceived: number;
  incomeOverride: number | null;
  derivedIncome: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const save = (cents: number | null) =>
    startTransition(async () => {
      await setExpectedIncomeOverride(cents);
      setEditing(false);
    });

  if (editing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-7">
        <span className="text-foreground-muted">Expected monthly income</span>
        <div className="flex items-center gap-2">
          <span className="text-foreground-faint">$</span>
          <Input
            autoFocus
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save(draft.trim() ? parseDollarsToCents(draft) : null);
              if (e.key === "Escape") setEditing(false);
            }}
            className="h-9 w-28 text-right mono tabular"
          />
          <Button
            size="sm"
            variant="primary"
            disabled={pending}
            onClick={() => save(draft.trim() ? parseDollarsToCents(draft) : null)}
          >
            Save
          </Button>
          {incomeOverride != null && derivedIncome > 0 && (
            <button
              onClick={() => save(null)}
              className="text-xs text-foreground-muted hover:text-foreground"
            >
              use paychecks
            </button>
          )}
          <button
            onClick={() => setEditing(false)}
            aria-label="Cancel"
            className="grid size-8 place-items-center rounded-full text-foreground-faint hover:bg-surface hover:text-foreground"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    );
  }
  return (
    <button
      onClick={() => {
        setDraft(expectedIncome > 0 ? String(Math.round(expectedIncome / 100)) : "");
        setEditing(true);
      }}
      className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-2/60 md:px-7"
    >
      <span className="min-w-0 text-foreground-muted">
        Expected income
        {expectedIncome > 0 && (
          <span className="block text-[11px] text-foreground-faint">
            {formatCents(incomeReceived)} in so far
          </span>
        )}
      </span>
      <span className="flex items-center gap-2">
        <span className="mono tabular">
          {expectedIncome > 0 ? formatCents(expectedIncome) : "Set it"}
        </span>
        <Pencil className="size-3.5 text-foreground-faint" strokeWidth={1.5} />
      </span>
    </button>
  );
}

// Does the plan use your income? One sentence instead of a "ready to
// allocate" ledger.
function PlanVsIncome({ planTotal, expectedIncome }: { planTotal: number; expectedIncome: number }) {
  const gap = expectedIncome - planTotal;
  let text: string;
  let color = "var(--foreground-muted)";
  if (Math.abs(gap) < 100) {
    text = "Every dollar of expected income has a job in the plan.";
    color = "var(--blue-deep)";
  } else if (gap > 0) {
    text = `${formatCents(gap)} of expected income isn't planned yet. Give it a category, or let it sit as extra savings.`;
  } else {
    text = `The plan is ${formatCents(-gap)} more than you expect to earn. Lower a limit or two to make it fit.`;
    color = "var(--blush-deep)";
  }
  return (
    <div className="flex items-start gap-2.5 px-5 py-3 md:px-7" style={{ color }}>
      {Math.abs(gap) < 100 && <Check className="mt-0.5 size-4 shrink-0" strokeWidth={2.5} />}
      <span className="text-[13px]">{text}</span>
    </div>
  );
}

function CategoryRow({
  c,
  editing,
  draft,
  onDraft,
  onOpen,
}: {
  c: BudgetCategory;
  editing: boolean;
  draft: string;
  onDraft: (v: string) => void;
  onOpen: () => void;
}) {
  const limit = c.limitCents ?? 0;
  const over = limit > 0 && c.spent > limit;
  const pct = limit > 0 ? Math.min(100, (c.spent / limit) * 100) : 0;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={editing ? undefined : onOpen}
      onKeyDown={(e) => {
        if (!editing && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "flex items-center gap-3.5 px-4 py-3.5 md:px-5",
        !editing && "cursor-pointer transition-colors hover:bg-surface-2/50",
      )}
    >
      <CategoryGlyph icon={c.icon} color={c.color} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm tracking-tight">{c.name}</span>
          {!editing && (
            <span className="shrink-0 text-[12px] text-foreground-faint">
              <span className={cn("mono tabular", over ? "text-blush-deep" : "text-foreground")}>
                {formatCents(c.spent)}
              </span>
              {limit > 0 ? <> of {formatCents(limit)}</> : " spent"}
            </span>
          )}
        </div>
        {limit > 0 && !editing ? (
          <div className="mt-2 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: over ? "var(--blush-deep)" : c.color }}
              />
            </div>
            <span
              className={cn(
                "w-24 shrink-0 text-right text-[11px]",
                over ? "text-blush-deep" : "text-foreground-faint",
              )}
            >
              {over ? `${formatCents(c.spent - limit)} over` : `${formatCents(limit - c.spent)} left`}
            </span>
          </div>
        ) : (
          !editing && <div className="mt-0.5 text-[11px] text-foreground-faint">no limit set</div>
        )}
        {editing && c.suggest.average > 0 && (
          <div className="mt-0.5 text-[11px] text-foreground-faint">
            usually {formatCents(c.suggest.average)}/mo
          </div>
        )}
      </div>
      {editing && (
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-sm text-foreground-faint">$</span>
          <Input
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            inputMode="decimal"
            placeholder="none"
            className="h-9 w-24 text-right mono tabular md:w-28"
          />
        </div>
      )}
      {!editing && <ChevronRight className="size-4 shrink-0 text-foreground-faint" strokeWidth={2} />}
    </div>
  );
}

function FillBar({
  framework,
  basisMonths,
  hasHistory,
  hasIncome,
  onFill,
  onReset,
}: {
  framework: BudgetFramework;
  basisMonths: number;
  hasHistory: boolean;
  hasIncome: boolean;
  onFill: (mode: FillMode) => void;
  onReset: () => void;
}) {
  const [mode, setMode] = useState<FillMode>(
    framework === "50_30_20" && hasIncome
      ? "split5030"
      : framework === "zero_based" && hasIncome
        ? "fitIncome"
        : "average",
  );
  const options: { id: FillMode; label: string; note: string; needsIncome?: boolean }[] = [
    {
      id: "average",
      label: "What I usually spend",
      note: `Your average over the last ${basisMonths} ${basisMonths === 1 ? "month" : "months"}.`,
    },
    {
      id: "split5030",
      label: "50 / 30 / 20",
      note: "Half of income to needs, 30% to wants, 20% to saving.",
      needsIncome: true,
    },
    {
      id: "fitIncome",
      label: "Fit to my income",
      note: "Your usual spending, scaled so the plan uses exactly your income.",
      needsIncome: true,
    },
  ];
  const current = options.find((o) => o.id === mode)!;
  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-center gap-2 text-sm font-medium tracking-tight">
        <Sparkles className="size-4 text-blush-deep" strokeWidth={1.75} /> Fill in limits for me
      </div>
      {!hasHistory ? (
        <p className="mt-2 text-[12px] text-foreground-muted">
          Once you have a month of history, this can suggest limits.
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {options.map((o) => {
              const disabled = o.needsIncome && !hasIncome;
              return (
                <button
                  key={o.id}
                  disabled={disabled}
                  onClick={() => setMode(o.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[12px] tracking-tight transition-colors disabled:opacity-40",
                    mode === o.id
                      ? "border-blush bg-blush-tint/60 text-foreground"
                      : "border-border bg-surface text-foreground-muted hover:border-border-strong",
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[12px] text-foreground-muted">
            {current.note} You can still change any number before saving.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="primary" onClick={() => onFill(mode)}>
              Fill in
            </Button>
            <Button size="sm" variant="ghost" onClick={onReset}>
              <RotateCcw className="size-3.5" strokeWidth={1.75} /> Undo changes
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

function CategorySheet({ c, onClose }: { c: BudgetCategory; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [limit, setLimit] = useState(toDollars(c.limitCents));
  const [editingDetails, setEditingDetails] = useState(false);
  const isIncome = c.classification === "income";
  const limitCents = limit.trim() ? parseDollarsToCents(limit) : null;
  const limitDirty = (c.limitCents ?? null) !== limitCents;

  if (editingDetails) {
    return <CategoryFormSheet initial={c} onClose={onClose} />;
  }

  return (
    <Sheet open onClose={onClose}>
      <div className="flex items-center gap-3">
        <CategoryGlyph icon={c.icon} color={c.color} size={44} />
        <div className="min-w-0 flex-1">
          <h3 className="display truncate text-xl">{c.name}</h3>
          <div className="text-[12px] text-foreground-faint">{TYPE_LABEL[c.classification]}</div>
        </div>
        <button
          onClick={() => setEditingDetails(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-foreground-muted transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <Pencil className="size-3" strokeWidth={1.75} /> Edit
        </button>
      </div>

      <div className="mt-5 rounded-2xl bg-surface-2/60 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-foreground-muted">
            {isIncome ? "Came in this month" : "Spent this month"}
          </span>
          <span className="mono tabular text-lg">{formatCents(c.spent)}</span>
        </div>
        {!isIncome && (
          <div className="mt-3 flex items-center gap-2">
            <span className="flex-1 text-sm text-foreground-muted">Monthly limit</span>
            <span className="text-sm text-foreground-faint">$</span>
            <Input
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              inputMode="decimal"
              placeholder="none"
              className="h-9 w-28 text-right mono tabular"
            />
            {limitDirty && (
              <Button
                size="sm"
                variant="primary"
                disabled={pending}
                onClick={() => startTransition(() => setMonthlyLimit(c.id, limitCents))}
              >
                Save
              </Button>
            )}
          </div>
        )}
        {!isIncome && c.suggest.average > 0 && (
          <div className="mt-2 text-right text-[11px] text-foreground-faint">
            you usually spend {formatCents(c.suggest.average)} a month here
          </div>
        )}
      </div>

      <div className="mt-5 mb-2 flex items-baseline justify-between">
        <Label className="mb-0">This month</Label>
        <Link
          href={`/transactions?cat=${c.id}`}
          className="text-[12px] text-foreground-muted hover:text-foreground"
        >
          All transactions
        </Link>
      </div>
      {c.entries.length === 0 ? (
        <p className="py-3 text-sm text-foreground-faint">Nothing yet this month.</p>
      ) : (
        <ul className="divide-y divide-border/70">
          {c.entries.map((e, i) => (
            <li key={`${e.id}-${i}`} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm tracking-tight">{e.merchant}</div>
                <div className="text-[11px] text-foreground-faint">
                  {format(new Date(e.date), "EEE, MMM d")}
                  {e.note && <span className="text-blue-deep"> · {e.note}</span>}
                </div>
              </div>
              <span className={cn("mono tabular shrink-0 text-sm", e.amountCents > 0 && "text-blue-deep")}>
                {formatCents(e.amountCents, { signed: e.amountCents > 0 })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function CategoryFormSheet({
  initial,
  onClose,
}: {
  initial?: BudgetCategory;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initial?.name ?? "");
  const [cls, setCls] = useState<Classification>(initial?.classification ?? "want");
  const [color, setColor] = useState(initial?.color ?? SWATCHES[0]);
  const [icon, setIcon] = useState(initial?.icon ?? "tag");
  const [limit, setLimit] = useState(toDollars(initial?.limitCents));
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    const input = {
      name,
      classification: cls,
      color,
      icon,
      limitCents: limit.trim() ? parseDollarsToCents(limit) : null,
    };
    startTransition(async () => {
      const r = initial ? await updateCategory(initial.id, input) : await createCategory(input);
      if (r.ok) onClose();
      else setError(r.error);
    });
  };

  return (
    <Sheet open onClose={onClose}>
      <Label>{initial ? "Edit category" : "New category"}</Label>
      <div className="mt-2 flex items-center gap-3">
        <CategoryGlyph icon={icon} color={color} size={44} />
        <Input
          autoFocus={!initial}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name, like Pets or Climbing"
        />
      </div>

      <Label className="mt-5">Type</Label>
      <div className="grid grid-cols-4 gap-1.5 rounded-2xl bg-surface-2 p-1">
        {(["need", "want", "savings", "income"] as Classification[]).map((t) => (
          <button
            key={t}
            onClick={() => setCls(t)}
            className={cn(
              "rounded-xl py-2 text-[13px] tracking-tight transition-colors",
              cls === t ? "bg-surface font-medium shadow-sm" : "text-foreground-muted",
            )}
          >
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <Label className="mt-5">Color</Label>
      <div className="flex flex-wrap gap-2">
        {SWATCHES.map((s) => (
          <button
            key={s}
            onClick={() => setColor(s)}
            aria-label={s}
            className={cn(
              "size-8 rounded-full ring-offset-2 ring-offset-surface transition-shadow",
              color.toLowerCase() === s && "ring-2 ring-foreground",
            )}
            style={{ background: s }}
          />
        ))}
      </div>

      <Label className="mt-5">Icon</Label>
      <div className="grid grid-cols-8 gap-1.5">
        {CATEGORY_ICON_NAMES.map((n) => (
          <button
            key={n}
            onClick={() => setIcon(n)}
            aria-label={n}
            className={cn(
              "grid place-items-center rounded-xl p-1 transition-colors",
              icon === n ? "bg-surface-2 ring-1 ring-border-strong" : "hover:bg-surface-2",
            )}
          >
            <CategoryGlyph icon={n} color={icon === n ? color : "var(--foreground-faint)"} size={30} />
          </button>
        ))}
      </div>

      {cls !== "income" && (
        <>
          <Label className="mt-5">Monthly limit (optional)</Label>
          <div className="flex items-center gap-2">
            <span className="text-foreground-faint">$</span>
            <Input
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              inputMode="decimal"
              placeholder="none"
            />
          </div>
        </>
      )}

      {error && <p className="mt-3 text-xs text-blush-deep">{error}</p>}
      <div className="mt-6 flex items-center justify-between gap-2">
        {initial && !initial.isSystem ? (
          <button
            onClick={async () => {
              const ok = await confirmDialog({
                title: `Delete ${initial.name}?`,
                body: "Its transactions keep their merchant but lose their category.",
                confirmLabel: "Delete category",
                danger: true,
              });
              if (ok)
                startTransition(async () => {
                  await deleteCategory(initial.id);
                  onClose();
                });
            }}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs text-blush-deep hover:bg-blush-tint/60"
          >
            <Trash2 className="size-3.5" strokeWidth={1.75} /> Delete
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={pending || !name.trim()}>
            {pending ? "Saving…" : initial ? "Save" : "Add category"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
