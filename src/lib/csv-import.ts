import Papa from "papaparse";
import crypto from "node:crypto";

export type ParsedRow = {
  date: string;
  description: string;
  amountCents: number;
};

export type ColumnMap = {
  date: string;
  description: string;
  amount: string;
  // If the bank uses separate debit/credit columns, set these and leave `amount` blank
  debit?: string;
  credit?: string;
};

export function parseCsv(csv: string): { headers: string[]; rows: Record<string, string>[] } {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const headers = result.meta.fields ?? [];
  const rows = (result.data ?? []).filter((r) =>
    Object.values(r).some((v) => v && String(v).trim()),
  );
  return { headers, rows };
}

function parseAmount(s: string): number {
  if (!s) return 0;
  // Strip currency symbols, commas, spaces. Handle parens for negatives.
  let str = String(s).trim().replace(/[$,\s]/g, "");
  let negative = false;
  if (str.startsWith("(") && str.endsWith(")")) {
    negative = true;
    str = str.slice(1, -1);
  }
  const n = Number(str);
  if (Number.isNaN(n)) return 0;
  return Math.round((negative ? -n : n) * 100);
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  // Try ISO first
  const iso = new Date(s);
  if (!Number.isNaN(iso.getTime())) return iso;
  // Try MM/DD/YYYY or M/D/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let [, mm, dd, yy] = m;
    if (yy.length === 2) yy = "20" + yy;
    return new Date(Number(yy), Number(mm) - 1, Number(dd));
  }
  return null;
}

export function mapRows(
  rows: Record<string, string>[],
  cols: ColumnMap,
  opts: {
    // For credit cards, charges often show as positive but should be negative spending.
    // amountSign='flip' will multiply by -1.
    amountSign?: "as-is" | "flip";
  } = {},
): { date: Date; merchantRaw: string; amountCents: number }[] {
  const flip = opts.amountSign === "flip";
  const out: { date: Date; merchantRaw: string; amountCents: number }[] = [];
  for (const r of rows) {
    const d = parseDate(String(r[cols.date] ?? ""));
    if (!d) continue;
    const merchant = String(r[cols.description] ?? "").trim();
    if (!merchant) continue;
    let cents: number;
    if (cols.debit || cols.credit) {
      const debit = parseAmount(cols.debit ? String(r[cols.debit] ?? "") : "");
      const credit = parseAmount(
        cols.credit ? String(r[cols.credit] ?? "") : "",
      );
      cents = credit - debit;
    } else {
      cents = parseAmount(String(r[cols.amount] ?? ""));
    }
    if (flip) cents = -cents;
    out.push({ date: d, merchantRaw: merchant, amountCents: cents });
  }
  return out;
}

export function dedupeHash(
  accountId: number,
  date: Date,
  amountCents: number,
  merchantRaw: string,
): string {
  const dateStr = date.toISOString().slice(0, 10);
  const merchant = merchantRaw.toLowerCase().replace(/\s+/g, " ").trim();
  return crypto
    .createHash("sha1")
    .update(`${accountId}|${dateStr}|${amountCents}|${merchant}`)
    .digest("hex");
}

// Auto-detect likely column names so the import UI can pre-fill.
export function detectColumns(headers: string[]): Partial<ColumnMap> {
  const lower = headers.map((h) => h.toLowerCase());
  const find = (...patterns: string[]) => {
    for (const p of patterns) {
      const idx = lower.findIndex((h) => h.includes(p));
      if (idx >= 0) return headers[idx];
    }
    return undefined;
  };
  return {
    date: find("posted date", "transaction date", "date"),
    description:
      find("description", "merchant", "name", "memo", "details", "payee"),
    amount: find("amount", "transaction amount"),
    debit: find("debit", "withdrawal", "outflow"),
    credit: find("credit", "deposit", "inflow"),
  };
}
