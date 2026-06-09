"use client";

import { useState, useTransition } from "react";
import {
  Card,
  Label,
  Input,
  Button,
  EmptyState,
  Pill,
} from "@/components/ui";
import { formatCents } from "@/lib/utils";
import {
  createAccount,
  updateAccount,
  archiveAccount,
  unarchiveAccount,
  deleteAccount,
} from "./actions";
import type { Account } from "@/db/schema";
import { accountTypes } from "@/db/schema";
import { Plus, Pencil, Trash2, Archive, ArchiveRestore, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Sparkline } from "@/components/charts/Sparkline";

const typeLabel: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  hys: "High-yield savings",
  credit: "Credit card",
  cash: "Cash",
  brokerage: "Brokerage",
  roth_ira: "Roth IRA",
  traditional_401k: "401(k)",
  hsa: "HSA",
  loan: "Loan",
  other: "Other",
};

const typeGroup: Record<string, "asset" | "debt" | "tax"> = {
  checking: "asset",
  savings: "asset",
  hys: "asset",
  cash: "asset",
  brokerage: "asset",
  credit: "debt",
  loan: "debt",
  roth_ira: "tax",
  traditional_401k: "tax",
  hsa: "tax",
  other: "asset",
};

export function AccountsClient({
  initial,
  trends = {},
}: {
  initial: Account[];
  today: string;
  trends?: Record<number, number[]>;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  if (initial.length === 0 && !adding) {
    return (
      <EmptyState
        title="No accounts yet"
        body="Add your first account. The current balance you enter today becomes the starting point for tracking your net worth over time."
        action={
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Plus className="size-4" strokeWidth={1.5} /> Add an account
          </Button>
        }
      />
    );
  }

  const active = initial.filter((a) => a.isActive);
  const archived = initial.filter((a) => !a.isActive);

  return (
    <div className="space-y-12">
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => setAdding(true)}>
          <Plus className="size-4" strokeWidth={1.5} /> New account
        </Button>
      </div>

      {(adding || editing) && (
        <AccountForm
          initial={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
      )}

      <AccountList
        accounts={active}
        onEdit={setEditing}
        onArchive={(id) => archiveAccount(id)}
        trends={trends}
      />

      {archived.length > 0 && (
        <div>
          <div className="flex items-baseline gap-3 mb-4">
            <h3 className="serif text-xl text-foreground-muted">Archived</h3>
            <span className="text-[10px] tracking-[0.2em] uppercase text-foreground-faint">
              {archived.length}
            </span>
          </div>
          <AccountList
            accounts={archived}
            onEdit={setEditing}
            onUnarchive={(id) => unarchiveAccount(id)}
            onDelete={(id) => {
              if (
                confirm(
                  "Delete this account and all its transactions? This cannot be undone.",
                )
              )
                deleteAccount(id);
            }}
            faded
          />
        </div>
      )}
    </div>
  );
}

function AccountList({
  accounts,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
  faded,
  trends = {},
}: {
  accounts: Account[];
  onEdit: (a: Account) => void;
  onArchive?: (id: number) => void;
  onUnarchive?: (id: number) => void;
  onDelete?: (id: number) => void;
  faded?: boolean;
  trends?: Record<number, number[]>;
}) {
  if (accounts.length === 0) return null;

  // Group by category
  const groups = {
    asset: [] as Account[],
    tax: [] as Account[],
    debt: [] as Account[],
  };
  for (const a of accounts) {
    groups[typeGroup[a.type] || "asset"].push(a);
  }

  return (
    <div className={`space-y-8 ${faded ? "opacity-60" : ""}`}>
      {(["asset", "tax", "debt"] as const).map((g) => {
        const list = groups[g];
        if (list.length === 0) return null;
        const total = list.reduce((s, a) => s + a.currentBalanceCents, 0);
        const groupName = {
          asset: "Cash & investments",
          tax: "Tax-advantaged",
          debt: "Debt",
        }[g];
        return (
          <div key={g}>
            <div className="flex items-baseline justify-between mb-4 px-1">
              <Label>{groupName}</Label>
              <div className="mono tabular text-sm text-foreground-muted">
                {formatCents(total)}
              </div>
            </div>
            <Card className="divide-y divide-border">
              {list.map((a) => {
                const series = trends[a.id] ?? [];
                const isDebt = g === "debt";
                const trendColor = isDebt
                  ? "var(--blush)"
                  : "var(--blue)";
                return (
                <div
                  key={a.id}
                  className="px-5 py-4 flex items-center gap-4 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-3 mb-1">
                      <Link
                        href={`/accounts/${a.id}`}
                        className="tracking-tight hover:text-blush-deep transition-colors inline-flex items-center gap-1.5"
                      >
                        {a.name}
                        <ArrowUpRight
                          className="size-3 opacity-0 group-hover:opacity-100 transition-opacity"
                          strokeWidth={1.5}
                        />
                      </Link>
                      <Pill>{typeLabel[a.type] || a.type}</Pill>
                    </div>
                    {a.institution && (
                      <div className="text-xs text-foreground-faint">
                        {a.institution}
                      </div>
                    )}
                  </div>
                  {series.length > 1 && (
                    <div className="hidden sm:block shrink-0">
                      <Sparkline
                        values={series}
                        color={trendColor}
                        width={88}
                        height={28}
                      />
                    </div>
                  )}
                  <div className="mono tabular text-base shrink-0">
                    {formatCents(a.currentBalanceCents)}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEdit(a)}
                      className="size-8 inline-flex items-center justify-center text-foreground-faint hover:text-foreground rounded-md hover:bg-surface-2"
                      title="Edit"
                    >
                      <Pencil className="size-3.5" strokeWidth={1.5} />
                    </button>
                    {onArchive && (
                      <button
                        onClick={() => onArchive(a.id)}
                        className="size-8 inline-flex items-center justify-center text-foreground-faint hover:text-foreground rounded-md hover:bg-surface-2"
                        title="Archive"
                      >
                        <Archive className="size-3.5" strokeWidth={1.5} />
                      </button>
                    )}
                    {onUnarchive && (
                      <button
                        onClick={() => onUnarchive(a.id)}
                        className="size-8 inline-flex items-center justify-center text-foreground-faint hover:text-foreground rounded-md hover:bg-surface-2"
                        title="Unarchive"
                      >
                        <ArchiveRestore
                          className="size-3.5"
                          strokeWidth={1.5}
                        />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(a.id)}
                        className="size-8 inline-flex items-center justify-center text-foreground-faint hover:text-blush-deep rounded-md hover:bg-surface-2"
                        title="Delete permanently"
                      >
                        <Trash2 className="size-3.5" strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                </div>
                );
              })}
            </Card>
          </div>
        );
      })}
    </div>
  );
}

function AccountForm({
  initial,
  onClose,
}: {
  initial: Account | null;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const editing = !!initial;

  return (
    <Card className="p-6 md:p-8">
      <div className="mb-6">
        <Label>{editing ? "Editing" : "New account"}</Label>
        <h3 className="serif text-2xl mt-1">
          {editing ? initial.name : "What are we adding?"}
        </h3>
      </div>
      <form
        action={(fd) => {
          startTransition(async () => {
            if (editing) {
              fd.set("id", String(initial.id));
              await updateAccount(fd);
            } else {
              await createAccount(fd);
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
              placeholder="Chase checking"
              defaultValue={initial?.name}
              required
            />
          </div>
          <div>
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              name="type"
              defaultValue={initial?.type ?? "checking"}
              className="h-10 w-full bg-surface border border-border rounded-xl px-3.5 text-sm focus:border-sage focus:ring-2 focus:ring-sage-tint focus:outline-none transition-all"
            >
              {accountTypes.map((t) => (
                <option key={t} value={t} className="bg-surface">
                  {typeLabel[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="institution">Institution</Label>
            <Input
              id="institution"
              name="institution"
              placeholder="Chase"
              defaultValue={initial?.institution ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="balance">Current balance</Label>
            <Input
              id="balance"
              name="balance"
              placeholder="0.00"
              defaultValue={
                initial ? (initial.currentBalanceCents / 100).toFixed(2) : ""
              }
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving..." : editing ? "Save changes" : "Add account"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
