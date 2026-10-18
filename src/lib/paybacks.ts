import { differenceInCalendarDays } from "date-fns";

// Paybacks: an incoming payment that pays you back for something you bought.
// Two everyday shapes:
//   - a work expense you front and get reimbursed for in full (a Sweetgreen
//     lunch, then a FieldPulse deposit for the exact same amount), and
//   - a shared cost a friend covers part of ($25 parking, Jaya Zelles $6.25).
// Links live in payback_links; this module is the pure math on top of them.

export type PaybackTx = {
  id: number;
  date: Date;
  amountCents: number;
  merchantRaw: string;
  merchantClean: string | null;
  categoryId: number | null;
  isTransfer: boolean;
  reimbursable: boolean;
};

// FieldPulse reimburses a work meal up to $15.00. A work expense over that is
// only ever paid back to the cap; the rest is your own spending from day one.
export const WORK_EXPENSE_CAP_CENTS = 1500;

// What you can expect back on a charge: the cap for a work expense, the whole
// amount for anything else (a friend can cover any share of a shared cost).
export function expectedBack(t: { amountCents: number; reimbursable: boolean }): number {
  const abs = Math.abs(t.amountCents);
  return t.reimbursable ? Math.min(abs, WORK_EXPENSE_CAP_CENTS) : abs;
}

export type PaybackLinkLike = {
  id?: number;
  paybackId: number;
  chargeId: number;
  amountCents: number;
};

export type PaybackState = {
  // Total linked per charge (positive cents) and per payback.
  linkedToCharge: Map<number, number>;
  linkedFromPayback: Map<number, number>;
  // What's still unsettled on a charge, and what's still unassigned on a
  // payback. Both are positive cents, floored at zero.
  chargeRemaining: (t: PaybackTx) => number;
  paybackRemaining: (t: PaybackTx) => number;
};

