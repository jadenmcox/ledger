"use client";

import { useState, useTransition } from "react";
import type { Account, Category, RecurringSchedule } from "@/db/schema";
import { Card, Input, Label, Pill, Button } from "@/components/ui";
import { cn, formatCents } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { Plus, Repeat, Trash2, Pause, Play } from "lucide-react";
import { createSchedule, deleteSchedule, toggleSchedule } from "./actions";

export function RecurringClient({
  initial,
  accounts,
  categories,
}: {
  initial: RecurringSchedule[];
  accounts: Account[];
  categories: Category[];
}) {
  const [adding, setAdding] = useState(false);
  const acctById = new Map(accounts.map((a) => [a.id, a]));
  const catById = new Map(categories.map((c) => [c.id, c]));

  function readableCadence(s: RecurringSchedule): string {
    if (s.cadence === "weekly") return "Weekly";
    if (s.cadence === "biweekly") return "Every 2 weeks";
    const days: number[] = s.daysOfMonth ? JSON.parse(s.daysOfMonth) : [];
    if (s.cadence === "semi_monthly") {
      return `${days.map(ordinal).join(" & ")} of each month`;
    }
    return `${ordinal(days[0] ?? 1)} of each month`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button variant="primary" onClick={() => setAdding(true)}>
          <Plus className="size-4" strokeWidth={1.75} />
          New schedule
        </Button>
      </div>

      {initial.length === 0 ? (
        <Card className="p-10 text-center">
          <Repeat
            className="size-8 text-foreground-faint mx-auto mb-3"
            strokeWidth={1.25}
          />
          <h3 className="serif text-xl mb-2">No recurring schedules yet</h3>
          <p className="text-sm text-foreground-muted max-w-md mx-auto">
            Add one for your paycheck, rent, or any subscription. Budgetly will
            create the transactions on their due dates and dedupe against any
            real ones imported later.
          </p>
        </Card>
      ) : (
        <Card className="divide-y divide-border">
          {initial.map((s) => (
            <ScheduleRow
              key={s.id}
              schedule={s}
              account={acctById.get(s.accountId)}
              category={s.categoryId ? catById.get(s.categoryId) : undefined}
              cadenceLabel={readableCadence(s)}
            />
          ))}
        </Card>
      )}

      {adding && (
        <ScheduleModal
          accounts={accounts}
          categories={categories}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}

function ScheduleRow({
  schedule,
  account,
  category,
  cadenceLabel,
}: {
  schedule: RecurringSchedule;
  account: Account | undefined;
  category: Category | undefined;
  cadenceLabel: string;
}) {
  const [, startTransition] = useTransition();
  const isIncome = schedule.amountCents > 0;
  return (
    <div className="px-5 py-4 flex items-center gap-4">
      <Repeat
        className={cn(
          "size-4 shrink-0",
          schedule.isActive ? "text-blush-deep" : "text-foreground-faint",
        )}
        strokeWidth={1.5}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm tracking-tight truncate font-medium">
            {schedule.merchantRaw}
          </span>
          {category && (
            <Pill
              tone={
                category.classification as "need" | "want" | "savings" | "income"
              }
            >
              {category.name}
            </Pill>
          )}
          {!schedule.isActive && <Pill>paused</Pill>}
        </div>
        <div className="text-[11px] text-foreground-faint tracking-tight mt-1">
          {cadenceLabel} · {account?.name ?? "?"} · since{" "}
          {format(parseISO(schedule.startDate), "MMM d, yyyy")}
        </div>
      </div>
      <div
        className={cn(
          "mono tabular text-sm shrink-0",
          isIncome ? "text-blue-deep" : "text-foreground",
        )}
      >
        {formatCents(schedule.amountCents, { signed: true })}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() =>
            startTransition(() =>
              toggleSchedule(schedule.id, !schedule.isActive),
            )
          }
          className="size-8 inline-flex items-center justify-center text-foreground-faint hover:text-foreground rounded-md hover:bg-surface-2"
          title={schedule.isActive ? "Pause" : "Resume"}
        >
          {schedule.isActive ? (
            <Pause className="size-3.5" strokeWidth={1.5} />
          ) : (
            <Play className="size-3.5" strokeWidth={1.5} />
          )}
        </button>
        <button
          onClick={() => {
            if (
              confirm(
                `Delete the "${schedule.merchantRaw}" schedule? Already-created transactions will stay.`,
              )
            )
              startTransition(() => deleteSchedule(schedule.id));
          }}
          className="size-8 inline-flex items-center justify-center text-foreground-faint hover:text-blush-deep rounded-md hover:bg-surface-2"
          title="Delete"
        >
          <Trash2 className="size-3.5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

function ScheduleModal({
  accounts,
  categories,
  onClose,
}: {
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [cadence, setCadence] = useState<
    "monthly" | "semi_monthly" | "weekly" | "biweekly"
  >("semi_monthly");
  const [direction, setDirection] = useState<"in" | "out">("in");

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
        <Card className="p-6">
          <Label>New recurring schedule</Label>
          <h3 className="serif text-xl mt-1 mb-5">A thing that repeats</h3>
          <form
            action={(fd) => {
              fd.set("direction", direction);
              fd.set("cadence", cadence);
              startTransition(async () => {
                await createSchedule(fd);
                onClose();
              });
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="merchant">Name</Label>
              <Input id="merchant" name="merchant" placeholder="Paycheck" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
              <div>
                <Label htmlFor="categoryId">Category</Label>
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
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
              <div>
                <Label htmlFor="amount">Amount per occurrence</Label>
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
                  onClick={() => setDirection("in")}
                  className={cn(
                    "px-3 text-xs tracking-tight transition-colors",
                    direction === "in"
                      ? "bg-sage-tint text-sage-deep font-medium"
                      : "text-foreground-faint hover:text-foreground",
                  )}
                >
                  Income
                </button>
                <button
                  type="button"
                  onClick={() => setDirection("out")}
                  className={cn(
                    "px-3 text-xs tracking-tight transition-colors border-l border-border",
                    direction === "out"
                      ? "bg-blush-tint text-blush-deep font-medium"
                      : "text-foreground-faint hover:text-foreground",
                  )}
                >
                  Expense
                </button>
              </div>
            </div>
            <div>
              <Label>Cadence</Label>
              <div className="grid grid-cols-4 gap-2 mt-1">
                {[
                  { v: "semi_monthly", l: "Semi-monthly" },
                  { v: "monthly", l: "Monthly" },
                  { v: "biweekly", l: "Biweekly" },
                  { v: "weekly", l: "Weekly" },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() =>
                      setCadence(
                        opt.v as
                          | "monthly"
                          | "semi_monthly"
                          | "weekly"
                          | "biweekly",
                      )
                    }
                    className={cn(
                      "h-9 rounded-lg border text-xs tracking-tight transition-colors",
                      cadence === opt.v
                        ? "bg-blush-tint border-blush text-blush-deep font-medium"
                        : "border-border text-foreground-muted hover:bg-surface-2",
                    )}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
            {(cadence === "monthly" || cadence === "semi_monthly") && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="day1">
                    Day {cadence === "semi_monthly" ? "1" : "of month"}
                  </Label>
                  <Input
                    id="day1"
                    name="day1"
                    type="number"
                    min={1}
                    max={31}
                    defaultValue={1}
                    required
                  />
                </div>
                {cadence === "semi_monthly" && (
                  <div>
                    <Label htmlFor="day2">Day 2</Label>
                    <Input
                      id="day2"
                      name="day2"
                      type="number"
                      min={1}
                      max={31}
                      defaultValue={16}
                      required
                    />
                  </div>
                )}
              </div>
            )}
            <div>
              <Label htmlFor="startDate">First occurrence on or after</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={format(new Date(), "yyyy-MM-dd")}
                required
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input id="notes" name="notes" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? "Creating…" : "Create & backfill"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
