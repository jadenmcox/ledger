"use client";

import { useState, useTransition } from "react";
import { Button, Card, Input, Label, Pill } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { cn, formatCents } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import type { RecurringCadence } from "@/db/schema";
import {
  createSchedule,
  updateSchedule,
  setScheduleActive,
  deleteSchedule,
} from "./actions";
import {
  CalendarClock,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";

export type ScheduleRow = {
  id: number;
  accountId: number;
  amountCents: number;
  merchantRaw: string;
  categoryId: number | null;
  cadence: RecurringCadence;
  daysOfMonth: string | null;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  isForecastOnly: boolean;
  notes: string | null;
  nextDate: string | null;
};

type AccountOpt = { id: number; name: string };
type CategoryOpt = { id: number; name: string; classification: string };

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

function cadenceLabel(s: ScheduleRow): string {
  if (s.cadence === "weekly") return "Weekly";
  if (s.cadence === "biweekly") return "Every 2 weeks";
  const days: number[] = s.daysOfMonth ? JSON.parse(s.daysOfMonth) : [];
  const names = days.map(ordinal).join(" & ");
  if (days.length <= 1) return `Monthly · the ${names || "?"}`;
  return `Twice a month · the ${names}`;
}

export function RecurringClient({
  schedules,
  accounts,
  categories,
  expectedIncome,
  paycheckCount,
}: {
  schedules: ScheduleRow[];
  accounts: AccountOpt[];
  categories: CategoryOpt[];
  expectedIncome: number;
  paycheckCount: number;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ScheduleRow | null>(null);
  const [, startTransition] = useTransition();

  const income = schedules.filter((s) => s.amountCents > 0);
  const bills = schedules.filter((s) => s.amountCents <= 0);
  const catById = new Map(categories.map((c) => [c.id, c]));

  const section = (title: string, hint: string, rows: ScheduleRow[]) => (
    <div>
      <div className="flex items-baseline justify-between mb-4 px-1">
        <div className="flex items-baseline gap-3">
          <h3 className="serif text-xl">{title}</h3>
          <span className="text-[10px] tracking-[0.2em] uppercase text-foreground-faint">
            {rows.length}
          </span>
        </div>
        <span className="text-[11px] text-foreground-faint tracking-tight">
          {hint}
        </span>
      </div>
      {rows.length === 0 ? (
        <Card className="p-6 text-sm text-foreground-faint">
          Nothing here yet.
        </Card>
      ) : (
        <Card className="divide-y divide-border">
          {rows.map((s) => {
            const cat = s.categoryId ? catById.get(s.categoryId) : null;
            return (
              <div
                key={s.id}
                className={cn(
                  "px-4 md:px-5 py-3.5 flex items-center gap-3 md:gap-4 group",
                  !s.isActive && "opacity-50",
                )}
              >
                <CalendarClock
                  className="size-4 text-foreground-faint shrink-0"
                  strokeWidth={1.5}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm tracking-tight truncate">
                      {s.merchantRaw}
                    </span>
                    {!s.isActive && <Pill>paused</Pill>}
                    {s.isForecastOnly && (
                      <Pill tone="savings">forecast only</Pill>
                    )}
                  </div>
                  <div className="text-[11px] text-foreground-faint mt-0.5">
                    {cadenceLabel(s)}
                    {cat ? ` · ${cat.name}` : ""}
                    {s.nextDate
                      ? ` · next ${format(parseISO(s.nextDate), "EEE, MMM d")}`
                      : ""}
                  </div>
                </div>
                <div
                  className={cn(
                    "mono tabular text-sm shrink-0",
                    s.amountCents > 0 ? "text-blue-deep" : "text-foreground",
                  )}
                >
                  {formatCents(s.amountCents, { signed: s.amountCents > 0 })}
                </div>
                <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setEditing(s)}
                    className="size-8 inline-flex items-center justify-center rounded-md hover:bg-surface-2 text-foreground-faint hover:text-foreground"
                    title="Edit"
                  >
                    <Pencil className="size-3.5" strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={() =>
                      startTransition(() =>
                        setScheduleActive(s.id, !s.isActive),
                      )
                    }
                    className="size-8 inline-flex items-center justify-center rounded-md hover:bg-surface-2 text-foreground-faint hover:text-foreground"
                    title={s.isActive ? "Pause" : "Resume"}
                  >
                    {s.isActive ? (
                      <Pause className="size-3.5" strokeWidth={1.5} />
                    ) : (
                      <Play className="size-3.5" strokeWidth={1.5} />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          `Delete "${s.merchantRaw}"? Transactions it already created stay; only future forecasting stops.`,
                        )
                      )
                        startTransition(() => deleteSchedule(s.id));
                    }}
                    className="size-8 inline-flex items-center justify-center rounded-md hover:bg-surface-2 text-foreground-faint hover:text-blush-deep"
                    title="Delete"
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );

  return (
    <div className="space-y-10">
      <Card className="p-5 md:p-6 flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground-faint">
            Expected monthly income
          </div>
          <div className="mt-1.5 flex items-baseline gap-3">
            <span className="display text-3xl">
              {formatCents(expectedIncome)}
            </span>
            <span className="text-[11px] text-foreground-faint">
              {paycheckCount > 0
                ? `${paycheckCount} paycheck${paycheckCount === 1 ? "" : "s"} a month, from the schedules below`
                : "add a paycheck schedule and the budget can plan against it"}
            </span>
          </div>
        </div>
        <Button variant="primary" onClick={() => setAdding(true)}>
          <Plus className="size-4" strokeWidth={1.75} /> New schedule
        </Button>
      </Card>

      {section(
        "Income",
        "counts toward expected income",
        income,
      )}
      {section("Bills", "feeds the upcoming-bills forecast", bills)}

      {(adding || editing) && (
        <ScheduleForm
          initial={editing}
          accounts={accounts}
          categories={categories}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ScheduleForm({
  initial,
  accounts,
  categories,
  onClose,
}: {
  initial: ScheduleRow | null;
  accounts: AccountOpt[];
  categories: CategoryOpt[];
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const editing = !!initial;
  const [direction, setDirection] = useState<"in" | "out">(
    initial ? (initial.amountCents > 0 ? "in" : "out") : "out",
  );
  const [cadence, setCadence] = useState<RecurringCadence>(
    initial?.cadence ?? "monthly",
  );
  // Forecast-only defaults ON for new schedules: most people's real
  // transactions arrive via bank sync/CSV, so creating them here too would
  // double-count. Uncheck for hand-tracked accounts.
  const [forecastOnly, setForecastOnly] = useState(
    initial ? initial.isForecastOnly : true,
  );
  const [error, setError] = useState<string | null>(null);

  const needsDays = cadence === "monthly" || cadence === "semi_monthly";
  const initialDays: string = initial?.daysOfMonth
    ? (JSON.parse(initial.daysOfMonth) as number[]).join(", ")
    : "";

  return (
    <Sheet open onClose={onClose}>
      <Label>{editing ? "Edit schedule" : "New schedule"}</Label>
      <h3 className="serif text-xl mt-1 mb-5">
        {editing ? initial.merchantRaw : "Something on a rhythm"}
      </h3>
      <form
        action={(fd) => {
          fd.set("direction", direction);
          fd.set("cadence", cadence);
          fd.set("forecastOnly", forecastOnly ? "1" : "0");
          startTransition(async () => {
            try {
              if (editing) {
                fd.set("id", String(initial.id));
                await updateSchedule(fd);
              } else {
                await createSchedule(fd);
              }
              onClose();
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          });
        }}
        className="space-y-4"
      >
        <div>
          <Label htmlFor="merchant">Name</Label>
          <Input
            id="merchant"
            name="merchant"
            placeholder="Paycheck, Rent, Netflix…"
            defaultValue={initial?.merchantRaw}
            required
          />
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              name="amount"
              inputMode="decimal"
              placeholder="0.00"
              defaultValue={
                initial ? (Math.abs(initial.amountCents) / 100).toFixed(2) : ""
              }
              required
            />
          </div>
          <div className="flex rounded-xl border border-border overflow-hidden h-11">
            <button
              type="button"
              onClick={() => setDirection("out")}
              className={cn(
                "px-3 text-xs tracking-tight transition-colors",
                direction === "out"
                  ? "bg-blush-tint text-blush-deep font-medium"
                  : "text-foreground-faint hover:text-foreground",
              )}
            >
              Bill
            </button>
            <button
              type="button"
              onClick={() => setDirection("in")}
              className={cn(
                "px-3 text-xs tracking-tight transition-colors border-l border-border",
                direction === "in"
                  ? "bg-blue-tint text-blue-deep font-medium"
                  : "text-foreground-faint hover:text-foreground",
              )}
            >
              Income
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="accountId">Account</Label>
            <select
              id="accountId"
              name="accountId"
              defaultValue={initial?.accountId ?? accounts[0]?.id}
              required
              className="h-11 w-full bg-surface border border-border rounded-xl px-3 text-sm"
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
              defaultValue={initial?.categoryId ?? ""}
              className="h-11 w-full bg-surface border border-border rounded-xl px-3 text-sm"
            >
              <option value="">— None —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="cadence">Cadence</Label>
            <select
              id="cadence"
              value={cadence}
              onChange={(e) => setCadence(e.target.value as RecurringCadence)}
              className="h-11 w-full bg-surface border border-border rounded-xl px-3 text-sm"
            >
              <option value="monthly">Monthly</option>
              <option value="semi_monthly">Twice a month</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          {needsDays ? (
            <div>
              <Label htmlFor="daysOfMonth">
                {cadence === "semi_monthly" ? "Days (two)" : "Day of month"}
              </Label>
              <Input
                id="daysOfMonth"
                name="daysOfMonth"
                placeholder={cadence === "semi_monthly" ? "1, 16" : "1"}
                defaultValue={initialDays}
                required
              />
            </div>
          ) : (
            <div>
              <Label htmlFor="startDate2">Anchored to</Label>
              <div className="h-11 flex items-center text-xs text-foreground-faint">
                the start date&apos;s weekday
              </div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="startDate">Start date</Label>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              defaultValue={
                initial?.startDate ?? format(new Date(), "yyyy-MM-dd")
              }
              required
            />
          </div>
          <div>
            <Label htmlFor="endDate">End date (optional)</Label>
            <Input
              id="endDate"
              name="endDate"
              type="date"
              defaultValue={initial?.endDate ?? ""}
            />
          </div>
        </div>
        <label className="flex items-start gap-2.5 text-xs text-foreground-muted cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={forecastOnly}
            onChange={(e) => setForecastOnly(e.target.checked)}
            className="accent-blush-deep mt-0.5"
          />
          <span>
            <span className="font-medium text-foreground">Forecast only.</span>{" "}
            Shapes expected income and upcoming bills but never creates
            transactions — the real ones arrive from your bank. Uncheck for
            hand-tracked accounts where nothing else records them.
          </span>
        </label>
        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Input id="notes" name="notes" defaultValue={initial?.notes ?? ""} />
        </div>
        {error && (
          <div className="text-xs text-blush-deep">{error}</div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : editing ? "Save changes" : "Add schedule"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
