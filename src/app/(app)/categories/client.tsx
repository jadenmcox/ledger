"use client";

import { useState, useTransition } from "react";
import { Card, Label, Input, Button, Pill, ProgressBar } from "@/components/ui";
import { formatCents } from "@/lib/utils";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  setLimit,
} from "./actions";
import type { Category } from "@/db/schema";
import { classifications } from "@/db/schema";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";

const classificationLabel: Record<string, string> = {
  income: "Income",
  need: "Needs",
  want: "Wants",
  savings: "Savings",
};

const classificationOrder = ["income", "need", "want", "savings"] as const;

export function CategoriesClient({
  initial,
  spendByCategory = {},
}: {
  initial: Category[];
  spendByCategory?: Record<number, number>;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const grouped = classificationOrder.map((c) => ({
    classification: c,
    items: initial.filter((cat) => cat.classification === c && !cat.isArchived),
  }));

  return (
    <div className="space-y-12">
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => setAdding(true)}>
          <Plus className="size-4" strokeWidth={1.5} /> New category
        </Button>
      </div>

      {(adding || editing) && (
        <CategoryForm
          initial={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
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
  onEdit,
}: {
  cat: Category;
  spent: number;
  onEdit: () => void;
}) {
  const [editLimit, setEditLimit] = useState(false);
  const [limitVal, setLimitVal] = useState(
    cat.monthlyLimitCents ? (cat.monthlyLimitCents / 100).toFixed(2) : "",
  );
  const [, startTransition] = useTransition();

  const saveLimit = () => {
    startTransition(async () => {
      await setLimit(cat.id, limitVal);
      setEditLimit(false);
    });
  };

  return (
    <div className="px-5 py-4 flex items-center gap-4 group">
      <div
        className="size-2.5 rounded-full shrink-0"
        style={{ background: cat.color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1.5">
          <Link
            href={`/categories/${cat.id}`}
            className="tracking-tight hover:text-blush-deep transition-colors inline-flex items-center gap-1.5"
          >
            {cat.name}
            <ArrowUpRight
              className="size-3 opacity-0 group-hover:opacity-100 transition-opacity"
              strokeWidth={1.5}
            />
          </Link>
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
      <div className="text-right shrink-0">
        {editLimit ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={limitVal}
              onChange={(e) => setLimitVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveLimit();
                if (e.key === "Escape") setEditLimit(false);
              }}
              placeholder="0.00"
              className="w-24 text-right mono tabular h-7"
            />
            <button
              onClick={saveLimit}
              className="size-7 inline-flex items-center justify-center text-blue-deep rounded-md hover:bg-surface-2"
            >
              <Check className="size-4" strokeWidth={1.5} />
            </button>
            <button
              onClick={() => setEditLimit(false)}
              className="size-7 inline-flex items-center justify-center text-foreground-faint rounded-md hover:bg-surface-2"
            >
              <X className="size-4" strokeWidth={1.5} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditLimit(true)}
            className="mono tabular text-sm text-foreground-muted hover:text-blush-deep transition-colors"
          >
            {cat.monthlyLimitCents
              ? formatCents(cat.monthlyLimitCents)
              : "—"}
            <span className="block text-[10px] text-foreground-faint tracking-tight font-sans">
              monthly limit
            </span>
          </button>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
            <Label htmlFor="limit">Monthly limit (optional)</Label>
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
