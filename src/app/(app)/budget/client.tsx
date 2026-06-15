"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Card,
  Label,
  Input,
  Button,
  Pill,
  ProgressBar,
  SectionHeader,
  Stat,
  HeroStat,
} from "@/components/ui";
import { formatCents, formatCentsCompact, parseDollarsToCents } from "@/lib/utils";
import { format } from "date-fns";
import { Check, Sparkles, ArrowRight } from "lucide-react";
import type { BudgetFramework, Classification } from "@/db/schema";
import { bulkSetMonthlyLimits, setBudgetFramework } from "./actions";

type CatRow = {
  id: number;
  name: string;
  color: string;
  classification: Classification;
  monthlyLimitCents: number | null;
  spent: number;
  upcoming: number;
};

type UpcomingItem = {
  merchant: string;
  amountCents: number;
  date: string;
  categoryId: number | null;
};

const FRAMEWORKS: {
  id: BudgetFramework;
  label: string;
  blurb: string;
  splits?: { need: number; want: number; savings: number };
}[] = [
  {
    id: "50_30_20",
    label: "50 / 30 / 20",
    blurb: "50% needs, 30% wants, 20% savings. Classic Warren / Tyagi.",
    splits: { need: 0.5, want: 0.3, savings: 0.2 },
  },
  {
    id: "zero_based",
    label: "Zero-based",
    blurb: "Every dollar of income assigned to a category. Limits should sum to income.",
  },
  {
    id: "custom",
    label: "Custom",
    blurb: "Set whatever limits make sense. No allocation suggestions.",
  },
];

const classificationOrder: Classification[] = ["income", "need", "want", "savings"];
const classificationLabel: Record<Classification, string> = {
  income: "Income",
  need: "Needs",
  want: "Wants",
  savings: "Savings",
};
const classificationTone: Record<Classification, "need" | "want" | "savings" | "income"> = {
  income: "income",
  need: "need",
  want: "want",
  savings: "savings",
};

