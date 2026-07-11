"use client";

import { useState, useTransition } from "react";
import { Button, Card, Input, Label, Pill } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { CategoryGlyph } from "@/components/category-glyph";
import { formatCentsCompact } from "@/lib/utils";
import {
  deleteCategoryRule,
  deleteMerchantRule,
  deleteReimbursableRule,
  runAllRules,
  updateCategoryRule,
  updateMerchantRule,
  updateReimbursableRule,
} from "./actions";
import { ArrowRight, Pencil, Play, Trash2 } from "lucide-react";

type MatchType = "merchant_contains" | "merchant_exact" | "regex";

export type CatRuleRow = {
  id: number;
  pattern: string;
  matchType: MatchType;
  categoryId: number;
  priority: number;
  minAmountCents: number | null;
  maxAmountCents: number | null;
  hits: number;
};
export type MerchantRuleRow = {
  id: number;
  pattern: string;
  matchType: MatchType;
  cleanName: string;
  hits: number;
};
export type ReimbRuleRow = {
  id: number;
  pattern: string;
  matchType: MatchType;
  maxAmountCents: number | null;
  hits: number;
};
type CategoryOpt = { id: number; name: string; color: string; icon: string };

const matchTypeLabel: Record<MatchType, string> = {
  merchant_contains: "contains",
  merchant_exact: "is exactly",
  regex: "matches regex",
};

function boundsLabel(min: number | null, max: number | null): string | null {
  if (min != null && max != null)
    return `${formatCentsCompact(min)}–${formatCentsCompact(max)}`;
  if (min != null) return `over ${formatCentsCompact(min)}`;
  if (max != null) return `under ${formatCentsCompact(max)}`;
  return null;
}

function HitCount({ hits, sampleSize }: { hits: number; sampleSize: number }) {
  return (
    <span
      className="mono tabular text-[11px] shrink-0 text-foreground-faint"
      title={`Matches ${hits} of your last ${sampleSize} transactions (after higher-priority rules take theirs)`}
    >
      {hits === 0 ? "no recent matches" : `${hits} recent`}
    </span>
  );
}

