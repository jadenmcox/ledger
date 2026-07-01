import { StatStrip } from "@/components/stat-strip";
import { formatCents } from "@/lib/utils";

export type TxSlice = {
  id: number;
  name: string;
  value: number; // this-month spend in cents
  color: string;
  icon?: string | null;
};

// Slim headline strip for the Transactions page. The donut lives on the
// dashboard now; here we just surface the month's spend + how much still needs
// categorizing, then get out of the way of the list below.
export function TransactionsHero({
  totalSpend,
  txCount,
  uncategorized,
  monthLabel,
}: {
  slices?: TxSlice[];
  totalSpend: number;
  txCount: number;
  uncategorized: number;
  monthLabel: string;
}) {
  return (
    <StatStrip
      items={[
        {
          label: `${monthLabel} spend`,
          value: formatCents(totalSpend),
          accent: "var(--blush-deep)",
          dominant: true,
        },
        {
          label: "Transactions",
          value: String(txCount),
          accent: "var(--blue-deep)",
          hint: "loaded (500 max)",
        },
        {
          label: "Uncategorized",
          value: String(uncategorized),
          accent:
            uncategorized > 0 ? "var(--blush-deep)" : "var(--sage-deep)",
          hint: uncategorized > 0 ? "tap a merchant to fix" : "all categorized",
        },
      ]}
    />
  );
}
