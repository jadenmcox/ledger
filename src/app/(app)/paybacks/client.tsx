"use client";

import { confirmDialog } from "@/components/confirm";
import { useState, useTransition } from "react";
import { differenceInCalendarDays, format } from "date-fns";
import { ArrowDown, Check, ChevronRight, HandCoins } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { StatStrip } from "@/components/stat-strip";
import { PaybackPicker, type PickerTx } from "@/components/payback-picker";
import { formatCents, cn } from "@/lib/utils";
import { expectedBack, WORK_EXPENSE_CAP_CENTS, type PaybackLinkLike } from "@/lib/paybacks";
import {
  linkPayback,
  matchAllPaybacks,
  recoverDepositsAndRematch,
  redoWorkMatches,
  unlinkPayback,
} from "./actions";

export type PaybackView = PickerTx;

const nameOf = (t: PaybackView) => t.merchantClean || t.merchantRaw;

export function PaybacksClient({
  owedCents,
  backLast90,
  waiting,
  ready,
  settled,
  loose,
  pool,
  links,
  hasWorkMatches,
}: {
  hasWorkMatches: boolean;
  owedCents: number;
  backLast90: number;
  waiting: { tx: PaybackView; remaining: number }[];
  ready: { charge: PaybackView; payback: PaybackView; amountCents: number }[];
  settled: {
    charge: PaybackView;
    paybacks: { linkId: number; payback: PaybackView; amountCents: number }[];
  }[];
  loose: PaybackView[];
  pool: PaybackView[];
  links: (PaybackLinkLike & { id: number })[];
}) {
  const [pending, startTransition] = useTransition();
  const [picking, setPicking] = useState<PaybackView | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const today = new Date();

  const matchAll = () =>
    startTransition(async () => {
      const r = await matchAllPaybacks();
      setFlash(r.ok ? `Matched ${r.matched}.` : r.error);
    });
  const redo = async () => {
    const ok = await confirmDialog({
      title: "Redo every work expense match?",
      body: "Pairings are cleared and made again, closest dates first. Paybacks from friends that you linked by hand stay as they are.",
      confirmLabel: "Redo matches",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await redoWorkMatches();
      setFlash(
        r.ok
          ? `Redid the matches: ${r.matched} work ${r.matched === 1 ? "expense" : "expenses"} paired with a payment.`
          : r.error,
      );
    });
  };
  const recover = () =>
    startTransition(async () => {
      const r = await recoverDepositsAndRematch();
      if (!r.ok) {
        setFlash(r.error);
        return;
      }
      setFlash(
        (r.restored === 0
          ? "Checked your banks: no missing deposits. "
          : `Found ${r.restored} ${r.restored === 1 ? "deposit" : "deposits"} the bank sync had dropped. `) +
          `Redid the matches: ${r.matched} work ${r.matched === 1 ? "expense" : "expenses"} paired.` +
          (r.errors.length ? ` Couldn't check: ${r.errors.join("; ")}` : ""),
      );
    });
  const OVERDUE_DAYS = 30;
  const overdue = waiting.filter((w) => differenceInCalendarDays(today, w.tx.date) > OVERDUE_DAYS);
  const recent = waiting.filter((w) => differenceInCalendarDays(today, w.tx.date) <= OVERDUE_DAYS);
  const matchOne = (paybackId: number, chargeId: number) =>
    startTransition(async () => {
      const r = await linkPayback(paybackId, chargeId);
      if (!r.ok) setFlash(r.error);
    });

  const nothing = waiting.length === 0 && ready.length === 0 && settled.length === 0 && loose.length === 0;

  return (
    <div className="space-y-9">
      <StatStrip
        items={[
          {
            label: "Owed to you",
            value: formatCents(owedCents),
            accent: "var(--blue-deep)",
            dominant: true,
            hint:
              waiting.length > 0
                ? `${waiting.length} ${waiting.length === 1 ? "charge" : "charges"} waiting`
                : "all caught up",
          },
          {
            label: "Paid back, last 90 days",
            value: formatCents(backLast90),
            accent: "var(--sage-deep)",
          },
        ]}
      />

      {hasWorkMatches && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-dashed border-border px-4 py-3">
          <span className="text-[12px] text-foreground-muted">
            Pairings look off? Redo them all, closest dates first.
          </span>
          <Button size="sm" variant="outline" onClick={redo} disabled={pending}>
            {pending ? "Working…" : "Redo matches"}
          </Button>
        </div>
      )}

      {flash && (
        <div className="rounded-xl bg-surface px-4 py-3 text-sm text-foreground-muted">{flash}</div>
      )}

      {nothing && (
        <Card className="p-6 md:p-8">
          <div className="flex items-start gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-tint text-blue-deep">
              <HandCoins className="size-5" strokeWidth={1.75} />
            </span>
            <div className="space-y-2 text-sm text-foreground-muted">
              <p className="font-medium text-foreground">Nothing to track yet.</p>
              <p>
                Work lunch you&apos;ll expense? Open it in Transactions and choose{" "}
                <span className="font-medium text-foreground">Work expense</span>. It stops counting as
                spending and shows up here until the money comes back.
              </p>
              <p>
                A friend paid you back for part of something? Open their payment and choose{" "}
                <span className="font-medium text-foreground">This paid me back</span>.
              </p>
            </div>
          </div>
        </Card>
      )}

      {ready.length > 0 && (
        <section>
          <SectionTitle
            title="Found the money"
            hint="payments that exactly match a work expense"
            right={
              <Button size="sm" variant="primary" onClick={matchAll} disabled={pending}>
                <Check className="size-3.5" strokeWidth={2.5} />
                Match all {ready.length}
              </Button>
            }
          />
          <Card className="divide-y divide-border overflow-hidden">
            {ready.map((r) => (
              <div key={`${r.charge.id}-${r.payback.id}`} className="flex items-center gap-3 px-4 py-3.5 md:px-5">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <TxLine tx={r.charge} />
                  <div className="flex items-center gap-1.5 pl-0.5 text-[11px] text-blue-deep">
                    <ArrowDown className="size-3" strokeWidth={2} /> paid back by
                  </div>
                  <TxLine tx={r.payback} />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => matchOne(r.payback.id, r.charge.id)}
                >
                  Match
                </Button>
              </div>
            ))}
          </Card>
        </section>
      )}

      {overdue.length > 0 && (
        <section>
          <SectionTitle
            title="Overdue"
            hint={`no payment after ${OVERDUE_DAYS}+ days, ${formatCents(overdue.reduce((t, w) => t + w.remaining, 0))} total. Ramp says paid? Check the bank for deposits that didn't come through.`}
            right={
              <Button size="sm" variant="outline" onClick={recover} disabled={pending}>
                {pending ? "Checking…" : "Check the bank"}
              </Button>
            }
          />
          <WaitingList rows={overdue} today={today} onPick={setPicking} />
        </section>
      )}

      {recent.length > 0 && (
        <section>
          <SectionTitle
            title="Waiting"
            hint="from the last month. These usually come back within a few weeks."
          />
          <WaitingList rows={recent} today={today} onPick={setPicking} />
        </section>
      )}

      {loose.length > 0 && (
        <section>
          <SectionTitle
            title="Paybacks not tied to a charge"
            hint="marked as reimbursements. Tap to say what they paid back."
          />
          <Card className="divide-y divide-border overflow-hidden">
            {loose.map((tx) => (
              <button
                key={tx.id}
                onClick={() => setPicking(tx)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2/50 md:px-5"
              >
                <TxLine tx={tx} />
                <ChevronRight className="size-4 shrink-0 text-foreground-faint" strokeWidth={2} />
              </button>
            ))}
          </Card>
        </section>
      )}

      {settled.length > 0 && (
        <section>
          <SectionTitle title="Paid back" hint="last four months" />
          <Card className="divide-y divide-border overflow-hidden">
            {settled.map(({ charge, paybacks }) => {
              const back = paybacks.reduce((s, p) => s + p.amountCents, 0);
              const full = Math.abs(charge.amountCents);
              const yourShare = charge.reimbursable ? 0 : Math.max(0, full - back);
              return (
                <div key={charge.id} className="px-4 py-3.5 md:px-5">
                  <TxLine tx={charge} />
                  <div className="mt-2 space-y-1.5 border-l-2 border-blue/40 pl-3">
                    {paybacks.map((p) => (
                      <div key={p.linkId} className="flex items-center gap-2 text-[12px]">
                        <span className="min-w-0 flex-1 truncate text-foreground-muted">
                          {nameOf(p.payback)} · {format(p.payback.date, "MMM d")}
                        </span>
                        <span className="mono tabular text-blue-deep">+{formatCents(p.amountCents)}</span>
                        <button
                          disabled={pending}
                          onClick={() => startTransition(() => unlinkPayback(p.linkId))}
                          className="rounded-full px-2 py-0.5 text-[11px] text-foreground-faint hover:bg-surface-2 hover:text-foreground"
                        >
                          undo
                        </button>
                      </div>
                    ))}
                    <div className="text-[11px] text-foreground-faint">
                      {!charge.reimbursable
                        ? `Your share: ${formatCents(yourShare)}. That's what counts as spending.`
                        : back < expectedBack(charge) - 2
                          ? `${formatCents(expectedBack(charge) - back)} still owed.`
                          : full > expectedBack(charge)
                            ? `Paid back the ${formatCents(WORK_EXPENSE_CAP_CENTS)} cap. The other ${formatCents(full - expectedBack(charge))} counts as your spending.`
                            : "Fully paid back."}
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>
        </section>
      )}

      {picking && (
        <PaybackPicker
          base={picking}
          pool={pool}
          links={links}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}

function WaitingList({
  rows,
  today,
  onPick,
}: {
  rows: { tx: PaybackView; remaining: number }[];
  today: Date;
  onPick: (tx: PaybackView) => void;
}) {
  return (
    <Card className="divide-y divide-border overflow-hidden">
      {rows.map(({ tx, remaining }) => {
        const days = differenceInCalendarDays(today, tx.date);
        return (
          <button
            key={tx.id}
            onClick={() => onPick(tx)}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2/50 md:px-5"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm tracking-tight">{nameOf(tx)}</div>
              <div className="mt-0.5 text-[11px] text-foreground-faint">
                {format(tx.date, "MMM d")} ·{" "}
                {days === 0 ? "today" : `${days} ${days === 1 ? "day" : "days"} ago`}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="mono tabular text-sm">{formatCents(remaining)}</div>
              {remaining !== Math.abs(tx.amountCents) && (
                <div className="text-[10px] text-foreground-faint">
                  of {formatCents(Math.abs(tx.amountCents))}
                </div>
              )}
            </div>
            <ChevronRight className="size-4 shrink-0 text-foreground-faint" strokeWidth={2} />
          </button>
        );
      })}
    </Card>
  );
}

function SectionTitle({
  title,
  hint,
  right,
}: {
  title: string;
  hint?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-3.5 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="display text-lg tracking-tight md:text-xl">{title}</h2>
        {hint && <p className="mt-0.5 text-[12px] text-foreground-faint">{hint}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

function TxLine({ tx }: { tx: PaybackView }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm tracking-tight">{nameOf(tx)}</div>
        <div className="text-[11px] text-foreground-faint">
          {format(tx.date, "EEE, MMM d")}
          {tx.accountName ? ` · ${tx.accountName}` : ""}
        </div>
      </div>
      <span
        className={cn("mono tabular shrink-0 text-sm", tx.amountCents > 0 && "text-blue-deep")}
      >
        {formatCents(tx.amountCents, { signed: tx.amountCents > 0 })}
      </span>
    </div>
  );
}