export function RulesClient({
  categoryRules,
  merchantRules,
  reimbursableRules,
  categories,
  sampleSize,
}: {
  categoryRules: CatRuleRow[];
  merchantRules: MerchantRuleRow[];
  reimbursableRules: ReimbRuleRow[];
  categories: CategoryOpt[];
  sampleSize: number;
}) {
  const [pending, startTransition] = useTransition();
  const [runResult, setRunResult] = useState<string | null>(null);
  const [editingCat, setEditingCat] = useState<CatRuleRow | null>(null);
  const [editingMerchant, setEditingMerchant] =
    useState<MerchantRuleRow | null>(null);
  const [editingReimb, setEditingReimb] = useState<ReimbRuleRow | null>(null);

  const catById = new Map(categories.map((c) => [c.id, c]));

  const rowShell = (
    key: number,
    body: React.ReactNode,
    hits: React.ReactNode,
    onEdit: () => void,
    onDelete: () => void,
  ) => (
    <div key={key} className="px-4 md:px-5 py-3.5 flex items-center gap-3 md:gap-4 group">
      <div className="flex-1 min-w-0">{body}</div>
      {hits}
      <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="size-8 inline-flex items-center justify-center rounded-md hover:bg-surface-2 text-foreground-faint hover:text-foreground"
          title="Edit"
        >
          <Pencil className="size-3.5" strokeWidth={1.5} />
        </button>
        <button
          onClick={onDelete}
          className="size-8 inline-flex items-center justify-center rounded-md hover:bg-surface-2 text-foreground-faint hover:text-blush-deep"
          title="Delete"
        >
          <Trash2 className="size-3.5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );

  const sectionHeader = (title: string, count: number, hint: string) => (
    <div className="flex items-baseline justify-between mb-4 px-1">
      <div className="flex items-baseline gap-3">
        <h3 className="serif text-xl">{title}</h3>
        <span className="text-[10px] tracking-[0.2em] uppercase text-foreground-faint">
          {count}
        </span>
      </div>
      <span className="text-[11px] text-foreground-faint tracking-tight">
        {hint}
      </span>
    </div>
  );

  return (
    <div className="space-y-10">
      <Card className="p-4 md:p-5 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0 text-sm text-foreground-muted">
          {runResult ??
            "Rules are created from the transaction list (tap a merchant, or edit one). This page is where you audit and prune them."}
        </div>
        <Button
          size="sm"
          variant="primary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await runAllRules();
              setRunResult(
                `Re-ran everything: ${r.categorized} categorized, ${r.renamed} renamed, ${r.reimbursable} flagged reimbursable.`,
              );
            })
          }
        >
          <Play className="size-3.5" strokeWidth={2} />
          {pending ? "Running…" : "Run all rules"}
        </Button>
      </Card>

      <div>
        {sectionHeader(
          "Category rules",
          categoryRules.length,
          "first match wins, higher priority first",
        )}
        {categoryRules.length === 0 ? (
          <Card className="p-6 text-sm text-foreground-faint">
            None yet — categorize a transaction and leave “always categorize
            this way” checked.
          </Card>
        ) : (
          <Card className="divide-y divide-border">
            {categoryRules.map((r) => {
              const cat = catById.get(r.categoryId);
              const bounds = boundsLabel(r.minAmountCents, r.maxAmountCents);
              return rowShell(
                r.id,
                <div className="flex items-center gap-3 min-w-0">
                  <CategoryGlyph
                    icon={cat?.icon}
                    color={cat?.color ?? "var(--foreground-faint)"}
                    size={30}
                  />
                  <div className="min-w-0">
                    <div className="text-sm tracking-tight truncate">
                      <span className="text-foreground-faint">
                        {matchTypeLabel[r.matchType]}{" "}
                      </span>
                      <span className="mono">{r.pattern}</span>
                      {bounds && (
                        <span className="text-foreground-faint"> · {bounds}</span>
                      )}
                    </div>
                    <div className="text-[11px] text-foreground-faint mt-0.5 flex items-center gap-1">
                      <ArrowRight className="size-3" strokeWidth={1.5} />
                      {cat?.name ?? "deleted category"}
                      {r.priority > 0 && (
                        <Pill className="ml-1.5">p{r.priority}</Pill>
                      )}
                    </div>
                  </div>
                </div>,
                <HitCount hits={r.hits} sampleSize={sampleSize} />,
                () => setEditingCat(r),
                () => {
                  if (confirm(`Delete this rule? Transactions it already categorized keep their category.`))
                    startTransition(() => deleteCategoryRule(r.id));
                },
              );
            })}
          </Card>
        )}
      </div>

      <div>
        {sectionHeader(
          "Merchant renames",
          merchantRules.length,
          "cleans up raw bank descriptors",
        )}
        {merchantRules.length === 0 ? (
          <Card className="p-6 text-sm text-foreground-faint">
            None yet — edit a transaction&apos;s merchant and leave “apply this
            name to similar transactions” checked.
          </Card>
        ) : (
          <Card className="divide-y divide-border">
            {merchantRules.map((r) =>
              rowShell(
                r.id,
                <div className="min-w-0">
                  <div className="text-sm tracking-tight truncate">
                    <span className="text-foreground-faint">
                      {matchTypeLabel[r.matchType]}{" "}
                    </span>
                    <span className="mono">{r.pattern}</span>
                  </div>
                  <div className="text-[11px] text-foreground-faint mt-0.5 flex items-center gap-1">
                    <ArrowRight className="size-3" strokeWidth={1.5} />
                    shows as “{r.cleanName}”
                  </div>
                </div>,
                <HitCount hits={r.hits} sampleSize={sampleSize} />,
                () => setEditingMerchant(r),
                () => {
                  if (confirm("Delete this rename? Existing cleaned names stay until rules re-run."))
                    startTransition(() => deleteMerchantRule(r.id));
                },
              ),
            )}
          </Card>
        )}
      </div>

      <div>
        {sectionHeader(
          "Reimbursable",
          reimbursableRules.length,
          "kept out of spending and income",
        )}
        {reimbursableRules.length === 0 ? (
          <Card className="p-6 text-sm text-foreground-faint">
            None yet — mark a transaction reimbursable to start one.
          </Card>
        ) : (
          <Card className="divide-y divide-border">
            {reimbursableRules.map((r) =>
              rowShell(
                r.id,
                <div className="min-w-0">
                  <div className="text-sm tracking-tight truncate">
                    <span className="text-foreground-faint">
                      {matchTypeLabel[r.matchType]}{" "}
                    </span>
                    <span className="mono">{r.pattern}</span>
                    {r.maxAmountCents != null && (
                      <span className="text-foreground-faint">
                        {" "}
                        · under {formatCentsCompact(r.maxAmountCents)}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-foreground-faint mt-0.5">
                    outflows auto-flagged reimbursable
                  </div>
                </div>,
                <HitCount hits={r.hits} sampleSize={sampleSize} />,
                () => setEditingReimb(r),
                () => {
                  if (confirm("Delete this rule? Already-flagged transactions stay reimbursable."))
                    startTransition(() => deleteReimbursableRule(r.id));
                },
              ),
            )}
          </Card>
        )}
      </div>

      {editingCat && (
        <RuleSheet
          title="Category rule"
          onClose={() => setEditingCat(null)}
          action={updateCategoryRule}
          rule={editingCat}
        >
          <div>
            <Label htmlFor="categoryId">Category</Label>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={editingCat.categoryId}
              className="h-11 w-full bg-surface border border-border rounded-xl px-3 text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="minAmount">Min $ (opt.)</Label>
              <Input
                id="minAmount"
                name="minAmount"
                inputMode="decimal"
                defaultValue={
                  editingCat.minAmountCents != null
                    ? (editingCat.minAmountCents / 100).toFixed(2)
                    : ""
                }
              />
            </div>
            <div>
              <Label htmlFor="maxAmount">Max $ (opt.)</Label>
              <Input
                id="maxAmount"
                name="maxAmount"
                inputMode="decimal"
                defaultValue={
                  editingCat.maxAmountCents != null
                    ? (editingCat.maxAmountCents / 100).toFixed(2)
                    : ""
                }
              />
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                name="priority"
                inputMode="numeric"
                defaultValue={String(editingCat.priority)}
              />
            </div>
          </div>
        </RuleSheet>
      )}
      {editingMerchant && (
        <RuleSheet
          title="Merchant rename"
          onClose={() => setEditingMerchant(null)}
          action={updateMerchantRule}
          rule={editingMerchant}
        >
          <div>
            <Label htmlFor="cleanName">Shows as</Label>
            <Input
              id="cleanName"
              name="cleanName"
              defaultValue={editingMerchant.cleanName}
              required
            />
          </div>
        </RuleSheet>
      )}
      {editingReimb && (
        <RuleSheet
          title="Reimbursable rule"
          onClose={() => setEditingReimb(null)}
          action={updateReimbursableRule}
          rule={editingReimb}
        >
          <div>
            <Label htmlFor="maxAmount">Only under $ (optional)</Label>
            <Input
              id="maxAmount"
              name="maxAmount"
              inputMode="decimal"
              defaultValue={
                editingReimb.maxAmountCents != null
                  ? (editingReimb.maxAmountCents / 100).toFixed(2)
                  : ""
              }
            />
          </div>
        </RuleSheet>
      )}
    </div>
  );
}

