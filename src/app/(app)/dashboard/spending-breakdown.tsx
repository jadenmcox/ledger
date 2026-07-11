"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DonutChart, type DonutDatum } from "@/components/charts/DonutChart";
import { CategoryGlyph } from "@/components/category-glyph";
import { formatCents, cn } from "@/lib/utils";

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
  consumption,
  saved,
  income,
  incomeIsExpected = false,
  isCurrentMonth = true,
  dayOfMonth = 1,
  daysInMonth = 30,
  incomeReceived = 0,
  upcoming = [],
  prevMonthHref,
}: {
  slices: SpendingSlice[];
  consumption: number;
  saved: number;
  income: number;
  // Current month before payday: `income` is the expected monthly figure, not
  // what's landed yet. Label it so the flow bar reads as a forecast.
  incomeIsExpected?: boolean;
  isCurrentMonth?: boolean;
  dayOfMonth?: number;
  daysInMonth?: number;
  incomeReceived?: number;
  // Feeds the fresh-month empty state so the hero is useful before any
  // spending lands.
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
  const activePct =
    active && consumption > 0
      ? Math.round((active.value / consumption) * 100)
      : 0;
  // "What's left" = income not yet committed this month. Money moved to savings
  // is already allocated, so it counts against income alongside consumption — a
  // dollar saved is not a dollar still free to spend.
  //
  // When `remaining` goes negative there are two very different causes, and
  // conflating them reads as a false alarm:
  //   - consumption alone tops income  => genuine overspending (red).
  //   - savings pushed it over         => you invested out of existing cash,
  //     which is not a problem (neutral). Say so plainly instead.
  const committed = consumption + saved;
  const remaining = income - committed;
  const overspent = consumption > income;
  const fromReserves = remaining < 0 && !overspent;

  // Scale the flow bar to whichever is larger, income or what was committed, so
  // savings that exceed income actually *look* like they exceed it rather than
  // silently clamping to a full-looking bar. When committed tops income we mark
  // where income ran out; everything past the tick came from reserves.
  const scaleBase = Math.max(income, committed);
  const consumptionShare = scaleBase > 0 ? consumption / scaleBase : 0;
  const savedShare = scaleBase > 0 ? saved / scaleBase : 0;
  const incomeMarker =
    scaleBase > 0 && committed > income ? income / scaleBase : null;
  const spentPct = income > 0 ? Math.round((consumption / income) * 100) : null;

  return (
    <section className="rise overflow-hidden rounded-[28px] border border-border bg-surface/85 p-6 backdrop-blur-sm shadow-[0_30px_70px_-40px_rgba(34,28,74,0.45)] md:p-8">
      {consumption <= 0 ? (
        !isCurrentMonth ? (
          <div className="py-16 text-center text-sm text-foreground-faint">
            No spending recorded this month.
          </div>
        ) : (
          // Fresh-month state: nothing spent yet, so show what the month
          // holds instead of a big empty box.
          <div className="mx-auto max-w-md py-10 text-center md:py-14">
            <div className="mb-2 text-[11px] uppercase tracking-[0.28em] text-foreground-faint">
              Fresh month
            </div>
            <div className="display text-2xl md:text-3xl">
              Nothing spent yet.
            </div>
            {income > 0 && (
              <p className="mt-3 text-sm text-foreground-muted">
                <span className="mono tabular">{formatCents(incomeReceived)}</span>{" "}
                of{" "}
                <span className="mono tabular">{formatCents(income)}</span>{" "}
                expected income has landed.
              </p>
            )}
            {upcoming.length > 0 && (
              <div className="mt-6 space-y-2 text-left">
                <div className="text-[10px] uppercase tracking-[0.22em] text-foreground-faint text-center">
                  Coming up
                </div>
                {upcoming.slice(0, 3).map((b, i) => (
                  <div
                    key={`${b.merchant}-${i}`}
                    className="flex items-baseline justify-between gap-3 rounded-xl bg-surface-2/50 px-4 py-2.5 text-sm"
                  >
                    <span className="truncate tracking-tight">{b.merchant}</span>
                    <span className="shrink-0 text-[11px] text-foreground-faint">
                      {new Date(b.date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span className="mono tabular shrink-0">
                      {formatCents(b.amountCents)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {prevMonthHref && (
              <Link
                href={prevMonthHref}
                className="mt-6 inline-block text-xs tracking-tight text-foreground-muted underline-offset-4 hover:text-foreground hover:underline"
              >
                See how last month ended →
              </Link>
            )}
          </div>
        )
      ) : (
        <>
          <div className="flex flex-col items-center gap-6 md:flex-row md:items-center md:gap-14 lg:gap-20">
            {/* LEFT — interactive donut */}
            <div
              className="relative shrink-0"
              style={{ width: 420, height: 420 }}
              onMouseLeave={() => setActive(null)}
            >
              <DonutChart
                data={donutData}
                size={420}
                thickness={60}
                formatValue={formatCents}
                showTooltip={false}
                onActiveChange={setActive}
                onSliceClick={(d) => d.href && router.push(d.href)}
              />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-16 text-center">
                {active ? (
                  <>
                    <span
                      className="mb-1 max-w-full truncate text-[11px] font-semibold uppercase tracking-[0.2em]"
                      style={{ color: active.color }}
                    >
                      {active.name}
                    </span>
                    <span className="display text-[2.4rem] leading-none">
                      {formatCents(active.value)}
                    </span>
                    <span className="mt-1.5 text-[12px] text-foreground-faint">
                      {activePct}%
                    </span>
                  </>
                ) : (
                  <>
                    <span className="mb-0.5 text-[11px] uppercase tracking-[0.28em] text-foreground-faint">
                      spent
                    </span>
                    <span className="display text-[2.6rem] leading-none">
                      {formatCents(consumption)}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* RIGHT — numbers */}
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-6">
              {/* Primary — total spent */}
              <div>
                <div
                  className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em]"
                  style={{ color: "var(--blush-deep)" }}
                >
                  Total spent
                </div>
                <div className="display text-[3.4rem] leading-none text-foreground md:text-[4rem]">
                  {formatCents(consumption)}
                </div>
              </div>

              {/* Flow bar — spent vs. saved vs. what's left, against income */}
              {income > 0 && (
                <div className="space-y-2.5">
                  <div className="relative">
                    <div
                      className="flex h-2.5 w-full overflow-hidden rounded-full"
                      style={{ background: "var(--surface-2)" }}
                    >
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${consumptionShare * 100}%`,
                          background: overspent
                            ? "var(--blush-deep)"
                            : "var(--blush)",
                        }}
                      />
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${savedShare * 100}%`,
                          background: "var(--blue)",
                        }}
                      />
                    </div>
                    {/* Where income ran out — anything past this came from reserves */}
                    {incomeMarker !== null && (
                      <div
                        title="income"
                        className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full"
                        style={{
                          left: `${incomeMarker * 100}%`,
                          background: "var(--foreground)",
                        }}
                      />
                    )}
                  </div>

                  {/* Segment labels — the spent share sits on the red segment it
                      describes, and the income tick is named, so the "44%" and
                      the picture share one reference point instead of two. */}
                  <div className="relative h-3 text-[10px] font-medium tracking-tight">
                    <span
                      className="absolute left-0 top-0 whitespace-nowrap"
                      style={{ color: "var(--blush-deep)" }}
                    >
                      {spentPct}% spent
                    </span>
                    {incomeMarker !== null && (
                      <span
                        className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-foreground-faint"
                        style={{
                          left: `${Math.min(96, Math.max(8, incomeMarker * 100))}%`,
                        }}
                      >
                        income
                      </span>
                    )}
                  </div>

                  <div className="text-[14px] text-foreground-muted">
                    <span
                      className="display text-[1.05rem]"
                      style={{
                        color: overspent
                          ? "var(--blush-deep)"
                          : "var(--blue-deep)",
                      }}
                    >
                      {formatCents(Math.abs(remaining))}
                    </span>{" "}
                    {remaining >= 0
                      ? isCurrentMonth
                        ? "left to spend"
                        : "left unspent"
                      : overspent
                        ? isCurrentMonth
                          ? "over income"
                          : "spent over income"
                        : "drawn from reserves"}
                  </div>

                  {/* Pace — calendar burned vs income spent, live month only */}
                  {isCurrentMonth && spentPct !== null && (
                    <PaceLine
                      spentPct={spentPct}
                      calendarPct={Math.round((dayOfMonth / daysInMonth) * 100)}
                      dayOfMonth={dayOfMonth}
                      daysInMonth={daysInMonth}
                    />
                  )}
                </div>
              )}

              {/* Secondary: saved + income */}
              <div className="flex gap-10">
                <MiniStat
                  label="Saved"
                  value={formatCents(saved)}
                  accent="var(--blue-deep)"
                />
                <MiniStat
                  label={incomeIsExpected ? "Income (expected)" : "Income"}
                  value={formatCents(income)}
                  accent="var(--sage-deep)"
                />
              </div>
            </div>
          </div>

          {/* Legend — icon chips below the main layout */}
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
                    key={s.id}
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

// One honest sentence about pace: percent of income spent vs percent of the
// month gone. Within 5 points either way reads as "on pace" — day-to-day
// noise shouldn't flip the verdict.
function PaceLine({
  spentPct,
  calendarPct,
  dayOfMonth,
  daysInMonth,
}: {
  spentPct: number;
  calendarPct: number;
  dayOfMonth: number;
  daysInMonth: number;
}) {
  const delta = spentPct - calendarPct;
  const verdict =
    delta > 5 ? "running hot" : delta < -5 ? "ahead of the game" : "on pace";
  const color =
    delta > 5
      ? "var(--blush-deep)"
      : delta < -5
        ? "var(--blue-deep)"
        : "var(--foreground-muted)";
  return (
    <div className="text-[11px] tracking-tight text-foreground-faint">
      Day {dayOfMonth} of {daysInMonth} — {calendarPct}% of the month gone,{" "}
      {spentPct}% of income spent.{" "}
      <span className="font-medium" style={{ color }}>
        You&apos;re {verdict}.
      </span>
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div>
      <div
        className="mb-1 text-[9px] font-semibold uppercase tracking-[0.2em]"
        style={{ color: accent }}
      >
        {label}
      </div>
      <div className={cn("display text-[1.75rem] leading-none text-foreground md:text-[2rem]")}>
        {value}
      </div>
    </div>
  );
}
