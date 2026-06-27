"use client";

import { useState, useTransition } from "react";
import { Card, Button, Input, Label, ProgressBar } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { formatCents, cn } from "@/lib/utils";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  createSavingsGoal,
  updateSavingsGoal,
  deleteSavingsGoal,
} from "./actions";
import type { SavingsGoal } from "@/db/schema";

type GoalView = {
  goal: SavingsGoal;
  accountName: string | null;
  current: number;
  projectedYearEnd: number;
};

type Totals = {
  target: number;
  current: number;
  monthly: number;
  projected: number;
};

type AccountOption = { id: number; name: string; type: string };

export function SavingsGoalsSection({
  goals,
  totals,
  accounts,
}: {
  goals: GoalView[];
  totals: Totals;
  accounts: AccountOption[];
}) {
  const [editing, setEditing] = useState<SavingsGoal | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 mb-4 md:mb-5">
        <div className="min-w-0">
          <h2 className="display text-lg md:text-xl tracking-tight">
            Savings goals
          </h2>
          <p className="text-[11px] text-foreground-faint tracking-tight mt-1">
            year-end target vs where you&apos;d land
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="shrink-0 text-xs text-foreground-muted hover:text-foreground transition-colors tracking-tight inline-flex items-center gap-1"
        >
          <Plus className="size-3" strokeWidth={1.5} /> add goal
        </button>
      </div>
      {goals.length === 0 ? (
        <Card className="p-8 text-center text-foreground-faint text-sm">
          No savings goals yet.{" "}
          <button
            onClick={() => setCreating(true)}
            className="text-blush-deep hover:underline"
          >
            Add your first
          </button>{" "}
          (HYS, Roth, an emergency fund, etc.).
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] tracking-[0.18em] uppercase text-foreground-faint border-b border-border">
                <th className="text-left px-5 py-3 font-medium">Goal</th>
                <th className="text-right px-3 py-3 font-medium hidden sm:table-cell">
                  Monthly
                </th>
                <th className="text-right px-3 py-3 font-medium">Current</th>
                <th className="text-right px-3 py-3 font-medium hidden md:table-cell">
                  Year-end target
                </th>
                <th className="text-right px-5 py-3 font-medium">Projected</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {goals.map(({ goal, accountName, current, projectedYearEnd }) => {
                const target = goal.yearEndTargetCents;
                const ratio = target > 0 ? current / target : 0;
                const willMiss = target > 0 && projectedYearEnd < target;
                return (
                  <tr
                    key={goal.id}
                    className="border-t border-border hover:bg-surface-2/30 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="min-w-0">
                          <div className="truncate font-medium tracking-tight">
                            {goal.name}
                          </div>
                          {accountName && (
                            <div className="text-[11px] text-foreground-faint mt-0.5 truncate">
                              {accountName}
                            </div>
                          )}
                        </div>
                      </div>
                      {target > 0 && (
                        <div className="mt-2 max-w-[180px]">
                          <ProgressBar
                            value={current}
                            max={target}
                            color="var(--blue)"
                            height={4}
                          />
                          <div className="text-[10px] text-foreground-faint mono tabular mt-1">
                            {(ratio * 100).toFixed(0)}% there
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right mono tabular text-foreground-muted hidden sm:table-cell">
                      {goal.monthlyTargetCents > 0
                        ? formatCents(goal.monthlyTargetCents)
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-right mono tabular">
                      {formatCents(current)}
                    </td>
                    <td className="px-3 py-3 text-right mono tabular text-foreground-muted hidden md:table-cell">
                      {target > 0 ? formatCents(target) : "—"}
                    </td>
                    <td
                      className={cn(
                        "px-5 py-3 text-right mono tabular",
                        willMiss && "text-blush-deep",
                      )}
                    >
                      {formatCents(projectedYearEnd)}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <button
                        onClick={() => setEditing(goal)}
                        className="size-7 inline-flex items-center justify-center rounded-md hover:bg-surface-2 text-foreground-faint hover:text-foreground"
                        title="Edit"
                      >
                        <Pencil className="size-3.5" strokeWidth={1.5} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-border bg-surface-2/40">
                <td className="px-5 py-3 text-sm font-medium tracking-tight">
                  Total
                </td>
                <td className="px-3 py-3 text-right mono tabular hidden sm:table-cell">
                  {formatCents(totals.monthly)}
                </td>
                <td className="px-3 py-3 text-right mono tabular">
                  {formatCents(totals.current)}
                </td>
                <td className="px-3 py-3 text-right mono tabular hidden md:table-cell">
                  {formatCents(totals.target)}
                </td>
                <td
                  className={cn(
                    "px-5 py-3 text-right mono tabular",
                    totals.target > 0 &&
                      totals.projected < totals.target &&
                      "text-blush-deep",
                  )}
                >
                  {formatCents(totals.projected)}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </Card>
      )}
      {creating && (
        <GoalModal
          accounts={accounts}
          onClose={() => setCreating(false)}
          mode="create"
        />
      )}
      {editing && (
        <GoalModal
          accounts={accounts}
          goal={editing}
          onClose={() => setEditing(null)}
          mode="edit"
        />
      )}
    </div>
  );
}

function GoalModal({
  goal,
  accounts,
  onClose,
  mode,
}: {
  goal?: SavingsGoal;
  accounts: AccountOption[];
  onClose: () => void;
  mode: "create" | "edit";
}) {
  const [pending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();
  const savingsAccounts = accounts.filter((a) =>
    ["savings", "hys", "roth_ira", "traditional_401k", "hsa", "brokerage"].includes(
      a.type,
    ),
  );

  return (
    <Sheet open onClose={onClose}>
      <Label>{mode === "create" ? "New savings goal" : "Edit goal"}</Label>
      <form
        action={(fd) =>
          startTransition(async () => {
            if (mode === "edit") await updateSavingsGoal(fd);
            else await createSavingsGoal(fd);
            onClose();
          })
        }
        className="space-y-4 mt-3"
      >
        {goal && <input type="hidden" name="id" value={goal.id} />}
        <div>
          <Label>Name</Label>
          <Input
            name="name"
            defaultValue={goal?.name ?? ""}
            placeholder="HYS, Roth IRA, Emergency fund…"
            required
            autoFocus
          />
        </div>
        <div>
          <Label>Linked account (optional)</Label>
          <select
            name="accountId"
            defaultValue={goal?.accountId ?? ""}
            className="h-11 w-full bg-surface border border-border rounded-xl px-3.5 text-sm focus:border-blush focus:ring-2 focus:ring-blush-tint focus:outline-none transition-all"
          >
            <option value="">No account · I&apos;ll enter the balance manually</option>
            {savingsAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <div className="text-[11px] text-foreground-faint mt-1">
            Linking pulls the current balance automatically.
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Year-end target ($)</Label>
            <Input
              name="yearEndTarget"
              type="number"
              step="0.01"
              defaultValue={
                goal ? (goal.yearEndTargetCents / 100).toFixed(2) : ""
              }
              placeholder="20000"
            />
          </div>
          <div>
            <Label>Monthly target ($)</Label>
            <Input
              name="monthlyTarget"
              type="number"
              step="0.01"
              defaultValue={
                goal ? (goal.monthlyTargetCents / 100).toFixed(2) : ""
              }
              placeholder="500"
            />
          </div>
        </div>
        <div>
          <Label>Current balance ($) — manual only</Label>
          <Input
            name="manualBalance"
            type="number"
            step="0.01"
            defaultValue={
              goal ? (goal.manualBalanceCents / 100).toFixed(2) : ""
            }
            placeholder="5000"
          />
          <div className="text-[11px] text-foreground-faint mt-1">
            Ignored when an account is linked above.
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 pt-2">
          {mode === "edit" && goal ? (
            <Button
              type="button"
              variant="ghost"
              className="text-blush-deep"
              disabled={deleting}
              onClick={() =>
                startDelete(async () => {
                  const fd = new FormData();
                  fd.set("id", String(goal.id));
                  await deleteSavingsGoal(fd);
                  onClose();
                })
              }
            >
              <Trash2 className="size-3.5 mr-1.5" strokeWidth={1.5} />
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
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