// Shared edit sheet: pattern + match type, with rule-kind-specific fields
// slotted in. Submits the given server action with the rule id.
function RuleSheet({
  title,
  rule,
  action,
  onClose,
  children,
}: {
  title: string;
  rule: { id: number; pattern: string; matchType: MatchType };
  action: (form: FormData) => Promise<void>;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet open onClose={onClose}>
      <Label>{title}</Label>
      <h3 className="serif text-xl mt-1 mb-5 mono truncate">{rule.pattern}</h3>
      <form
        action={(fd) => {
          fd.set("id", String(rule.id));
          startTransition(async () => {
            try {
              await action(fd);
              onClose();
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          });
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div>
            <Label htmlFor="pattern">Pattern</Label>
            <Input
              id="pattern"
              name="pattern"
              defaultValue={rule.pattern}
              className="mono"
              required
            />
          </div>
          <div>
            <Label htmlFor="matchType">Match</Label>
            <select
              id="matchType"
              name="matchType"
              defaultValue={rule.matchType}
              className="h-11 bg-surface border border-border rounded-xl px-3 text-sm"
            >
              <option value="merchant_contains">contains</option>
              <option value="merchant_exact">is exactly</option>
              <option value="regex">regex</option>
            </select>
          </div>
        </div>
        {children}
        {error && <div className="text-xs text-blush-deep">{error}</div>}
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