export function paybackState(links: readonly PaybackLinkLike[]): PaybackState {
  const linkedToCharge = new Map<number, number>();
  const linkedFromPayback = new Map<number, number>();
  for (const l of links) {
    linkedToCharge.set(l.chargeId, (linkedToCharge.get(l.chargeId) ?? 0) + l.amountCents);
    linkedFromPayback.set(
      l.paybackId,
      (linkedFromPayback.get(l.paybackId) ?? 0) + l.amountCents,
    );
  }
  return {
    linkedToCharge,
    linkedFromPayback,
    chargeRemaining: (t) =>
      t.amountCents >= 0
        ? 0
        : Math.max(0, expectedBack(t) - (linkedToCharge.get(t.id) ?? 0)),
    paybackRemaining: (t) =>
      t.amountCents <= 0
        ? 0
        : Math.max(0, t.amountCents - (linkedFromPayback.get(t.id) ?? 0)),
  };
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const nameOf = (t: PaybackTx) => t.merchantClean || t.merchantRaw;

// Same store on both sides means it's a refund, not someone paying you back.
function sameMerchant(a: PaybackTx, b: PaybackTx): boolean {
  const na = norm(nameOf(a));
  const nb = norm(nameOf(b));
  if (!na || !nb) return false;
  if (na === nb || na.startsWith(nb) || nb.startsWith(na)) return true;
  const ta = na.split(" ")[0];
  return ta.length >= 4 && ta === nb.split(" ")[0];
}

export type MatchKind = "exact" | "share" | "partial";

export type PaybackCandidate = {
  tx: PaybackTx;
  // Amount that would be linked if this candidate is picked.
  amountCents: number;
  kind: MatchKind;
  // For kind "share": the payback is 1/n of the charge.
  shareOf?: number;
  score: number;
};

// Payback window: reimbursements usually land within a couple of months of
// the charge. A payback can also arrive a few days early (a friend Venmos
// before the card posts).
const WINDOW_BEFORE = 75;
const WINDOW_AFTER = 5;

function closeTo(a: number, b: number, tol = 2): boolean {
  return Math.abs(a - b) <= tol;
}

// How a payback amount relates to a charge's unsettled amount.
function classify(
  paybackLeft: number,
  charge: PaybackTx,
  chargeLeft: number,
): { kind: MatchKind; shareOf?: number; base: number } | null {
  if (paybackLeft <= 0 || chargeLeft <= 0) return null;
  if (closeTo(paybackLeft, chargeLeft)) {
    return { kind: "exact", base: charge.reimbursable ? 100 : 70 };
  }
  // Split evenly with friends: 6.25 is a quarter of 25.00.
  const full = Math.abs(charge.amountCents);
  for (let n = 2; n <= 6; n++) {
    if (closeTo(paybackLeft * n, full, n)) {
      return { kind: "share", shareOf: n, base: 80 - n };
    }
  }
  if (paybackLeft < chargeLeft) {
    return { kind: "partial", base: charge.reimbursable ? 40 : 10 };
  }
  return null;
}

// Partial matches ("part of it") are only worth showing when nothing lines up
// exactly or as an even share.
function best(list: PaybackCandidate[], limit: number): PaybackCandidate[] {
  const sorted = list.sort((a, b) => b.score - a.score);
  const strong = sorted.filter((c) => c.kind !== "partial");
  return (strong.length > 0 ? strong : sorted).slice(0, limit);
}

// Charges an incoming payment could be paying back, best first.
export function chargeCandidates(
  payback: PaybackTx,
  txns: readonly PaybackTx[],
  state: PaybackState,
  limit = 8,
): PaybackCandidate[] {
  const left = state.paybackRemaining(payback);
  if (left <= 0) return [];
  const out: PaybackCandidate[] = [];
  for (const c of txns) {
    if (c.amountCents >= 0 || c.isTransfer || c.id === payback.id) continue;
    const days = differenceInCalendarDays(payback.date, c.date);
    if (days > WINDOW_BEFORE || days < -WINDOW_AFTER) continue;
    if (sameMerchant(payback, c)) continue;
    const chargeLeft = state.chargeRemaining(c);
    const m = classify(left, c, chargeLeft);
    if (!m) continue;
    out.push({
      tx: c,
      amountCents: Math.min(left, chargeLeft),
      kind: m.kind,
      shareOf: m.shareOf,
      score: m.base - Math.abs(days) * 0.25,
    });
  }
  return best(out, limit);
}

// Incoming payments that could be paying back a charge, best first.
export function paybackCandidates(
  charge: PaybackTx,
  txns: readonly PaybackTx[],
  state: PaybackState,
  limit = 8,
): PaybackCandidate[] {
  const chargeLeft = state.chargeRemaining(charge);
  if (chargeLeft <= 0) return [];
  const out: PaybackCandidate[] = [];
  for (const p of txns) {
    if (p.amountCents <= 0 || p.id === charge.id) continue;
    const days = differenceInCalendarDays(p.date, charge.date);
    if (days > WINDOW_BEFORE || days < -WINDOW_AFTER) continue;
    if (sameMerchant(p, charge)) continue;
    const left = state.paybackRemaining(p);
    const m = classify(left, charge, chargeLeft);
    if (!m) continue;
    out.push({
      tx: p,
      amountCents: Math.min(left, chargeLeft),
      kind: m.kind,
      shareOf: m.shareOf,
      score: m.base - Math.abs(days) * 0.25,
    });
  }
  return best(out, limit);
}

export type AutoMatch = {
  paybackId: number;
  chargeId: number;
  amountCents: number;
};

// Ramp pays a work lunch within days, often the day after the lunch, which can
// be before the card charge has even posted. So a payment may land a few days
// before the charge's date. It usually lands within a couple of weeks; the
// longer reach is only for an amount nothing nearer explains.
const EARLIEST_LAG = -4;
const USUAL_LAG = 30;
const LONGEST_LAG = 90;

// Work expenses paired with the payments that paid them back. Every possible
// pair (same expected amount, payment from 4 days before to 30 days after the
// charge) is ranked by how close the dates are, and the closest pairs are
// taken first, each payment and charge used once. Closest-first keeps a run
// of identical $14.34 lunches lined up with their own deposits, and leaves a
// charge that was never submitted (a weekend Cava) unpaired instead of letting
// it steal the next deposit. Exact cents beat a cent-off near miss, and a
// same-store refund is never mistaken for a reimbursement. "Amount" is what's
// expected back, so a $15.43 lunch pairs with a $15.00 payment.
export function autoMatches(
  txns: readonly PaybackTx[],
  state: PaybackState,
): AutoMatch[] {
  const owed = new Map<number, number>();
  for (const t of txns) {
    if (t.reimbursable && !t.isTransfer && t.amountCents < 0) {
      const left = state.chargeRemaining(t);
      if (left > 2) owed.set(t.id, left);
    }
  }
  const charges = txns.filter((t) => owed.has(t.id));
  const inflows = txns.filter((t) => t.amountCents > 0 && state.paybackRemaining(t) > 0);
  const usedPayback = new Set<number>();
  const matches: AutoMatch[] = [];

  const pass = (maxLag: number, fits: (paid: number, owedCents: number) => boolean) => {
    const pairs: { p: PaybackTx; c: PaybackTx; gap: number }[] = [];
    for (const p of inflows) {
      if (usedPayback.has(p.id)) continue;
      const paid = state.paybackRemaining(p);
      for (const c of charges) {
        const left = owed.get(c.id);
        if (left == null || !fits(paid, left)) continue;
        const lag = differenceInCalendarDays(p.date, c.date);
        if (lag < EARLIEST_LAG || lag > maxLag) continue;
        if (sameMerchant(p, c)) continue;
        pairs.push({ p, c, gap: Math.abs(lag) });
      }
    }
    pairs.sort(
      (a, b) =>
        a.gap - b.gap ||
        a.c.date.getTime() - b.c.date.getTime() ||
        a.p.date.getTime() - b.p.date.getTime() ||
        a.p.id - b.p.id,
    );
    for (const { p, c } of pairs) {
      const left = owed.get(c.id);
      if (left == null || usedPayback.has(p.id)) continue;
      usedPayback.add(p.id);
      owed.delete(c.id);
      matches.push({
        paybackId: p.id,
        chargeId: c.id,
        amountCents: Math.min(state.paybackRemaining(p), left),
      });
    }
  };
  const exact = (paid: number, left: number) => paid === left;
  const near = (paid: number, left: number) => closeTo(paid, left);
  pass(USUAL_LAG, exact);
  pass(LONGEST_LAG, exact);
  pass(USUAL_LAG, near);
  pass(LONGEST_LAG, near);
  return matches;
}

// Paid back to within a couple of cents (a $14.60 payment on a $14.61 lunch).
function isSettled(t: PaybackTx, state: PaybackState): boolean {
  return state.chargeRemaining(t) <= 2;
}

export function describeMatch(c: Pick<PaybackCandidate, "kind" | "shareOf">): string {
  if (c.kind === "exact") return "exact amount";
  if (c.kind === "share") return `1/${c.shareOf} of it`;
  return "part of it";
}

export type OwedSummary = {
  // Work expenses with money still owed, oldest first.
  waiting: { tx: PaybackTx; remaining: number }[];
  owedCents: number;
};

// Everything outstanding across all time (capped to the last ~6 months so a
// forgotten lunch from last year doesn't nag forever).
export function owedSummary(
  txns: readonly PaybackTx[],
  state: PaybackState,
  now = new Date(),
): OwedSummary {
  const since = now.getTime() - 183 * 86_400_000;
  const waiting = txns
    .filter(
      (t) =>
        t.reimbursable &&
        !t.isTransfer &&
        t.amountCents < 0 &&
        t.date.getTime() >= since &&
        !isSettled(t, state),
    )
    .map((tx) => ({ tx, remaining: state.chargeRemaining(tx) }))
    .sort((a, b) => a.tx.date.getTime() - b.tx.date.getTime());
  return {
    waiting,
    owedCents: waiting.reduce((s, w) => s + w.remaining, 0),
  };
}
