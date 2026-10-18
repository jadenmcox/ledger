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

// Ramp pays a work lunch a few days after it, and the card charge posts a day
// or two after the lunch. So a payment almost always lands on or after the
// charge's date; a day or so before can happen (a lunch on Friday, paid and
// posted on Monday). Since August every payment landed within two weeks of its
// charge, so matching stays inside three weeks. That keeps a deposit that
// never reached the bank feed from shuffling every later pairing: the
// shortfall stays where it happened instead of sliding onto the newest lunch.
// Only what's left over gets the longer reach (the odd lunch paid two months
// late).
const EARLIEST_LAG = -3;
const USUAL_LAG = 21;
const LONGEST_LAG = 90;

// What a (charge, payment) pairing costs: days between them, with landing
// early made expensive so a payment never jumps ahead to a lunch charged after
// it while an older lunch still waits, and very late payments made pricier.
function pairCost(lag: number, maxLag = LONGEST_LAG): number {
  if (lag < EARLIEST_LAG || lag > maxLag) return Infinity;
  if (lag < 0) return 20 + 10 * -lag;
  return lag <= 30 ? lag : 30 + (lag - 30) * 2;
}

// Minimum-cost assignment (Hungarian method) on a square matrix. Returns, for
// each row, the column it's assigned to.
function hungarian(cost: number[][]): number[] {
  const n = cost.length;
  const u = new Array(n + 1).fill(0);
  const v = new Array(n + 1).fill(0);
  const p = new Array(n + 1).fill(0);
  const way = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(n + 1).fill(Infinity);
    const used = new Array(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  const rowToCol = new Array(n).fill(-1);
  for (let j = 1; j <= n; j++) if (p[j]) rowToCol[p[j] - 1] = j - 1;
  return rowToCol;
}

// Pairs work expenses with the payments that paid them back. For each amount
// (what's expected back, so a $15.43 lunch looks for $15.00), it finds the
// assignment that pays back as many lunches as possible, pays the oldest
// lunches first, and keeps each payment closest after its own lunch. Solving it as a whole,
// rather than grabbing the nearest pair first, means a run of identical
// $14.34 lunches lines up with its deposits, a lunch still awaiting approval
// is the one left waiting, and a lunch that was never submitted doesn't steal
// a deposit. A same-store refund is never mistaken for a reimbursement, and a
// cent-off near miss only fills what exact amounts couldn't.
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

  // Among the last three weeks of lunches, leaving one unpaired costs more the
  // older it is. Ramp pays lunches in the order they were submitted, so when
  // there are fewer payments than recent lunches the ones left waiting should
  // be the newest (still awaiting approval), not an older lunch that a
  // closer-dated payment skipped over. The age weight (3 per day) outweighs a
  // day of payment lag (1), which is what makes "pay the oldest first" win
  // over "pay the nearest" there.
  //
  // Past three weeks every lunch costs the same to leave unpaired, so the
  // nearest pairing wins. A deposit that never reached the bank feed back in
  // May then leaves a May lunch unpaired, instead of every later deposit
  // shifting one lunch older until the gap surfaces on a lunch from last
  // month that Ramp has long since paid.
  const UNPAID = 1000;
  const AGE_WEIGHT = 3;
  const latest = Math.max(...txns.map((t) => t.date.getTime()));
  const unpaidCost = (c: PaybackTx) =>
    UNPAID +
    AGE_WEIGHT * Math.min(USUAL_LAG, differenceInCalendarDays(new Date(latest), c.date));

  const solve = (cs: PaybackTx[], ps: PaybackTx[], maxLag: number) => {
    if (cs.length === 0 || ps.length === 0) return;
    const n = cs.length + ps.length;
    const cost: number[][] = [];
    for (let i = 0; i < n; i++) {
      const row = new Array(n).fill(0);
      for (let j = 0; j < n; j++) {
        if (i < cs.length && j < ps.length) {
          const c = cs[i];
          const p = ps[j];
          const pc = sameMerchant(p, c)
            ? Infinity
            : pairCost(differenceInCalendarDays(p.date, c.date), maxLag);
          row[j] = Number.isFinite(pc) ? pc : 1e9;
        } else if (i < cs.length) {
          row[j] = unpaidCost(cs[i]); // charge stays unpaired
        } else {
          row[j] = 0; // a payment that isn't for any of these lunches
        }
      }
      cost.push(row);
    }
    const assign = hungarian(cost);
    for (let i = 0; i < cs.length; i++) {
      const j = assign[i];
      if (j < 0 || j >= ps.length || cost[i][j] >= 1e9) continue;
      const c = cs[i];
      const p = ps[j];
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

  // Exact amounts, one amount at a time: within three weeks first, then the
  // longer reach for whatever is still unpaired.
  for (const maxLag of [USUAL_LAG, LONGEST_LAG]) {
    const byAmount = new Map<number, PaybackTx[]>();
    for (const c of charges) {
      const k = owed.get(c.id);
      if (k == null) continue;
      const arr = byAmount.get(k) ?? [];
      arr.push(c);
      byAmount.set(k, arr);
    }
    for (const [amount, cs] of byAmount) {
      solve(
        cs,
        inflows.filter((p) => !usedPayback.has(p.id) && state.paybackRemaining(p) === amount),
        maxLag,
      );
    }
  }

  // Near misses for whatever is left: nearest-dated pair first.
  const pairs: { p: PaybackTx; c: PaybackTx; cost: number }[] = [];
  for (const c of charges) {
    const left = owed.get(c.id);
    if (left == null) continue;
    for (const p of inflows) {
      if (usedPayback.has(p.id) || !closeTo(state.paybackRemaining(p), left)) continue;
      if (sameMerchant(p, c)) continue;
      const pc = pairCost(differenceInCalendarDays(p.date, c.date));
      if (Number.isFinite(pc)) pairs.push({ p, c, cost: pc });
    }
  }
  pairs.sort((a, b) => a.cost - b.cost || a.c.date.getTime() - b.c.date.getTime());
  for (const { p, c } of pairs) {
    const left = owed.get(c.id);
    if (left == null || usedPayback.has(p.id)) continue;
    usedPayback.add(p.id);
    owed.delete(c.id);
    matches.push({ paybackId: p.id, chargeId: c.id, amountCents: Math.min(state.paybackRemaining(p), left) });
  }
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
