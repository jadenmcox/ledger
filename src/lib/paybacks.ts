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
        : Math.max(0, Math.abs(t.amountCents) - (linkedToCharge.get(t.id) ?? 0)),
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

// Confident one-to-one matches for reimbursable work expenses: an incoming
// payment for the exact unsettled amount, landing on or after the charge.
// Charges are settled oldest first and each payment is used at most once, so
// two $14.34 lunches pair with two $14.34 deposits in date order.
export function autoMatches(
  txns: readonly PaybackTx[],
  state: PaybackState,
): AutoMatch[] {
  const charges = txns
    .filter((t) => t.reimbursable && t.amountCents < 0 && state.chargeRemaining(t) > 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const inflows = txns
    .filter((t) => t.amountCents > 0 && state.paybackRemaining(t) > 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const used = new Set<number>();
  const matches: AutoMatch[] = [];
  for (const c of charges) {
    const owed = state.chargeRemaining(c);
    const hit = inflows.find((p) => {
      if (used.has(p.id)) return false;
      const days = differenceInCalendarDays(p.date, c.date);
      if (days < 0 || days > WINDOW_BEFORE) return false;
      if (sameMerchant(p, c)) return false;
      return closeTo(state.paybackRemaining(p), owed);
    });
    if (!hit) continue;
    used.add(hit.id);
    matches.push({ paybackId: hit.id, chargeId: c.id, amountCents: owed });
  }
  return matches;
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
  // Confident exact-amount matches ready to settle in one tap.
  readyToMatch: AutoMatch[];
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
        state.chargeRemaining(t) > 0,
    )
    .map((tx) => ({ tx, remaining: state.chargeRemaining(tx) }))
    .sort((a, b) => a.tx.date.getTime() - b.tx.date.getTime());
  return {
    waiting,
    owedCents: waiting.reduce((s, w) => s + w.remaining, 0),
    readyToMatch: autoMatches(txns, state),
  };
}
