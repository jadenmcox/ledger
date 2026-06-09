import "dotenv/config";
import { db } from "./index";
import {
  accounts,
  categories,
  transactions,
  balanceSnapshots,
} from "./schema";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";
import { format, subDays, addDays } from "date-fns";

/**
 * Demo seed — wipes transactions/snapshots and seeds 90 days of realistic
 * activity across a few accounts and the existing categories. Idempotent:
 * safe to re-run.
 *
 *   npm run db:demo
 */

type CatLookup = Record<string, number>;

function dedupe(...parts: (string | number)[]) {
  return crypto.createHash("sha1").update(parts.join("|")).digest("hex");
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function jitter(amount: number, pct = 0.15) {
  const j = amount * pct * (Math.random() * 2 - 1);
  return Math.round(amount + j);
}

async function main() {
  console.log("📊 Seeding demo data…");

  // 1. Ensure categories exist (use seed.ts categories)
  const cats = await db.select().from(categories);
  if (cats.length === 0) {
    throw new Error(
      "No categories. Run `npm run db:seed` first to create them.",
    );
  }
  const byName: CatLookup = {};
  for (const c of cats) byName[c.name] = c.id;

  function need(name: string): number {
    const id = byName[name];
    if (!id) throw new Error(`Missing category: ${name}`);
    return id;
  }

  // 2. Wipe demo data (transactions, snapshots) but keep categories + accounts unless they're demo
  await db.delete(transactions);
  await db.delete(balanceSnapshots);
  console.log("  • Cleared existing transactions and snapshots");

  // 3. Ensure demo accounts exist (idempotent by name)
  const existingAccts = await db.select().from(accounts);
  async function ensureAccount(spec: {
    name: string;
    type:
      | "checking"
      | "savings"
      | "hys"
      | "credit"
      | "cash"
      | "brokerage"
      | "roth_ira"
      | "traditional_401k"
      | "hsa"
      | "loan"
      | "other";
    institution?: string;
    balanceCents: number;
  }) {
    const found = existingAccts.find((a) => a.name === spec.name);
    if (found) {
      await db
        .update(accounts)
        .set({ currentBalanceCents: spec.balanceCents })
        .where(eq(accounts.id, found.id));
      return found.id;
    }
    const inserted = await db
      .insert(accounts)
      .values({
        name: spec.name,
        type: spec.type,
        institution: spec.institution,
        currency: "USD",
        currentBalanceCents: spec.balanceCents,
        isActive: true,
      })
      .returning();
    return inserted[0].id;
  }

  const checkingId = await ensureAccount({
    name: "Chase Checking",
    type: "checking",
    institution: "Chase",
    balanceCents: 482_715,
  });
  const cardId = await ensureAccount({
    name: "Apple Card",
    type: "credit",
    institution: "Apple",
    balanceCents: -134_220,
  });
  const hysaId = await ensureAccount({
    name: "Ally HYSA",
    type: "hys",
    institution: "Ally",
    balanceCents: 1_842_500,
  });
  const brokerageId = await ensureAccount({
    name: "Fidelity Brokerage",
    type: "brokerage",
    institution: "Fidelity",
    balanceCents: 4_286_300,
  });

  console.log("  • Demo accounts ready");

  // 4. Generate 90 days of transactions
  const now = new Date();
  const start = subDays(now, 89);

  type Tx = {
    accountId: number;
    date: Date;
    amountCents: number; // negative = outflow, positive = inflow
    merchantRaw: string;
    merchantClean: string;
    categoryId: number;
    source: "manual";
    dedupeHash: string;
    isRecurring?: boolean;
    isPending?: boolean;
    isTransfer?: boolean;
  };

  const txs: Tx[] = [];

  // ---- Recurring: paychecks (twice/month on 1st and 15th, checking)
  for (
    let d = new Date(start);
    d <= now;
    d = addDays(d, 1)
  ) {
    const day = d.getDate();
    if (day === 1 || day === 15) {
      const amount = jitter(320_000, 0.02);
      txs.push({
        accountId: checkingId,
        date: new Date(d),
        amountCents: amount,
        merchantRaw: "ACME CORP DIRECT DEP",
        merchantClean: "Acme Corp Payroll",
        categoryId: need("Paycheck"),
        source: "manual",
        dedupeHash: dedupe("paycheck", d.toISOString()),
        isRecurring: true,
      });
    }
  }

  // ---- Rent on the 1st
  for (
    let d = new Date(start);
    d <= now;
    d = addDays(d, 1)
  ) {
    if (d.getDate() === 1) {
      txs.push({
        accountId: checkingId,
        date: new Date(d),
        amountCents: -185_000,
        merchantRaw: "RENT * BROADWAY APTS",
        merchantClean: "Broadway Apartments",
        categoryId: need("Rent/Mortgage"),
        source: "manual",
        dedupeHash: dedupe("rent", d.toISOString()),
        isRecurring: true,
      });
    }
  }

  // ---- Subscriptions (monthly, mid-month-ish)
  const subscriptions: Array<{
    day: number;
    name: string;
    raw: string;
    amount: number;
    cat: string;
    acct: "card" | "checking";
  }> = [
    { day: 4, name: "Spotify", raw: "SPOTIFY USA", amount: -1099, cat: "Subscriptions", acct: "card" },
    { day: 7, name: "Netflix", raw: "NETFLIX.COM", amount: -1549, cat: "Subscriptions", acct: "card" },
    { day: 12, name: "iCloud", raw: "APPLE.COM/BILL", amount: -299, cat: "Subscriptions", acct: "card" },
    { day: 18, name: "NYT", raw: "NYTIMES SUBSCRIPTION", amount: -1700, cat: "Subscriptions", acct: "card" },
    { day: 22, name: "Notion", raw: "NOTION LABS INC", amount: -1000, cat: "Subscriptions", acct: "card" },
    { day: 28, name: "Gym", raw: "EQUINOX MEMBERSHIP", amount: -23000, cat: "Personal Care", acct: "checking" },
  ];
  for (
    let d = new Date(start);
    d <= now;
    d = addDays(d, 1)
  ) {
    for (const sub of subscriptions) {
      if (d.getDate() === sub.day) {
        txs.push({
          accountId: sub.acct === "card" ? cardId : checkingId,
          date: new Date(d),
          amountCents: sub.amount,
          merchantRaw: sub.raw,
          merchantClean: sub.name,
          categoryId: need(sub.cat),
          source: "manual",
          dedupeHash: dedupe(sub.name, d.toISOString()),
          isRecurring: true,
        });
      }
    }
  }

  // ---- Utilities (monthly, ~10th)
  for (
    let d = new Date(start);
    d <= now;
    d = addDays(d, 1)
  ) {
    if (d.getDate() === 10) {
      txs.push({
        accountId: checkingId,
        date: new Date(d),
        amountCents: jitter(-8_500, 0.2),
        merchantRaw: "CON EDISON ENERGY",
        merchantClean: "Con Edison",
        categoryId: need("Utilities"),
        source: "manual",
        dedupeHash: dedupe("coned", d.toISOString()),
        isRecurring: true,
      });
      txs.push({
        accountId: checkingId,
        date: new Date(d),
        amountCents: -8_000,
        merchantRaw: "T-MOBILE WIRELESS",
        merchantClean: "T-Mobile",
        categoryId: need("Internet/Phone"),
        source: "manual",
        dedupeHash: dedupe("tmobile", d.toISOString()),
        isRecurring: true,
      });
    }
  }

  // ---- Groceries: 2-3x/week, $40-90
  const groceryMerchants = [
    { raw: "WHOLEFDS BOWERY", clean: "Whole Foods" },
    { raw: "TRADER JOES #487", clean: "Trader Joe's" },
    { raw: "KEY FOODS MARKETPLACE", clean: "Key Foods" },
  ];
  for (
    let d = new Date(start);
    d <= now;
    d = addDays(d, 1)
  ) {
    const dow = d.getDay();
    // shop on Sun, Wed, Sat
    if (dow === 0 || dow === 3 || dow === 6) {
      if (Math.random() < 0.75) {
        const m = pick(groceryMerchants);
        txs.push({
          accountId: cardId,
          date: new Date(d),
          amountCents: jitter(-6_500, 0.4),
          merchantRaw: m.raw,
          merchantClean: m.clean,
          categoryId: need("Groceries"),
          source: "manual",
          dedupeHash: dedupe("grocery", d.toISOString(), m.raw, Math.random()),
        });
      }
    }
  }

  // ---- Coffee: 3-5x/week, $5-9
  const coffeeMerchants = [
    { raw: "BLUE BOTTLE COFFEE", clean: "Blue Bottle" },
    { raw: "STARBUCKS STORE #4421", clean: "Starbucks" },
    { raw: "JOE COFFEE 9TH ST", clean: "Joe Coffee" },
    { raw: "DEVOCION GREENPOINT", clean: "Devocion" },
  ];
  for (
    let d = new Date(start);
    d <= now;
    d = addDays(d, 1)
  ) {
    const dow = d.getDay();
    if (dow !== 0 && Math.random() < 0.55) {
      const m = pick(coffeeMerchants);
      txs.push({
        accountId: cardId,
        date: new Date(d),
        amountCents: jitter(-650, 0.3),
        merchantRaw: m.raw,
        merchantClean: m.clean,
        categoryId: need("Coffee"),
        source: "manual",
        dedupeHash: dedupe("coffee", d.toISOString(), m.raw, Math.random()),
      });
    }
  }

  // ---- Food & Drink (eating out): ~3x/week
  const restaurants = [
    { raw: "DIMES SQUARE LLC", clean: "Dimes" },
    { raw: "VANS BAR & GRILL", clean: "Van's" },
    { raw: "MISI RESTAURANT", clean: "Misi" },
    { raw: "PRINCE STREET PIZZA", clean: "Prince Street Pizza" },
    { raw: "SUSHI BY M", clean: "Sushi by M" },
    { raw: "RAY'S BAR ESSEX", clean: "Ray's" },
  ];
  for (
    let d = new Date(start);
    d <= now;
    d = addDays(d, 1)
  ) {
    if (Math.random() < 0.42) {
      const m = pick(restaurants);
      txs.push({
        accountId: cardId,
        date: new Date(d),
        amountCents: jitter(-3_800, 0.5),
        merchantRaw: m.raw,
        merchantClean: m.clean,
        categoryId: need("Food & Drink"),
        source: "manual",
        dedupeHash: dedupe("dining", d.toISOString(), m.raw, Math.random()),
      });
    }
  }

  // ---- Transportation: sporadic, $2.90 subway + occasional uber
  for (
    let d = new Date(start);
    d <= now;
    d = addDays(d, 1)
  ) {
    if (Math.random() < 0.3) {
      txs.push({
        accountId: cardId,
        date: new Date(d),
        amountCents: -290,
        merchantRaw: "MTA*METROCARD VEND",
        merchantClean: "MTA",
        categoryId: need("Transportation"),
        source: "manual",
        dedupeHash: dedupe("mta", d.toISOString(), Math.random()),
      });
    }
    if (Math.random() < 0.12) {
      txs.push({
        accountId: cardId,
        date: new Date(d),
        amountCents: jitter(-1_800, 0.5),
        merchantRaw: "UBER TRIP HELP.UBER.COM",
        merchantClean: "Uber",
        categoryId: need("Transportation"),
        source: "manual",
        dedupeHash: dedupe("uber", d.toISOString(), Math.random()),
      });
    }
  }

  // ---- Shopping (~weekly clothing/home)
  const shopping = [
    { raw: "AMZN MKTP US*RT4UI", clean: "Amazon" },
    { raw: "UNIQLO USA SOHO", clean: "Uniqlo" },
    { raw: "MUJI 5TH AVE", clean: "Muji" },
    { raw: "TARGET 00012245", clean: "Target" },
  ];
  for (
    let d = new Date(start);
    d <= now;
    d = addDays(d, 1)
  ) {
    if (Math.random() < 0.18) {
      const m = pick(shopping);
      txs.push({
        accountId: cardId,
        date: new Date(d),
        amountCents: jitter(-5_500, 0.6),
        merchantRaw: m.raw,
        merchantClean: m.clean,
        categoryId: need("Shopping"),
        source: "manual",
        dedupeHash: dedupe("shop", d.toISOString(), m.raw, Math.random()),
      });
    }
  }

  // ---- Entertainment (occasional)
  const ent = [
    { raw: "ANGELIKA FILM CENTER", clean: "Angelika" },
    { raw: "MET MUSEUM ADMIT", clean: "The Met" },
    { raw: "BROOKLYN STEEL", clean: "Brooklyn Steel" },
  ];
  for (
    let d = new Date(start);
    d <= now;
    d = addDays(d, 1)
  ) {
    if (Math.random() < 0.08) {
      const m = pick(ent);
      txs.push({
        accountId: cardId,
        date: new Date(d),
        amountCents: jitter(-3_000, 0.6),
        merchantRaw: m.raw,
        merchantClean: m.clean,
        categoryId: need("Entertainment"),
        source: "manual",
        dedupeHash: dedupe("ent", d.toISOString(), m.raw, Math.random()),
      });
    }
  }

  // ---- A couple of bigger one-offs (travel, Costco run)
  txs.push({
    accountId: cardId,
    date: subDays(now, 47),
    amountCents: -64_200,
    merchantRaw: "DELTA AIR 0061245912",
    merchantClean: "Delta Air Lines",
    categoryId: need("Travel"),
    source: "manual",
    dedupeHash: dedupe("delta", "47"),
  });
  txs.push({
    accountId: cardId,
    date: subDays(now, 46),
    amountCents: -28_400,
    merchantRaw: "AIRBNB * HMXVA8K",
    merchantClean: "Airbnb",
    categoryId: need("Travel"),
    source: "manual",
    dedupeHash: dedupe("airbnb", "46"),
  });
  txs.push({
    accountId: cardId,
    date: subDays(now, 22),
    amountCents: -18_750,
    merchantRaw: "COSTCO WHSE #1129",
    merchantClean: "Costco",
    categoryId: need("Costco"),
    source: "manual",
    dedupeHash: dedupe("costco", "22"),
  });

  // ---- Auto-transfer to savings, twice a month
  for (
    let d = new Date(start);
    d <= now;
    d = addDays(d, 1)
  ) {
    if (d.getDate() === 2 || d.getDate() === 16) {
      txs.push({
        accountId: checkingId,
        date: new Date(d),
        amountCents: -50_000,
        merchantRaw: "TRANSFER TO HYSA",
        merchantClean: "Transfer → Ally HYSA",
        categoryId: need("Emergency Fund"),
        source: "manual",
        dedupeHash: dedupe("xfer-out", d.toISOString()),
        isRecurring: true,
        isTransfer: true,
      });
      txs.push({
        accountId: hysaId,
        date: new Date(d),
        amountCents: 50_000,
        merchantRaw: "TRANSFER FROM CHECKING",
        merchantClean: "Transfer ← Chase Checking",
        categoryId: need("Emergency Fund"),
        source: "manual",
        dedupeHash: dedupe("xfer-in", d.toISOString()),
        isRecurring: true,
        isTransfer: true,
      });
    }
  }

  // ---- HYSA interest
  for (
    let d = new Date(start);
    d <= now;
    d = addDays(d, 1)
  ) {
    if (d.getDate() === 30) {
      txs.push({
        accountId: hysaId,
        date: new Date(d),
        amountCents: jitter(7_200, 0.05),
        merchantRaw: "ALLY INTEREST PAID",
        merchantClean: "Ally Interest",
        categoryId: need("Interest"),
        source: "manual",
        dedupeHash: dedupe("interest", d.toISOString()),
        isRecurring: true,
      });
    }
  }

  // ---- Card payment (treat as transfer)
  for (
    let d = new Date(start);
    d <= now;
    d = addDays(d, 1)
  ) {
    if (d.getDate() === 20) {
      const amt = 95_000;
      txs.push({
        accountId: checkingId,
        date: new Date(d),
        amountCents: -amt,
        merchantRaw: "APPLE CARD PAYMENT",
        merchantClean: "Apple Card Payment",
        categoryId: need("Transfer"),
        source: "manual",
        dedupeHash: dedupe("cardpay-out", d.toISOString()),
        isTransfer: true,
      });
      txs.push({
        accountId: cardId,
        date: new Date(d),
        amountCents: amt,
        merchantRaw: "PAYMENT THANK YOU",
        merchantClean: "Apple Card Payment",
        categoryId: need("Transfer"),
        source: "manual",
        dedupeHash: dedupe("cardpay-in", d.toISOString()),
        isTransfer: true,
      });
    }
  }

  // Insert
  if (txs.length > 0) {
    await db.insert(transactions).values(txs as never);
  }
  console.log(`  • Inserted ${txs.length} transactions`);

  // 5. Balance snapshots — daily for each account, derived from current balance
  const accountIds = [checkingId, cardId, hysaId, brokerageId];
  const currentBalances: Record<number, number> = {
    [checkingId]: 482_715,
    [cardId]: -134_220,
    [hysaId]: 1_842_500,
    [brokerageId]: 4_286_300,
  };

  const snaps: { accountId: number; date: string; balanceCents: number }[] = [];
  for (const aid of accountIds) {
    // For brokerage we'll add some noise; for HYSA gentle growth
    let bal = currentBalances[aid];
    const days: { d: Date; bal: number }[] = [];
    days.push({ d: new Date(now), bal });
    for (let i = 1; i <= 89; i++) {
      const d = subDays(now, i);
      // Walk balance backwards through transactions of this account on that day
      const dayTxs = txs.filter(
        (t) =>
          t.accountId === aid &&
          format(t.date, "yyyy-MM-dd") === format(addDays(d, 1), "yyyy-MM-dd"),
      );
      const dayDelta = dayTxs.reduce((s, t) => s + t.amountCents, 0);
      bal -= dayDelta;
      // Brokerage drift: random walk
      if (aid === brokerageId) {
        bal -= Math.round(bal * (Math.random() * 0.012 - 0.005));
      }
      days.push({ d, bal });
    }
    for (const { d, bal: b } of days) {
      snaps.push({
        accountId: aid,
        date: format(d, "yyyy-MM-dd"),
        balanceCents: b,
      });
    }
  }
  if (snaps.length > 0) {
    await db.insert(balanceSnapshots).values(snaps);
  }
  console.log(`  • Inserted ${snaps.length} balance snapshots`);

  console.log("✅ Demo seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