export function BudgetClient({
  framework,
  income,
  incomeBasis,
  spend,
  spendByClassification,
  projectedSpend,
  totalLimit,
  upcomingTotal,
  upcomingList,
  dayOfMonth,
  daysInMonth,
  calendarPct,
  categories,
}: {
  framework: BudgetFramework;
  income: number;
  incomeBasis: number;
  spend: number;
  spendByClassification: { need: number; want: number; savings: number };
  projectedSpend: number;
  totalLimit: number;
  upcomingTotal: number;
  upcomingList: UpcomingItem[];
  dayOfMonth: number;
  daysInMonth: number;
  calendarPct: number;
  categories: CatRow[];
}) {
  const [selectedFramework, setSelectedFramework] =
    useState<BudgetFramework>(framework);
  const [pending, startTransition] = useTransition();

  // Local-edited limits for the edit-all view (dollars as strings, persisted on save).
  const initialDrafts = useMemo(() => {
    const m: Record<number, string> = {};
    for (const c of categories) {
      m[c.id] = c.monthlyLimitCents != null
        ? (c.monthlyLimitCents / 100).toFixed(0)
        : "";
    }
    return m;
  }, [categories]);
  const [drafts, setDrafts] = useState<Record<number, string>>(initialDrafts);

  const draftCents = (id: number): number | null => {
    const v = drafts[id];
    if (v == null || v === "") return null;
    return parseDollarsToCents(v);
  };

  const dirty = useMemo(() => {
    for (const c of categories) {
      const orig = c.monthlyLimitCents ?? null;
      const curr = draftCents(c.id);
      if (orig !== curr) return true;
    }
    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts, categories]);

  const byClass: Record<Classification, CatRow[]> = {
    income: [],
    need: [],
    want: [],
    savings: [],
  };
  for (const c of categories) byClass[c.classification].push(c);

  const limitByClass = (cls: Classification) =>
    byClass[cls].reduce((s, c) => s + (c.monthlyLimitCents ?? 0), 0);
  const draftLimitByClass = (cls: Classification) =>
    byClass[cls].reduce((s, c) => s + (draftCents(c.id) ?? 0), 0);

  const remainingByClass = {
    need: Math.max(
      0,
      limitByClass("need") - spendByClassification.need,
    ),
    want: Math.max(
      0,
      limitByClass("want") - spendByClassification.want,
    ),
    savings: Math.max(
      0,
      limitByClass("savings") - spendByClassification.savings,
    ),
  };
  const upcomingByClass = (() => {
    const m: Record<Classification, number> = { income: 0, need: 0, want: 0, savings: 0 };
    for (const c of categories) m[c.classification] += c.upcoming;
    return m;
  })();
  const daysLeft = daysInMonth - dayOfMonth;

  // Suggested allocations based on framework + incomeBasis.
  const suggested = useMemo(() => {
    if (selectedFramework === "50_30_20") {
      return {
        need: Math.round(incomeBasis * 0.5),
        want: Math.round(incomeBasis * 0.3),
        savings: Math.round(incomeBasis * 0.2),
      };
    }
    if (selectedFramework === "zero_based") {
      // Suggest scaling current draft limits up/down so they sum to income.
      const total = ["need", "want", "savings"].reduce(
        (s, k) => s + draftLimitByClass(k as Classification),
        0,
      );
      if (total <= 0 || incomeBasis <= 0) {
        return { need: 0, want: 0, savings: 0 };
      }
      const ratio = incomeBasis / total;
      return {
        need: Math.round(draftLimitByClass("need") * ratio),
        want: Math.round(draftLimitByClass("want") * ratio),
        savings: Math.round(draftLimitByClass("savings") * ratio),
      };
    }
    return null; // custom — no suggestion
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFramework, incomeBasis, drafts, categories]);

  const onPickFramework = (f: BudgetFramework) => {
    setSelectedFramework(f);
    startTransition(async () => {
      await setBudgetFramework(f);
    });
  };

  const onSave = () => {
    const updates = categories
      .map((c) => ({
        id: c.id,
        limitCents: draftCents(c.id),
      }))
      .filter((u, i) => u.limitCents !== (categories[i].monthlyLimitCents ?? null));
    if (updates.length === 0) return;
    startTransition(async () => {
      await bulkSetMonthlyLimits(updates);
    });
  };

  const onApplySuggested = () => {
    if (!suggested) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const cls of ["need", "want", "savings"] as Classification[]) {
        const rows = byClass[cls];
        const currentTotal = rows.reduce((s, r) => s + (draftCents(r.id) ?? 0), 0);
        const target = suggested[cls as "need" | "want" | "savings"];
        if (rows.length === 0) continue;
        if (currentTotal <= 0) {
          // Even split when no existing values
          const per = Math.round(target / rows.length);
          for (const r of rows) next[r.id] = (per / 100).toFixed(0);
        } else {
          const ratio = target / currentTotal;
          for (const r of rows) {
            const c = (draftCents(r.id) ?? 0) * ratio;
            next[r.id] = (c / 100).toFixed(0);
          }
        }
      }
      return next;
    });
  };

  return (
    <div className="space-y-10 md:space-y-14">
      {/* GLANCE */}
      <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-8 md:gap-12 items-start">
        <div>
          <HeroStat
            label="Spent so far"
            value={formatCents(spend)}
            tone="blush"
            hint={
              totalLimit > 0
                ? `of ${formatCentsCompact(totalLimit)} budgeted · ${daysLeft} days left`
                : `${daysLeft} days left this month`
            }
          />
          <div className="mt-5">
            <Label>Calendar progress</Label>
            <ProgressBar
              value={dayOfMonth}
              max={daysInMonth}
              color="var(--sage-deep)"
              warnAt={1.1}
            />
            <div className="flex items-center justify-between text-[11px] text-foreground-faint mt-1.5 mono tabular">
              <span>Day {dayOfMonth} of {daysInMonth}</span>
              <span>{calendarPct.toFixed(0)}%</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-border rounded-2xl overflow-hidden border border-border">
          <div className="bg-surface p-5">
            <Stat
              label="Income in"
              value={formatCents(income)}
              hint={income < incomeBasis ? `${formatCentsCompact(incomeBasis)} expected` : undefined}
            />
          </div>
          <div className="bg-surface p-5">
            <Stat
              label="Projected"
              value={formatCents(projectedSpend + upcomingTotal)}
              tone={
                totalLimit > 0 && projectedSpend + upcomingTotal > totalLimit
                  ? "blush"
                  : "default"
              }
              hint={
                upcomingTotal > 0
                  ? `incl. ${formatCentsCompact(upcomingTotal)} upcoming`
                  : "at current pace"
              }
            />
          </div>
          <div className="bg-surface p-5">
            <Stat
              label="Budgeted"
              value={formatCents(totalLimit)}
              hint="needs + wants + savings"
            />
          </div>
          <div className="bg-surface p-5">
            <Stat
              label="Headroom"
              value={formatCents(Math.max(0, totalLimit - spend))}
              tone={spend > totalLimit ? "blush" : "default"}
              hint={spend > totalLimit ? "over budget" : "left to spend"}
            />
          </div>
        </div>
      </div>

      {/* FRAMEWORK PICKER */}
      <div>
        <SectionHeader
          title="Framework"
          hint="how you decide what to allocate"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {FRAMEWORKS.map((f) => {
            const active = selectedFramework === f.id;
            return (
              <button
                key={f.id}
                onClick={() => onPickFramework(f.id)}
                disabled={pending}
                className={`text-left rounded-2xl border p-5 transition-colors ${
                  active
                    ? "border-blush bg-blush-tint/40"
                    : "border-border bg-surface hover:border-border-strong"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-medium tracking-tight">
                    {f.label}
                  </span>
                  {active && (
                    <span className="ml-auto inline-flex items-center justify-center size-5 rounded-full bg-blush-deep text-surface">
                      <Check className="size-3" strokeWidth={2.5} />
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-foreground-muted leading-relaxed">
                  {f.blurb}
                </p>
              </button>
            );
          })}
        </div>

        {suggested && incomeBasis > 0 && (
          <Card className="mt-4 p-5 md:p-6">
            <div className="flex items-baseline justify-between gap-4 mb-4">
              <div>
                <Label className="mb-1">Suggested allocation</Label>
                <div className="text-[12px] text-foreground-muted">
                  Against {formatCents(incomeBasis)}{" "}
                  {income >= incomeBasis ? "earned" : "expected income"}.
                </div>
              </div>
              <Button
                size="sm"
                variant="primary"
                onClick={onApplySuggested}
                disabled={pending}
              >
                <Sparkles className="size-3.5" strokeWidth={1.75} />
                Apply to limits
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(["need", "want", "savings"] as const).map((cls) => {
                const target = suggested[cls];
                const current = limitByClass(cls);
                const spent = spendByClassification[cls];
                const gap = current - target;
                return (
                  <div
                    key={cls}
                    className="rounded-xl border border-border bg-surface-2/40 p-4"
                  >
                    <Pill tone={classificationTone[cls]}>
                      {classificationLabel[cls]}
                    </Pill>
                    <div className="mono tabular text-lg mt-2 font-medium">
                      {formatCents(target)}
                    </div>
                    <div className="text-[11px] text-foreground-faint mt-1">
                      {current > 0 ? (
                        <>
                          limit {formatCentsCompact(current)}
                          {Math.abs(gap) > 100 && (
                            <span className={gap > 0 ? "text-blush-deep ml-1" : "text-sage-deep ml-1"}>
                              ({gap > 0 ? "−" : "+"}{formatCentsCompact(Math.abs(gap))})
                            </span>
                          )}
                        </>
                      ) : (
                        <span>no limit set</span>
                      )}
                    </div>
                    <div className="text-[11px] text-foreground-faint mono tabular mt-0.5">
                      {formatCentsCompact(spent)} spent so far
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      {/* FORECASTING */}
      <div>
        <SectionHeader
          title="What's left this month"
          hint="remaining limit minus upcoming bills"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(["need", "want", "savings"] as const).map((cls) => {
            const limit = limitByClass(cls);
            const remaining = remainingByClass[cls];
            const upcoming = upcomingByClass[cls];
            const afterBills = remaining - upcoming;
            const spent = spendByClassification[cls];
            const noLimit = limit <= 0;
            return (
              <Card key={cls} className="p-5">
                <Pill tone={classificationTone[cls]}>
                  {classificationLabel[cls]}
                </Pill>
                {noLimit ? (
                  <>
                    <div className="mono tabular text-2xl mt-3 font-medium">
                      {formatCents(spent)}
                    </div>
                    <div className="text-[11px] text-foreground-faint mt-1">
                      spent this month, no limit set
                    </div>
                    {upcoming > 0 && (
                      <div className="mt-3 text-[11px] text-foreground-muted">
                        <div className="flex justify-between mono tabular">
                          <span>Upcoming bills</span>
                          <span>{formatCentsCompact(upcoming)}</span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="mono tabular text-2xl mt-3 font-medium">
                      {formatCents(afterBills)}
                    </div>
                    <div className="text-[11px] text-foreground-faint mt-1">
                      left for the next {daysLeft} {daysLeft === 1 ? "day" : "days"}
                    </div>
                    <div className="mt-3 text-[11px] text-foreground-muted space-y-0.5">
                      <div className="flex justify-between mono tabular">
                        <span>Spent so far</span>
                        <span>{formatCentsCompact(spent)}</span>
                      </div>
                      <div className="flex justify-between mono tabular">
                        <span>Remaining limit</span>
                        <span>{formatCentsCompact(remaining)}</span>
                      </div>
                      {upcoming > 0 && (
                        <div className="flex justify-between mono tabular">
                          <span>Upcoming bills</span>
                          <span>−{formatCentsCompact(upcoming)}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </Card>
            );
          })}
        </div>
        {upcomingList.length > 0 && (
          <Card className="mt-4 divide-y divide-border">
            <div className="px-5 py-3 text-[10px] tracking-[0.25em] uppercase text-foreground-faint flex justify-between">
              <span>Upcoming this month</span>
              <span>{upcomingList.length} {upcomingList.length === 1 ? "bill" : "bills"}</span>
            </div>
            {upcomingList.slice(0, 8).map((u, i) => (
              <div
                key={`${u.merchant}-${u.date}-${i}`}
                className="px-5 py-3 flex items-center gap-4"
              >
                <div className="text-[11px] text-foreground-faint mono tabular w-12 shrink-0">
                  {format(new Date(u.date), "MMM d")}
                </div>
                <div className="text-sm flex-1 min-w-0 truncate">
                  {u.merchant}
                </div>
                <div className="mono tabular text-sm shrink-0">
                  {formatCents(u.amountCents)}
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>

      {/* EDIT ALL LIMITS */}
      <div>
        <SectionHeader
          title="Every limit, one place"
          hint="set a monthly amount on each category"
          right={
            <Button
              size="sm"
              variant="primary"
              onClick={onSave}
              disabled={!dirty || pending}
            >
              {pending ? "Saving…" : dirty ? "Save changes" : "Saved"}
              {!pending && dirty && <ArrowRight className="size-3.5" strokeWidth={1.75} />}
            </Button>
          }
        />
        <div className="space-y-6">
          {classificationOrder.map((cls) => {
            const rows = byClass[cls];
            if (rows.length === 0) return null;
            const totalLimit = rows.reduce(
              (s, r) => s + (draftCents(r.id) ?? 0),
              0,
            );
            const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
            return (
              <div key={cls}>
                <div className="flex items-baseline justify-between mb-2 px-1">
                  <div className="flex items-center gap-2">
                    <Pill tone={classificationTone[cls]}>
                      {classificationLabel[cls]}
                    </Pill>
                    <span className="text-[11px] text-foreground-faint">
                      {rows.length} {rows.length === 1 ? "category" : "categories"}
                    </span>
                  </div>
                  <div className="text-[11px] text-foreground-faint mono tabular">
                    {formatCentsCompact(totalSpent)} / {formatCentsCompact(totalLimit)}
                  </div>
                </div>
                <Card className="divide-y divide-border">
                  {rows.map((r) => {
                    const limit = draftCents(r.id);
                    const spent = r.spent;
                    const overspent = limit != null && spent > limit;
                    const gap = limit != null ? limit - spent : null;
                    return (
                      <div
                        key={r.id}
                        className="px-4 md:px-5 py-3 flex items-center gap-3 md:gap-4"
                      >
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ background: r.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm tracking-tight truncate">
                            {r.name}
                          </div>
                          <div className="mt-1.5 max-w-[280px]">
                            {limit != null && limit > 0 && cls !== "income" ? (
                              <ProgressBar
                                value={spent}
                                max={limit}
                                color={r.color}
                              />
                            ) : (
                              <div className="h-1.5" />
                            )}
                          </div>
                        </div>
                        <div className="hidden md:flex flex-col items-end text-[11px] text-foreground-faint mono tabular w-24 shrink-0">
                          {cls !== "income" && (
                            <span className={overspent ? "text-blush-deep" : ""}>
                              {formatCentsCompact(spent)} spent
                            </span>
                          )}
                          {gap != null && cls !== "income" && (
                            <span>
                              {gap >= 0
                                ? `${formatCentsCompact(gap)} left`
                                : `${formatCentsCompact(Math.abs(gap))} over`}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-foreground-faint text-sm">$</span>
                          <Input
                            value={drafts[r.id] ?? ""}
                            onChange={(e) =>
                              setDrafts((p) => ({ ...p, [r.id]: e.target.value }))
                            }
                            inputMode="decimal"
                            placeholder="—"
                            className="h-9 w-24 md:w-28 text-right mono tabular"
                          />
                        </div>
                      </div>
                    );
                  })}
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
