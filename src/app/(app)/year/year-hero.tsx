import { StatStrip } from "@/components/stat-strip";
import { formatCents } from "@/lib/utils";

export type YearSlice = {
  id: number;
  name: string;
  value: number; // YTD total in cents
  color: string;
  icon?: string | null;
};

// Slim headline strip for the Year page. The month-by-month heatmap and the
// stacked-area chart below are this page's visualization; the hero just carries
// the year's headline totals — no donut.
export function YearHero({
  totalSpend,
  totalIncome,
  avgMonthlySpend,
  year,
}: {
  slices?: YearSlice[];
  totalSpend: number;
  totalIncome: number;
  avgMonthlySpend: number;
  year: number;
}) {
  const net = totalIncome - totalSpend;

  return (
    <StatStrip
      items={[
        {
          label: `${year} spend`,
          value: formatCents(totalSpend),
          accent: "var(--blush-deep)",
          dominant: true,
        },
        {
          label: `${year} income`,
          value: formatCents(totalIncome),
          accent: "var(--blue-deep)",
        },
        {
          label: "Net",
          value: formatCents(net, { signed: true }),
          accent: net >= 0 ? "var(--sage-deep)" : "var(--blush-deep)",
          hint: net >= 0 ? "ahead of spending" : "over income",
        },
        {
          label: "Avg / month",
          value: formatCents(Math.round(avgMonthlySpend)),
          accent: "var(--foreground-muted)",
        },
      ]}
    />
  );
}
