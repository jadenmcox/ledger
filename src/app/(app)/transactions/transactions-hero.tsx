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
// dashboard now; here we just surface the month's spend and how many
// transactions are loaded, then get out of the way of the list below.
// Uncategorized isn't a stat here: the list shows a callout only when
// something actually needs categorizing, so a permanent "0 / all categorized"
// tile was just noise.
export function TransactionsHero({
  totalSpend,
  txCount,
  monthLabel,
}: {
  slices?: TxSlice[];
  totalSpend: number;
  txCount: number;
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
      ]}
    />
  );
}
