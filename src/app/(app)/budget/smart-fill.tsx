"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Card,
  Input,
  Button,
  Pill,
  SectionHeader,
} from "@/components/ui";
import { formatCents, formatCentsCompact, parseDollarsToCents, cn } from "@/lib/utils";
import { Sparkles, ArrowRight, RotateCcw } from "lucide-react";
import type { BudgetFramework, Classification } from "@/db/schema";
import { bulkSetMonthlyLimits } from "./actions";

export type SmartFillRow = {
  id: number;
  name: string;
  color: string;
  classification: Classification;
  currentLimitCents: number | null;
  avgCents: number;
  scaledCents: number;
};

type SpendClass = Exclude<Classification, "income">;
const order: SpendClass[] = ["need", "want", "savings"];
const classLabel: Record<SpendClass, string> = {
  need: "Needs",
  want: "Wants",
  savings: "Savings",
};
const classTone: Record<SpendClass, "need" | "want" | "savings"> = {
  need: "need",
  want: "want",
  savings: "savings",
};
const frameworkLabel: Record<BudgetFramework, string> = {
  "50_30_20": "50 / 30 / 20",
  zero_based: "zero-based",
  custom: "custom",
};

const centsToDraft = (cents: number | null) =>
  cents != null && cents > 0 ? (cents / 100).toFixed(0) : "";

export function SmartFillLimits({
  rows,
  framework,
  incomeBasis,
  basisMonths,
}: {
  rows: SmartFillRow[];
  framework: BudgetFramework;
  incomeBasis: number;
  basisMonths: number;
}) {
  const canScale = framework !== "custom" && incomeBasis > 0;
  const [scale, setScale] = useState(canScale);
  const [pending, startTransition] = useTransition();

  const initialDrafts = useMemo(() => {
    const m: Record<number, string> = {};
    for (const r of rows) m[r.id] = centsToDraft(r.currentLimitCents);
    return m;
  }, [rows]);
  const [drafts, setDrafts] = useState<Record<number, string>>(initialDrafts);

  const suggestionFor = (r: SmartFillRow) =>
    scale && canScale ? r.scaledCents : r.avgCents;

  const draftCents = (id: number): number | null => {
    const v = drafts[id];
    if (v == null || v.trim() === "") return null;
    return parseDollarsToCents(v);
  };

  const origById = useMemo(() => {
    const m = new Map<number, number | null>();
    for (const r of rows) m.set(r.id, r.currentLimitCents ?? null);
    return m;
  }, [rows]);

  const dirty = useMemo(
    () => rows.some((r) => (origById.get(r.id) ?? null) !== draftCents(r.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drafts, rows],
  );

  const applySuggestions = () => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        const s = suggestionFor(r);
        if (s > 0) next[r.id] = (s / 100).toFixed(0);
      }
      return next;
    });
  };

  const resetToCurrent = () => setDrafts(initialDrafts);

  const onSave = () => {
    const updates = rows
      .map((r) => ({ id: r.id, limitCents: draftCents(r.id) }))
      .filter((u) => (origById.get(u.id) ?? null) !== u.limitCents);
    if (updates.length === 0) return;
    startTransition(async () => {
      await bulkSetMonthlyLimits(updates);
    });
  };

  const byClass = useMemo(() => {
    const m: Record<SpendClass, SmartFillRow[]> = { need: [], want: [], savings: [] };
    for (const r of rows) m[r.classification as SpendClass]?.push(r);
    return m;
  }, [rows]);

  // Draft total to show how the plan stacks up against income.
  const draftTotal = rows.reduce((s, r) => s + (draftCents(r.id) ?? 0), 0);

  const hasHistory = rows.some((r) => r.avgCents > 0);

  return (
    <div>
      <SectionHeader
        title="Smart-fill limits"
        hint={
          hasHistory
            ? `suggested from your last ${basisMonths} ${basisMonths === 1 ? "month" : "months"} of spending`
            : "no spending history yet to suggest from"
        }
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

      <Card className="p-5 md:p-6 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm tracking-tight">
              Pre-fill every limit from your typical spend, then tweak before saving.
            </div>
            <div className="text-[12px] text-foreground-muted mt-1">
              {canScale ? (
                <>
                  {scale ? (
                    <>
                      Scaled so class totals fit your{" "}
                      <span className="text-foreground">{frameworkLabel[framework]}</span>{" "}
                      framework against {formatCentsCompact(incomeBasis)} income.
                    </>
                  ) : (
                    <>Using your raw monthly averages (not scaled to a framework).</>
                  )}
                </>
              ) : (
                <>Based on your raw monthly averages per category.</>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canScale && (
              <button
                onClick={() => setScale((s) => !s)}
                className={cn(
                  "text-[12px] rounded-full border px-3 py-1.5 transition-colors tracking-tight",
                  scale
                    ? "border-blush bg-blush-tint/40 text-foreground"
                    : "border-border bg-surface text-foreground-muted hover:border-border-strong",
                )}
              >
                Scale to {frameworkLabel[framework]}
              </button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={resetToCurrent}
              disabled={pending}
            >
              <RotateCcw className="size-3.5" strokeWidth={1.75} />
              Reset
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={applySuggestions}
              disabled={pending || !hasHistory}
            >
              <Sparkles className="size-3.5" strokeWidth={1.75} />
              Smart-fill
            </Button>
          </div>
        </div>
      </Card>

      <div className="space-y-6">
        {order.map((cls) => {
          const clsRows = byClass[cls];
          if (clsRows.length === 0) return null;
          const draftClassTotal = clsRows.reduce(
            (s, r) => s + (draftCents(r.id) ?? 0),
            0,
          );
          return (
            <div key={cls}>
              <div className="flex items-baseline justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <Pill tone={classTone[cls]}>{classLabel[cls]}</Pill>
                  <span className="text-[11px] text-foreground-faint">
                    {clsRows.length}{" "}
                    {clsRows.length === 1 ? "category" : "categories"}
                  </span>
                </div>
                <div className="text-[11px] text-foreground-faint mono tabular">
                  {formatCentsCompact(draftClassTotal)} planned
                </div>
              </div>
              <Card className="divide-y divide-border">
                {clsRows.map((r) => {
                  const suggestion = suggestionFor(r);
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
                        <div className="text-[11px] text-foreground-faint mt-0.5 mono tabular">
                          {r.avgCents > 0
                            ? `${formatCentsCompact(r.avgCents)}/mo avg`
                            : "no recent spend"}
                          {suggestion > 0 && (
                            <>
                              {" · "}
                              <button
                                onClick={() =>
                                  setDrafts((p) => ({
                                    ...p,
                                    [r.id]: (suggestion / 100).toFixed(0),
                                  }))
                                }
                                className="text-blush-deep hover:underline"
                              >
                                use {formatCentsCompact(suggestion)}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="hidden sm:block text-[11px] text-foreground-faint mono tabular w-24 text-right shrink-0">
                        {r.currentLimitCents != null
                          ? `now ${formatCents(r.currentLimitCents)}`
                          : "no limit"}
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

      {incomeBasis > 0 && (
        <div className="flex items-center justify-between mt-4 px-1 text-[12px] text-foreground-muted">
          <span>Total planned across all categories</span>
          <span
            className={cn(
              "mono tabular",
              draftTotal > incomeBasis && "text-blush-deep",
            )}
          >
            {formatCents(draftTotal)} / {formatCentsCompact(incomeBasis)} income
          </span>
        </div>
      )}
    </div>
  );
}
