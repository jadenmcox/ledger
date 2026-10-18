import { db } from "@/db";
import { accounts } from "@/db/schema";
import { Container, PageHeader } from "@/components/ui";
import { loadLedgerData } from "@/lib/ledger-data";
import { owedSummary, paybackState } from "@/lib/paybacks";
import { subDays } from "date-fns";
import { PaybacksClient, type PaybackView } from "./client";

export const dynamic = "force-dynamic";

export default async function PaybacksPage() {
  const [{ allTx, links }, accts] = await Promise.all([
    loadLedgerData(),
    db.select({ id: accounts.id, name: accounts.name }).from(accounts),
  ]);
  const now = new Date();
  const acctName = new Map(accts.map((a) => [a.id, a.name]));
  const state = paybackState(links);
  const owed = owedSummary(allTx, state, now);
  const byId = new Map(allTx.map((t) => [t.id, t]));

  const view = (id: number): PaybackView | null => {
    const t = byId.get(id);
    if (!t) return null;
    return {
      id: t.id,
      date: t.date,
      amountCents: t.amountCents,
      merchantRaw: t.merchantRaw,
      merchantClean: t.merchantClean,
      categoryId: t.categoryId,
      isTransfer: t.isTransfer,
      reimbursable: t.reimbursable,
      accountName: acctName.get(t.accountId) ?? null,
      isPending: t.isPending,
    };
  };

  // Pool for the picker: everything from the last ~6 months.
  const since = subDays(now, 200);
  const pool = allTx
    .filter((t) => t.date >= since)
    .map((t) => view(t.id)!)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  // Settled history, grouped by charge, newest charge first.
  const settledCutoff = subDays(now, 120);
  const byCharge = new Map<number, { linkId: number; payback: PaybackView; amountCents: number }[]>();
  for (const l of links) {
    const charge = byId.get(l.chargeId);
    const payback = view(l.paybackId);
    if (!charge || !payback || charge.date < settledCutoff) continue;
    const arr = byCharge.get(l.chargeId) ?? [];
    arr.push({ linkId: l.id, payback, amountCents: l.amountCents });
    byCharge.set(l.chargeId, arr);
  }
  const settled = [...byCharge.entries()]
    .map(([chargeId, paybacks]) => ({ charge: view(chargeId)!, paybacks }))
    .sort((a, b) => b.charge.date.getTime() - a.charge.date.getTime());

  // Payments you flagged as reimbursements that aren't tied to a charge yet.
  const loose = allTx
    .filter(
      (t) =>
        t.reimbursable && t.amountCents > 0 && t.date >= since && state.paybackRemaining(t) > 0,
    )
    .map((t) => view(t.id)!);

  const backLast90 = links
    .filter((l) => {
      const p = byId.get(l.paybackId);
      return p && p.date >= subDays(now, 90);
    })
    .reduce((s, l) => s + l.amountCents, 0);

  return (
    <>
      <PageHeader
        title="Paybacks"
        subtitle="Money you fronted that's coming back: work lunches, a friend's share of parking. Paybacks never count as income."
      />
      <Container className="pb-32 md:pb-16">
        <PaybacksClient
          owedCents={owed.owedCents}
          backLast90={backLast90}
          waiting={owed.waiting.map((w) => ({ tx: view(w.tx.id)!, remaining: w.remaining }))}
          settled={settled}
          loose={loose}
          pool={pool}
          links={links.map((l) => ({
            id: l.id,
            paybackId: l.paybackId,
            chargeId: l.chargeId,
            amountCents: l.amountCents,
          }))}
        />
      </Container>
    </>
  );
}
