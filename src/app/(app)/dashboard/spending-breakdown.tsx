"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DonutChart, type DonutDatum } from "@/components/charts/DonutChart";
import { CategoryGlyph } from "@/components/category-glyph";
import { formatCents } from "@/lib/utils";

export type SpendingSlice = {
  // null id => non-clickable rollup ("Other"); "uncategorized" => links to the
  // uncategorized filter. A number is a real category id.
  id: number | "uncategorized" | null;
  name: string;
  value: number;
  color: string;
  icon?: string | null;
};

function hrefFor(id: SpendingSlice["id"]): string | null {
  if (typeof id === "number") return `/transactions?cat=${id}`;
  if (id === "uncategorized") return "/transactions?cat=uncategorized";
  return null;
}

export type UpcomingBill = {
  merchant: string;
  amountCents: number;
  date: string; // ISO
};

export function SpendingHero({
  slices,
  spent,
  saved,
  income,
  incomeReceived = 0,
  incomeIsExpected = false,
  isCurrentMonth = true,
  dayOfMonth = 1,
  daysInMonth = 30,
  upcoming = [],
  prevMonthHref,
}: {
  slices: SpendingSlice[];
  spent: number;
  saved: number;
  // The income figure the month is measured against: expected income for the
  // live month before payday, otherwise what actually came in.
  income: number;
  incomeReceived?: number;
  incomeIsExpected?: boolean;
  isCurrentMonth?: boolean;
  dayOfMonth?: number;
  daysInMonth?: number;
  // Feeds the fresh-month state so the hero is useful before anything is spent.
  upcoming?: UpcomingBill[];
  prevMonthHref?: string;
}) {
  const router = useRouter();
  const [active, setActive] = useState<DonutDatum | null>(null);
  const donutData: DonutDatum[] = slices.map((s) => ({
    name: s.name,
    value: s.value,
    color: s.color,
    href: hrefFor(s.id),
  }));
  const activePct = active && spent > 0 ? Math.round((active.value / spent) * 100) : 0;

  // Income minus everything that went out (spending and saving). Negative has
  // two very different causes, and they get very different copy:
  //   - spending alone beat income: real overspending (red)
  //   - saving pushed it over: you invested out of cash you already had (fine)
  const left = income - spent - saved;
  const overspent = income > 0 && spent > income;
  const noIncome = income <= 0;
  const spentPct = income > 0 ? Math.round((spent / income) * 100) : null;

  // Bar scaled to whichever is bigger, income or what went out, with a tick
  // where income runs out when more went out than came in.
  const out = spent + saved;
  const scale = Math.max(income, out, 1);
  const incomeTick = out > income && income > 0 ? income / scale : null;

  let leftLabel: string;
  let leftNote: string;
  let leftColor = "var(--foreground)";
  if (noIncome) {
    leftLabel = isCurrentMonth ? "Income not in yet" : "No income recorded";
    leftNote = isCurrentMonth
      ? "Nothing has landed yet. Set your expected income on Budget and this will plan against it."
      : "Nothing came in this month, so there's nothing to measure against.";
  } else if (left >= 0) {
    leftLabel = isCurrentMonth ? "Left to spend" : "Left over";
    leftNote = isCurrentMonth
      ? `What's left of ${incomeIsExpected ? "this month's expected" : "this month's"} income after spending and saving.`
      : "Income that wasn't spent or saved this month.";
  } else if (overspent) {
    leftLabel = "Over income";
    leftColor = "var(--blush-deep)";
    leftNote = `Spending alone is ${formatCents(spent - income)} more than ${incomeIsExpected ? "you expect to earn" : "you earned"} this month.`;
  } else {
    leftLabel = "Over income";
    leftColor = "var(--blue-deep)";
    leftNote = `You saved ${formatCents(saved)}, so a bit more went out than ${incomeIsExpected ? "you expect to earn" : "came in"}. The extra ${formatCents(-left)} comes out of cash you already had. That's not overspending.`;
  }

  return (
    <section className="rise overflow-hidden rounded-card bg-surface p-6 md:p-8">
      {spent <= 0 && saved <= 0 ? (
        !isCurrentMonth ? (
          <div className="py-16 text-center text-sm text-foreground-faint">
            No spending recorded this month.
          </div>
        ) : (
          <div className="mx-auto max-w-md py-10 text-center md:py-14">
            <div className="mb-2 text-[11px] uppercase tracking-[0.08em] font-bold text-foreground-muted">
              Fresh month
            </div>
            <div className="display text-2xl md:text-3xl">Nothing spent yet.</div>
            {income > 0 && (
              <p className="mt-3 text-sm text-foreground-muted">
                <span className="mono tabular">{formatCents(incomeReceived)}</span> of{" "}
                <span className="mono tabular">{formatCents(income)}</span> expected income has landed.
              </p>
            )}
            {upcoming.length > 0 && (
              <div className="mt-6 space-y-2 text-left">
                <div className="text-[10px] uppercase tracking-[0.08em] font-bold text-foreground-muted text-center">
                  Coming up
                </div>
                {upcoming.slice(0, 3).map((b, i) => (
                  <div
                    key={`${b.merchant}-${i}`}
                    className="flex items-baseline justify-between gap-3 rounded-xl bg-surface-2/50 px-4 py-2.5 text-sm"
                  >
                    <span className="truncate tracking-tight">{b.merchant}</span>
                    <span className="shrink-0 text-[11px] text-foreground-faint">
                      {new Date(b.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                    <span className="mono tabular shrink-0">{formatCents(b.amountCents)}</span>
                  </div>
                ))}
              </div>
            )}
            {prevMonthHref && (
              <Link
                href={prevMonthHref}
                className="mt-6 inline-block text-xs tracking-tight text-foreground-muted underline-offset-4 hover:text-foreground hover:underline"
              >
                See how last month ended
              </Link>
            )}
          </div>
        )
      ) : (
        <>
          <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-center lg:gap-12 xl:gap-16">
            {/* Donut: tap a slice to see those transactions. */}
            <div
              className="@container relative w-full max-w-[340px] shrink-0 lg:w-[340px]"
              onMouseLeave={() => setActive(null)}
            >
              <DonutChart
                data={donutData}
                size={360}
                thickness={52}
                formatValue={formatCents}
                showTooltip={false}
                onActiveChange={setActive}
                onSliceClick={(d) => d.href && router.push(d.href)}
              />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-[15%] text-center">
                {active ? (
                  <>
                    <span
                      className="mb-1 max-w-full truncate text-[max(10px,2.8cqw)] uppercase tracking-[0.08em] font-bold"
                      style={{ color: active.color }}
                    >
                      {active.name}
                    </span>
                    <span className="display text-[9cqw] leading-none">{formatCents(active.value)}</span>
                    <span className="mt-1.5 text-[max(11px,3cqw)] text-foreground-faint">
                      {activePct}% of spending
                    </span>
                  </>
                ) : (
                  <>
                    <span
                      className="mb-1 text-[max(10px,2.8cqw)] uppercase tracking-[0.08em] font-bold"
                      style={{ color: "var(--blush-deep)" }}
                    >
                      Spent
                    </span>
                    <span className="display text-[10cqw] leading-none">{formatCents(spent)}</span>
                    {spentPct !== null && (
                      <span className="mt-1.5 text-[max(11px,3cqw)] text-foreground-faint">
                        {spentPct}% of income
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* The month, top to bottom: what came in, what went out, what's left. */}
            <div className="flex w-full min-w-0 flex-1 flex-col gap-5">
              {!noIncome && (
                <div className="relative">
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full"
                      style={{
                        width: `${(spent / scale) * 100}%`,
                        background: overspent ? "var(--blush-deep)" : "var(--blush)",
                      }}
                    />
                    <div
                      className="h-full"
                      style={{ width: `${(saved / scale) * 100}%`, background: "var(--blue)" }}
                    />
                  </div>
                  {incomeTick !== null && (
                    <div
                      title="where income runs out"
                      className="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-foreground"
                      style={{ left: `${incomeTick * 100}%` }}
                    />
                  )}
                </div>
              )}

              <div className="divide-y divide-border/70">
                <LedgerLine
                  label={incomeIsExpected ? "Income (expected)" : "Income"}
                  sub={
                    incomeIsExpected
                      ? `${formatCents(incomeReceived)} has landed so far`
                      : undefined
                  }
                  value={formatCents(income)}
                  swatch="var(--foreground-faint)"
                />
                <LedgerLine label="Spent" value={`−${formatCents(spent)}`} swatch="var(--blush)" />
                <LedgerLine
                  label="Saved & invested"
                  value={`−${formatCents(saved)}`}
                  swatch="var(--blue)"
                />
                <div className="pt-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium tracking-tight">{leftLabel}</span>
                    {!noIncome && (
                      <span className="display text-[1.6rem] leading-none" style={{ color: leftColor }}>
                        {formatCents(Math.abs(left))}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-foreground-muted">{leftNote}</p>
                </div>
              </div>

              {isCurrentMonth && spentPct !== null && (
                <PaceLine
                  spentPct={spentPct}
                  calendarPct={Math.round((dayOfMonth / daysInMonth) * 100)}
                />
              )}
            </div>
          </div>

          {slices.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 border-t border-border/40 pt-4">
              {slices.map((s, i) => {
                const href = hrefFor(s.id);
                const inner = (
                  <span className="flex items-center gap-1.5 text-[12px] tracking-tight">
                    <CategoryGlyph icon={s.icon} color={s.color} size={18} />
                    <span className="truncate text-foreground-muted">{s.name}</span>
                  </span>
                );
                return href ? (
                  <Link
                    key={String(s.id)}
                    href={href}
                    className="rounded-md px-1 py-0.5 transition-colors hover:text-foreground"
                  >
                    {inner}
                  </Link>
                ) : (
                  <span key={`x-${i}`} className="px-1 py-0.5">
                    {inner}
                  </span>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function LedgerLine({
  label,
  sub,
  value,
  swatch,
}: {
  label: string;
  sub?: string;
  value: string;
  swatch: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: swatch }} />
      <div className="min-w-0 flex-1">
        <div className="text-sm tracking-tight text-foreground-muted">{label}</div>
        {sub && <div className="text-[11px] text-foreground-faint">{sub}</div>}
      </div>
      <span className="mono tabular shrink-0 text-sm">{value}</span>
    </div>
  );
}

// One honest sentence about pace: share of income spent vs share of the month
// gone. Within 5 points either way reads as on pace.
function PaceLine({ spentPct, calendarPct }: { spentPct: number; calendarPct: number }) {
  const delta = spentPct - calendarPct;
  const verdict =
    delta > 5 ? "Spending is running ahead of the calendar." : delta < -5 ? "Spending is behind the calendar. Nice." : "Right on pace.";
  const color =
    delta > 5 ? "var(--blush-deep)" : delta < -5 ? "var(--blue-deep)" : "var(--foreground-muted)";
  return (
    <div className="rounded-xl bg-surface-2/60 px-3.5 py-2.5 text-[12px] tracking-tight text-foreground-muted">
      {calendarPct}% of the month is gone and you&apos;ve spent {spentPct}% of income.{" "}
      <span className="font-medium" style={{ color }}>
        {verdict}
      </span>
    </div>
  );
}
