"use client";

import { useMemo, useState, useTransition } from "react";
import { differenceInCalendarDays, format } from "date-fns";
import { Search, X } from "lucide-react";
import { Sheet } from "@/components/sheet";
import { Label } from "@/components/ui";
import { formatCents, cn } from "@/lib/utils";
import {
  chargeCandidates,
  describeMatch,
  paybackCandidates,
  paybackState,
  type PaybackLinkLike,
  type PaybackTx,
} from "@/lib/paybacks";
import { linkPayback, unlinkPayback } from "@/app/(app)/paybacks/actions";
import { setReimbursable } from "@/app/(app)/transactions/actions";

export type PickerTx = PaybackTx & { accountName?: string | null };

const nameOf = (t: PaybackTx) => t.merchantClean || t.merchantRaw;

// Link a payment to the charge it pays back, from either side. Opened on an
// incoming payment it asks "what did this pay back?"; opened on a charge it
// asks "who paid you back?". Best guesses first (exact amount, an even share
// like 1/4 of $25), then everything nearby to search.
export function PaybackPicker({
  base,
  pool,
  links,
  onClose,
}: {
  base: PickerTx;
  pool: PickerTx[];
  links: (PaybackLinkLike & { id: number })[];
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isPayback = base.amountCents > 0;
  const state = useMemo(() => paybackState(links), [links]);
  const byId = useMemo(() => new Map(pool.map((t) => [t.id, t])), [pool]);

  const suggestions = useMemo(
    () =>
      isPayback
        ? chargeCandidates(base, pool, state, 5)
        : paybackCandidates(base, pool, state, 5),
    [base, pool, state, isPayback],
  );
  const suggestedIds = new Set(suggestions.map((s) => s.tx.id));

  // Everything else on the other side within ~2.5 months, for searching.
  const others = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pool
      .filter((t) => {
        if (t.id === base.id || suggestedIds.has(t.id)) return false;
        if (isPayback ? t.amountCents >= 0 : t.amountCents <= 0) return false;
        const left = isPayback ? state.chargeRemaining(t) : state.paybackRemaining(t);
        if (left <= 0) return false;
        const days = Math.abs(differenceInCalendarDays(base.date, t.date));
        if (days > 75) return false;
        if (q && !`${t.merchantClean ?? ""} ${t.merchantRaw}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort(
        (a, b) =>
          Math.abs(differenceInCalendarDays(base.date, a.date)) -
          Math.abs(differenceInCalendarDays(base.date, b.date)),
      )
      .slice(0, 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, base, query, state, isPayback, suggestions]);

  const existing = links.filter((l) =>
    isPayback ? l.paybackId === base.id : l.chargeId === base.id,
  );
  const baseLeft = isPayback ? state.paybackRemaining(base) : state.chargeRemaining(base);

  const pick = (other: PaybackTx) => {
    setError(null);
    const paybackId = isPayback ? base.id : other.id;
    const chargeId = isPayback ? other.id : base.id;
    startTransition(async () => {
      const r = await linkPayback(paybackId, chargeId);
      if (!r.ok) setError(r.error);
      else onClose();
    });
  };

  const row = (t: PickerTx, hint?: string, linkAmount?: number) => (
    <button
      key={t.id}
      disabled={pending}
      onClick={() => pick(t)}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-surface-2 disabled:opacity-50"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm tracking-tight">{nameOf(t)}</div>
        <div className="mt-0.5 text-[11px] text-foreground-faint">
          {format(t.date, "EEE, MMM d")}
          {t.accountName ? ` · ${t.accountName}` : ""}
          {hint && <span className="text-blue-deep"> · {hint}</span>}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="mono tabular text-sm">
          {formatCents(t.amountCents, { signed: t.amountCents > 0 })}
        </div>
        {linkAmount != null && linkAmount !== Math.abs(t.amountCents) && (
          <div className="text-[10px] text-foreground-faint">links {formatCents(linkAmount)}</div>
        )}
      </div>
    </button>
  );

  return (
    <Sheet open onClose={onClose}>
      <Label>{isPayback ? "Paid me back" : "Got paid back"}</Label>
      <div className="mb-1 mt-1 flex items-baseline justify-between gap-3">
        <h3 className="display truncate text-xl">{nameOf(base)}</h3>
        <span className="mono tabular shrink-0 text-sm">
          {formatCents(base.amountCents, { signed: isPayback })}
        </span>
      </div>
      <p className="mb-4 text-[12px] text-foreground-muted">
        {isPayback
          ? "Pick the charge this money paid you back for. It won't count as income, and it comes off that charge's category."
          : "Pick the payment that paid you back. It won't count as income, and this charge only counts for your share."}
      </p>

      {existing.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {existing.map((l) => {
            const other = byId.get(isPayback ? l.chargeId : l.paybackId);
            return (
              <div
                key={l.id}
                className="flex items-center gap-3 rounded-xl bg-blue-tint/50 px-3 py-2.5 text-sm"
              >
                <div className="min-w-0 flex-1 truncate">
                  {isPayback ? "Pays back " : "Paid back by "}
                  <span className="font-medium">{other ? nameOf(other) : "a transaction"}</span>
                </div>
                <span className="mono tabular shrink-0">{formatCents(l.amountCents)}</span>
                <button
                  onClick={() => startTransition(() => unlinkPayback(l.id))}
                  aria-label="Remove link"
                  className="grid size-7 shrink-0 place-items-center rounded-full text-foreground-faint hover:bg-surface hover:text-foreground"
                >
                  <X className="size-3.5" strokeWidth={2} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {baseLeft <= 0 ? (
        <p className="rounded-xl bg-surface-2 px-3 py-3 text-sm text-foreground-muted">
          {isPayback ? "All of this payment is linked." : "This charge is fully paid back."}
        </p>
      ) : (
        <>
          {suggestions.length > 0 && (
            <div className="mb-3">
              <div className="mb-1 px-1 text-[10px] font-bold uppercase tracking-[0.08em] text-foreground-muted">
                Best guesses
              </div>
              {suggestions.map((s) => row(s.tx as PickerTx, describeMatch(s), s.amountCents))}
            </div>
          )}
          <div className="sticky top-0 z-10 -mx-1 mb-1 flex items-center gap-2 rounded-xl border border-border bg-surface px-3">
            <Search className="size-4 shrink-0 text-foreground-faint" strokeWidth={1.75} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isPayback ? "Search charges" : "Search incoming payments"}
              className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-foreground-faint"
            />
          </div>
          <div className={cn("max-h-[40vh] overflow-y-auto", pending && "opacity-60")}>
            {others.length === 0 ? (
              <p className="px-3 py-4 text-sm text-foreground-faint">Nothing nearby matches.</p>
            ) : (
              others.map((t) => row(t))
            )}
          </div>
        </>
      )}
      {error && <p className="mt-3 text-xs text-blush-deep">{error}</p>}
      {!isPayback && base.reimbursable && (
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await setReimbursable(base.id, false);
              onClose();
            })
          }
          className="mt-4 w-full rounded-xl border border-border px-3 py-2.5 text-sm text-foreground-muted transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          It won&apos;t be paid back. Count it as normal spending.
        </button>
      )}
    </Sheet>
  );
}
