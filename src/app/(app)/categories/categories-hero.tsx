import { StatStrip } from "@/components/stat-strip";
import { formatCents } from "@/lib/utils";

export type SpendSlice = {
  id: number;
  name: string;
  value: number; // spent this month in cents
  color: string;
  icon?: string | null;
};

// Slim headline strip for the Categories page: this month's spend and how many
// buckets exist / have a limit. The list of categories below is the real
// content here, so this stays minimal — no donut.
export function CategoriesHero({
  totalSpent,
  categoryCount,
  limitsSet,
}: {
  slices?: SpendSlice[];
  totalSpent: number;
  categoryCount: number;
  limitsSet: number;
  onSliceClick?: (id: number) => void;
}) {
  return (
    <StatStrip
      items={[
        {
          label: "Spent this month",
          value: formatCents(totalSpent),
          accent: "var(--blush-deep)",
          dominant: true,
        },
        {
          label: "Buckets",
          value: String(categoryCount),
          accent: "var(--blue-deep)",
        },
        {
          label: "With a limit",
          value: `${limitsSet} of ${categoryCount}`,
          accent: "var(--sage-deep)",
          hint: "set limits on Budget",
        },
      ]}
    />
  );
}
