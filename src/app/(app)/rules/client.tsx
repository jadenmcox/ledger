"use client";

import { confirmDialog } from "@/components/confirm";
import { useMemo, useState, useTransition } from "react";
import { Button, Card, Input, Label } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { CategoryGlyph } from "@/components/category-glyph";
import { formatCentsCompact, cn } from "@/lib/utils";
import {
  createRule,
  deleteCategoryRule,
  deleteMerchantRule,
  deleteReimbursableRule,
  runAllRules,
  updateCategoryRule,
  updateMerchantRule,
  updateReimbursableRule,
  type NewRuleInput,
} from "./actions";
import { ChevronRight, Play, Plus, Search, Trash2 } from "lucide-react";

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
type Sample = { raw: string; name: string; amountCents: number };
type Tab = "category" | "rename" | "work";

const matchWord: Record<MatchType, string> = {
  merchant_contains: "contains",
  merchant_exact: "is exactly",
  regex: "matches",
};

function boundsLabel(min: number | null, max: number | null): string | null {
  if (min != null && max != null) return `${formatCentsCompact(min)} to ${formatCentsCompact(max)}`;
  if (min != null) return `over ${formatCentsCompact(min)}`;
  if (max != null) return `under ${formatCentsCompact(max)}`;
  return null;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

function matchesPattern(pattern: string, matchType: MatchType, raw: string): boolean {
  const p = norm(pattern);
  if (!p) return false;
  if (matchType === "merchant_exact") return norm(raw) === p;
  if (matchType === "regex") {
    try {
      return new RegExp(pattern, "i").test(raw);
    } catch {
      return false;
    }
  }
  return norm(raw).includes(p);
}

export function RulesClient({
  categoryRules,
  merchantRules,
  reimbursableRules,
  categories,
  sampleSize,
  samples,
}: {
  categoryRules: CatRuleRow[];
  merchantRules: MerchantRuleRow[];
  reimbursableRules: ReimbRuleRow[];
  categories: CategoryOpt[];
  sampleSize: number;
  samples: Sample[];
}) {
  const [tab, setTab] = useState<Tab>("category");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingCat, setEditingCat] = useState<CatRuleRow | null>(null);
  const [editingMerchant, setEditingMerchant] = useState<MerchantRuleRow | null>(null);
  const [editingReimb, setEditingReimb] = useState<ReimbRuleRow | null>(null);
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const q = norm(query);

  // Category rules, grouped under the category they file into.
  const groups = useMemo(() => {
    const byCat = new Map<number, CatRuleRow[]>();
    for (const r of categoryRules) {
      const name = catById.get(r.categoryId)?.name ?? "";
      if (q && !r.pattern.includes(q) && !norm(name).includes(q)) continue;
      const arr = byCat.get(r.categoryId) ?? [];
      arr.push(r);
      byCat.set(r.categoryId, arr);
    }
    return [...byCat.entries()]
      .map(([id, rules]) => ({ cat: catById.get(id), id, rules }))
      .sort((a, b) => (a.cat?.name ?? "").localeCompare(b.cat?.name ?? ""));
  }, [categoryRules, catById, q]);

  const renames = merchantRules.filter(
    (r) => !q || r.pattern.includes(q) || norm(r.cleanName).includes(q),
  );
  const work = reimbursableRules.filter((r) => !q || r.pattern.includes(q));

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "category", label: "Categories", count: categoryRules.length },
    { id: "rename", label: "Names", count: merchantRules.length },
    { id: "work", label: "Work expenses", count: reimbursableRules.length },
  ];

  const hits = (n: number) => (
    <span
      className="shrink-0 text-[11px] text-foreground-faint"
      title={`Caught ${n} of your last ${sampleSize} transactions`}
    >
      {n === 0 ? "unused lately" : `${n} recent`}
    </span>
  );

  return (
    <div className="space-y-5">
      {/* Toolbar: search + new, then the three kinds of rule. */}
      <div className="sticky top-[60px] z-10 -mx-1 space-y-3 bg-background/85 px-1 pb-2 pt-1 backdrop-blur-xl md:top-0">
        <div className="flex items-center gap-2">
          <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-surface px-4">
            <Search className="size-4 shrink-0 text-foreground-faint" strokeWidth={1.75} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search rules"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-foreground-faint"
            />
          </div>
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="size-4" strokeWidth={2} />
            <span className="hidden sm:inline">New rule</span>
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-full bg-surface-2 p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "truncate rounded-full px-2 py-2 text-[13px] tracking-tight transition-colors",
                tab === t.id ? "bg-surface font-medium shadow-sm" : "text-foreground-muted",
              )}
            >
              {t.id === "work" ? (
                <>
                  Work<span className="hidden sm:inline"> expenses</span>
                </>
              ) : (
                t.label
              )}{" "}
              <span className="text-foreground-faint">{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      {flash && <div className="rounded-xl bg-surface px-4 py-3 text-sm text-foreground-muted">{flash}</div>}

      {tab === "category" && (
        <>
          <p className="px-1 text-[12px] text-foreground-faint">
            When a merchant name contains the text, it goes in that category. If two rules match, the one
            marked <span className="text-foreground-muted">checked first</span> wins.
          </p>
          {groups.length === 0 ? (
            <Empty text={q ? "No rules match that search." : "No category rules yet. Tap New rule, or categorize a transaction and keep “always categorize this way” checked."} />
          ) : (
            groups.map(({ cat, id, rules }) => (
              <section key={id}>
                <div className="mb-2 flex items-center gap-2.5 px-1">
                  <CategoryGlyph icon={cat?.icon} color={cat?.color ?? "var(--foreground-faint)"} size={24} />
                  <span className="text-sm font-medium tracking-tight">{cat?.name ?? "Deleted category"}</span>
                  <span className="text-[11px] text-foreground-faint">{rules.length}</span>
                </div>
                <Card className="divide-y divide-border overflow-hidden">
                  {rules.map((r) => {
                    const bounds = boundsLabel(r.minAmountCents, r.maxAmountCents);
                    return (
                      <RuleRow key={r.id} onClick={() => setEditingCat(r)} right={hits(r.hits)}>
                        <span className="text-foreground-faint">{matchWord[r.matchType]} </span>
                        <span className="font-medium">{r.pattern}</span>
                        {bounds && <Chip>{bounds}</Chip>}
                        {r.priority > 0 && <Chip>checked first</Chip>}
                      </RuleRow>
                    );
                  })}
                </Card>
              </section>
            ))
          )}
        </>
      )}

      {tab === "rename" && (
        <>
          <p className="px-1 text-[12px] text-foreground-faint">
            Turns messy bank text like “SQ *BLUE BOTTLE 0042” into a clean name.
          </p>
          {renames.length === 0 ? (
            <Empty text={q ? "No renames match that search." : "No renames yet. Tap New rule, or edit a transaction's name and keep “apply to similar” checked."} />
          ) : (
            <Card className="divide-y divide-border overflow-hidden">
              {renames.map((r) => (
                <RuleRow key={r.id} onClick={() => setEditingMerchant(r)} right={hits(r.hits)}>
                  <span className="text-foreground-faint">{matchWord[r.matchType]} </span>
                  <span className="font-medium">{r.pattern}</span>
                  <span className="text-foreground-faint"> shows as </span>
                  <span className="font-medium">{r.cleanName}</span>
                </RuleRow>
              ))}
            </Card>
          )}
        </>
      )}

      {tab === "work" && (
        <>
          <p className="px-1 text-[12px] text-foreground-faint">
            Charges that match are marked as work expenses: they don&apos;t count as spending, and they show
            on Paybacks until the money comes back.
          </p>
          {work.length === 0 ? (
            <Empty text={q ? "No rules match that search." : "No work expense rules yet. Tap New rule to add one, like Sweetgreen under $30."} />
          ) : (
            <Card className="divide-y divide-border overflow-hidden">
              {work.map((r) => (
                <RuleRow key={r.id} onClick={() => setEditingReimb(r)} right={hits(r.hits)}>
                  <span className="text-foreground-faint">{matchWord[r.matchType]} </span>
                  <span className="font-medium">{r.pattern}</span>
                  {r.maxAmountCents != null && <Chip>under {formatCentsCompact(r.maxAmountCents)}</Chip>}
                </RuleRow>
              ))}
            </Card>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-dashed border-border px-4 py-3.5">
        <span className="text-[12px] text-foreground-muted">
          Changed a few rules? Re-run them over every past transaction.
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await runAllRules();
              setFlash(
                `Done: ${r.categorized} recategorized, ${r.renamed} renamed, ${r.reimbursable} marked as work expenses.`,
              );
            })
          }
        >
          <Play className="size-3.5" strokeWidth={2} />
          {pending ? "Running…" : "Re-run all rules"}
        </Button>
      </div>

      {creating && (
        <NewRuleSheet
          initialKind={tab}
          categories={categories}
          samples={samples}
          onClose={() => setCreating(false)}
          onDone={(msg) => setFlash(msg)}
        />
      )}

      {editingCat && (
        <RuleSheet
          title="Category rule"
          onClose={() => setEditingCat(null)}
          action={updateCategoryRule}
          onDelete={() => deleteCategoryRule(editingCat.id)}
          rule={editingCat}
        >
          <div>
            <Label htmlFor="categoryId">Goes in</Label>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={editingCat.categoryId}
              className="h-11 w-full rounded-field border border-border bg-surface px-3 text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="minAmount">Only over $</Label>
              <Input
                id="minAmount"
                name="minAmount"
                inputMode="decimal"
                placeholder="any"
                defaultValue={editingCat.minAmountCents != null ? (editingCat.minAmountCents / 100).toFixed(2) : ""}
              />
            </div>
            <div>
              <Label htmlFor="maxAmount">Only under $</Label>
              <Input
                id="maxAmount"
                name="maxAmount"
                inputMode="decimal"
                placeholder="any"
                defaultValue={editingCat.maxAmountCents != null ? (editingCat.maxAmountCents / 100).toFixed(2) : ""}
              />
            </div>
          </div>
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              name="priority"
              value="2"
              defaultChecked={editingCat.priority > 0}
              className="size-4 accent-blush-deep"
            />
            Check this rule before the others
          </label>
        </RuleSheet>
      )}
      {editingMerchant && (
        <RuleSheet
          title="Rename rule"
          onClose={() => setEditingMerchant(null)}
          action={updateMerchantRule}
          onDelete={() => deleteMerchantRule(editingMerchant.id)}
          rule={editingMerchant}
        >
          <div>
            <Label htmlFor="cleanName">Shows as</Label>
            <Input id="cleanName" name="cleanName" defaultValue={editingMerchant.cleanName} required />
          </div>
        </RuleSheet>
      )}
      {editingReimb && (
        <RuleSheet
          title="Work expense rule"
          onClose={() => setEditingReimb(null)}
          action={updateReimbursableRule}
          onDelete={() => deleteReimbursableRule(editingReimb.id)}
          rule={editingReimb}
        >
          <div>
            <Label htmlFor="maxAmount">Only under $ (optional)</Label>
            <Input
              id="maxAmount"
              name="maxAmount"
              inputMode="decimal"
              placeholder="any amount"
              defaultValue={editingReimb.maxAmountCents != null ? (editingReimb.maxAmountCents / 100).toFixed(2) : ""}
            />
          </div>
        </RuleSheet>
      )}
    </div>
  );
}

