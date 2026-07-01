import { StatStrip } from "@/components/stat-strip";
import { formatCents } from "@/lib/utils";

export type PlanSlice = {
  id: number;
  name: string;
  value: number; // monthly limit (planned) in cents
  spent: number;
  color: string;
  icon?: string | null;
};

// Slim headline strip for the Budget page: spent so far, the plan total, and
// what's left (or over) with days remaining. The plan breakdown lives in the
// table below; no donut here.
export function BudgetHero({
  spent,
  planned,
  daysLeft,
}: {
  slices?: PlanSlice[];
  spent: number;
  planned: number;
  daysLeft: number;
}) {
  const left = Math.max(0, planned - spent);
  const over = planned > 0 && spent > planned;

  return (
    <StatStrip
      items={[
        {
          label: "Spent so far",
          value: formatCents(spent),
          accent: "var(--blush-deep)",
          dominant: true,
        },
        {
          label: "Planned",
          value: formatCents(planned),
          accent: "var(--blue-deep)",
        },
        {
          label: over ? "Over plan" : "Left to spend",
          value: formatCents(over ? spent - planned : left),
          accent: over ? "var(--blush-deep)" : "var(--sage-deep)",
          hint: `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`,
        },
      ]}
    />
  );
}
