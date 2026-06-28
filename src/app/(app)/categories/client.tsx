"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Card, Label, Input, Button, Pill, ProgressBar } from "@/components/ui";
import { CategoryGlyph } from "@/components/category-glyph";
import { formatCents } from "@/lib/utils";
import { format } from "date-fns";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "./actions";
import type { Category } from "@/db/schema";
import { classifications } from "@/db/schema";
import {
  Plus,
  Trash2,
  Pencil,
  ChevronRight,
} from "lucide-react";

export type CategoryTx = {
  id: number;
  date: string;
  merchant: string;
  amountCents: number;
};

const classificationLabel: Record<string, string> = {
  income: "Income",
  need: "Needs",
  want: "Wants",
  savings: "Savings",
};

const classificationOrder = ["income", "need", "want", "savings"] as const;

export function NewCategoryButton() {
  return (
    <Button
      variant="primary"
      onClick={() =>
        window.dispatchEvent(new Event("budgetly:new-category"))
      }
    >
      <Plus className="size-4" strokeWidth={1.5} /> New category
    </Button>
  );
}

export function CategoriesClient({
  initial,
  spendByCategory = {},
  txByCategory = {},
}: {
  initial: Category[];
  spendByCategory?: Record<number, number>;
  txByCategory?: Record<number, CategoryTx[]>;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (adding || editing) {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [adding, editing]);

  useEffect(() => {
    const handler = () => setAdding(true);
    window.addEventListener("budgetly:new-category", handler);
    return () => window.removeEventListener("budgetly:new-category", handler);
  }, []);

  const grouped = classificationOrder.map((c) => ({
    classification: c,
    items: initial.filter((cat) => cat.classification === c && !cat.isArchived),
  }));

  return (
    <div className="space-y-12">
      {(adding || editing) && (
        <div ref={formRef}>
          <CategoryForm
            initial={editing}
            onClose={() => {
              setAdding(false);
              setEditing(null);
            }}
          />
        </div>
      )}

      {grouped.map(({ classification, items }) => {
        if (items.length === 0) return null;
        const totalLimit = items.reduce(
          (s, c) => s + (c.monthlyLimitCents ?? 0),
          0,
        );
        return (
          <div key={classification}>
            <div className="flex items-baseline justify-between mb-4 px-1">
              <div className="flex items-baseline gap-3">
                <h3 className="serif text-xl">
                  {classificationLabel[classification]}
                </h3>
                <span className="text-[10px] tracking-[0.2em] uppercase text-foreground-faint">
                  {items.length}
                </span>
              </div>
              {totalLimit > 0 && (
                <div className="text-xs text-foreground-muted tracking-tight">
                  monthly total:{" "}
                  <span className="mono tabular">
                    {formatCents(totalLimit)}
                  </span>
                </div>
              )}
            </div>
            <Card className="divide-y divide-border">
              {items.map((cat) => (
                <CategoryRow
                  key={cat.id}
                  cat={cat}
                  spent={spendByCategory[cat.id] ?? 0}
                  txs={txByCategory[cat.id] ?? []}
                  isExpanded={expanded === cat.id}
                  onToggle={() =>
                    setExpanded((prev) => (prev === cat.id ? null : cat.id))
                  }
                  onEdit={() => setEditing(cat)}
                />
              ))}
            </Card>
          </div>
        );
      })}
    </div>
  );
}

function CategoryRow({
  cat,
  spent,
  txs,
  isExpanded,
  onToggle,
  onEdit,
}: {
  cat: Category;
  spent: number;
  txs: CategoryTx[];
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="group">
    <div
      onClick={onToggle}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-surface-2/40 transition-colors"
    >
      <span
        aria-hidden
        className="size-5 inline-flex items-center justify-center text-foreground-faint shrink-0"
      >
        <ChevronRight
          className={`size-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
          strokeWidth={2}
        />
      </span>
      <CategoryGlyph icon={cat.icon} color={cat.color} size={34} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1.5">
          <span className="tracking-tight text-left">{cat.name}</span>
          {cat.isSystem && <Pill>system</Pill>}
        </div>
        {cat.classification !== "income" && (
          <div className="flex items-center gap-3">
            <div className="flex-1 max-w-xs">
              {cat.monthlyLimitCents ? (
                <ProgressBar
                  value={spent}
                  max={cat.monthlyLimitCents}
                  color={cat.color}
                  height={5}
                />
              ) : (
                <div className="h-[5px] rounded-full bg-surface-2 overflow-hidden">
                  {spent > 0 && (
                    <div
                      className="h-full rounded-full opacity-60"
                      style={{
                        width: "100%",
                        background: cat.color,
                      }}
                    />
                  )}
                </div>
              )}
            </div>
            <div className="text-[10px] text-foreground-faint mono tabular shrink-0">
              {spent > 0 ? formatCents(spent) : "—"} this mo
            </div>
          </div>
        )}
      </div>
      {cat.classification !== "income" && (
        <div className="text-right shrink-0">
          <div className="mono tabular text-sm text-foreground-muted">
            {cat.monthlyLimitCents ? formatCents(cat.monthlyLimitCents) : "—"}
          </div>
          <span className="block text-[10px] text-foreground-faint tracking-tight">
            monthly limit
          </span>
        </div>
      )}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onEdit}
          className="size-8 inline-flex items-center justify-center text-foreground-faint hover:text-foreground rounded-md hover:bg-surface-2"
          title="Edit"
        >
          <Pencil className="size-3.5" strokeWidth={1.5} />
        </button>
        {!cat.isSystem && (
          <button
            onClick={() => {
              if (
                confirm(
                  `Delete "${cat.name}"? Transactions will keep their old name but become uncategorized.`,
                )
              )
                deleteCategory(cat.id);
            }}
            className="size-8 inline-flex items-center justify-center text-foreground-faint hover:text-blush-deep rounded-md hover:bg-surface-2"
            title="Delete"
          >
            <Trash2 className="size-3.5" strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
      {isExpanded && (
        <div className="px-5 pb-4 pl-[3.25rem] bg-surface-2/40">
          {txs.length === 0 ? (
            <div className="text-xs text-foreground-faint py-3">
              No transactions this month.
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {txs.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 py-2.5 text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="tracking-tight truncate">{t.merchant}</div>
                    <div className="text-[11px] text-foreground-faint mt-0.5">
                      {format(new Date(t.date), "EEE, MMM d")}
                    </div>
                  </div>
                  <div className="mono tabular text-sm shrink-0">
                    {formatCents(t.amountCents, { signed: t.amountCents > 0 })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function CategoryForm({
  initial,
  onClose,
}: {
  initial: Category | null;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const editing = !!initial;
  const [color, setColor] = useState(initial?.color ?? "#d4a574");

  return (
    <Card className="p-6 md:p-8">
      <div className="mb-6">
        <Label>{editing ? "Editing" : "New category"}</Label>
        <h3 className="serif text-2xl mt-1">
          {editing ? initial.name : "A new bucket"}
        </h3>
      </div>
      <form
        action={(fd) => {
          startTransition(async () => {
            if (editing) {
              fd.set("id", String(initial.id));
              await updateCategory(fd);
            } else {
              await createCategory(fd);
            }
            onClose();
          });
        }}
        className="space-y-6"
      >
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={initial?.name}
              required
            />
          </div>
          <div>
            <Label htmlFor="classification">Classification</Label>
            <select
              id="classification"
              name="classification"
              defaultValue={initial?.classification ?? "want"}
              className="h-10 w-full bg-surface border border-border rounded-xl px-3.5 text-sm focus:border-blush focus:ring-2 focus:ring-blush-tint focus:outline-none transition-all"
            >
              {classifications.map((c) => (
                <option key={c} value={c} className="bg-surface">
                  {classificationLabel[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="limit">Monthly amount (optional)</Label>
            <Input
              id="limit"
              name="limit"
              placeholder="200.00"
              defaultValue={
                initial?.monthlyLimitCents
                  ? (initial.monthlyLimitCents / 100).toFixed(2)
                  : ""
              }
            />
          </div>
          <div>
            <Label htmlFor="color">Color</Label>
            <div className="flex items-center gap-3 h-10 border-b border-border-strong">
              <input
                id="color"
                name="color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="size-6 rounded bg-transparent cursor-pointer"
              />
              <span className="mono text-xs text-foreground-muted">
                {color}
              </span>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving..." : editing ? "Save changes" : "Add category"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