function RuleRow({
  onClick,
  right,
  children,
}: {
  onClick: () => void;
  right: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2/50 md:px-5"
    >
      <span className="min-w-0 flex-1 text-sm leading-relaxed tracking-tight">{children}</span>
      {right}
      <ChevronRight className="size-4 shrink-0 text-foreground-faint" strokeWidth={2} />
    </button>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1.5 inline-flex rounded-full bg-surface-2 px-2 py-0.5 align-middle text-[11px] text-foreground-muted">
      {children}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return <Card className="p-6 text-sm text-foreground-faint">{text}</Card>;
}

function NewRuleSheet({
  initialKind,
  categories,
  samples,
  onClose,
  onDone,
}: {
  initialKind: Tab;
  categories: CategoryOpt[];
  samples: Sample[];
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [kind, setKind] = useState<Tab>(initialKind);
  const [pattern, setPattern] = useState("");
  const [categoryId, setCategoryId] = useState<number>(0);
  const [cleanName, setCleanName] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [applyToPast, setApplyToPast] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Live preview: which recent merchants this text would catch.
  const preview = useMemo(() => {
    if (pattern.trim().length < 2) return null;
    const names = new Map<string, number>();
    let count = 0;
    for (const s of samples) {
      if (!matchesPattern(pattern, "merchant_contains", s.raw)) continue;
      count++;
      names.set(s.name, (names.get(s.name) ?? 0) + 1);
    }
    return { count, names: [...names.keys()].slice(0, 4) };
  }, [pattern, samples]);

  const submit = () => {
    setError(null);
    const input: NewRuleInput =
      kind === "category"
        ? { kind, pattern, categoryId, minAmount, maxAmount, applyToPast }
        : kind === "rename"
          ? { kind, pattern, cleanName, applyToPast }
          : { kind, pattern, maxAmount, applyToPast };
    startTransition(async () => {
      const r = await createRule(input);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onDone(
        applyToPast
          ? `Rule saved. ${r.changed} past ${r.changed === 1 ? "transaction" : "transactions"} updated.`
          : "Rule saved. It'll apply to new transactions.",
      );
      onClose();
    });
  };

  const kinds: { id: Tab; label: string }[] = [
    { id: "category", label: "Category" },
    { id: "rename", label: "Rename" },
    { id: "work", label: "Work expense" },
  ];

  return (
    <Sheet open onClose={onClose}>
      <Label>New rule</Label>
      <div className="mt-2 grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1">
        {kinds.map((k) => (
          <button
            key={k.id}
            onClick={() => setKind(k.id)}
            className={cn(
              "rounded-xl py-2 text-[13px] tracking-tight transition-colors",
              kind === k.id ? "bg-surface font-medium shadow-sm" : "text-foreground-muted",
            )}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <Label htmlFor="pattern">When the merchant name contains</Label>
          <Input
            id="pattern"
            autoFocus
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="sweetgreen"
          />
          {preview && (
            <p className="mt-1.5 text-[12px] text-foreground-muted">
              {preview.count === 0
                ? "Doesn't match anything recent. Check the spelling against the bank's text."
                : `Matches ${preview.count} recent: ${preview.names.join(", ")}`}
            </p>
          )}
        </div>

        {kind === "category" && (
          <>
            <div>
              <Label htmlFor="newCat">Put it in</Label>
              <select
                id="newCat"
                value={categoryId}
                onChange={(e) => setCategoryId(Number(e.target.value))}
                className="h-11 w-full rounded-field border border-border bg-surface px-3 text-sm"
              >
                <option value={0}>Pick a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="newMin">Only over $</Label>
                <Input id="newMin" inputMode="decimal" placeholder="any" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="newMax">Only under $</Label>
                <Input id="newMax" inputMode="decimal" placeholder="any" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
              </div>
            </div>
          </>
        )}

        {kind === "rename" && (
          <div>
            <Label htmlFor="newName">Show it as</Label>
            <Input id="newName" value={cleanName} onChange={(e) => setCleanName(e.target.value)} placeholder="Sweetgreen" />
          </div>
        )}

        {kind === "work" && (
          <div>
            <Label htmlFor="newWorkMax">Only under $ (optional)</Label>
            <Input id="newWorkMax" inputMode="decimal" placeholder="any amount" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
            <p className="mt-1.5 text-[12px] text-foreground-faint">
              Keeps a big personal order from the same place from being marked as work.
            </p>
          </div>
        )}

        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={applyToPast}
            onChange={(e) => setApplyToPast(e.target.checked)}
            className="size-4 accent-blush-deep"
          />
          Also apply to past transactions
        </label>
      </div>

      {error && <p className="mt-3 text-xs text-blush-deep">{error}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={submit} disabled={pending || !pattern.trim()}>
          {pending ? "Saving…" : "Save rule"}
        </Button>
      </div>
    </Sheet>
  );
}

// Edit sheet shared by all three kinds: the text to match plus kind-specific
// fields, with delete tucked inside instead of a hover-only trash icon.
function RuleSheet({
  title,
  rule,
  action,
  onDelete,
  onClose,
  children,
}: {
  title: string;
  rule: { id: number; pattern: string; matchType: MatchType };
  action: (form: FormData) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet open onClose={onClose}>
      <Label>{title}</Label>
      <h3 className="display mb-5 mt-1 truncate text-xl">{rule.pattern}</h3>
      <form
        action={(fd) => {
          fd.set("id", String(rule.id));
          if (!fd.has("priority")) fd.set("priority", "0");
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
        <div className="grid grid-cols-[auto_1fr] gap-3">
          <div>
            <Label htmlFor="matchType">Merchant</Label>
            <select
              id="matchType"
              name="matchType"
              defaultValue={rule.matchType}
              className="h-11 rounded-field border border-border bg-surface px-3 text-sm"
            >
              <option value="merchant_contains">contains</option>
              <option value="merchant_exact">is exactly</option>
              <option value="regex">matches pattern</option>
            </select>
          </div>
          <div>
            <Label htmlFor="pattern">Text</Label>
            <Input id="pattern" name="pattern" defaultValue={rule.pattern} required />
          </div>
        </div>
        {children}
        {error && <div className="text-xs text-blush-deep">{error}</div>}
        <div className="flex items-center justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={async () => {
              const ok = await confirmDialog({
                title: "Delete this rule?",
                body: "Transactions it already handled stay as they are.",
                confirmLabel: "Delete rule",
                danger: true,
              });
              if (ok)
                startTransition(async () => {
                  await onDelete();
                  onClose();
                });
            }}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs text-blush-deep hover:bg-blush-tint/60"
          >
            <Trash2 className="size-3.5" strokeWidth={1.75} /> Delete
          </button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </form>
    </Sheet>
  );
}
